import { db } from '../client';
import { AnalysisResult, ComplianceFinding } from '../../types';
import logger from '../../utils/logger';

export class AnalysisRepository {
  /**
   * Save analysis result with findings
   */
  async saveAnalysis(result: AnalysisResult): Promise<void> {
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Insert analysis
      await client.query(
        `INSERT INTO analyses (
          id, pr_number, repo_full_name, status, analyzed_at, duration,
          total_files, total_findings, critical_count, high_count,
          medium_count, low_count, info_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          result.id,
          result.prNumber,
          result.repoFullName,
          result.status,
          result.analyzedAt,
          result.duration,
          result.stats.totalFiles,
          result.stats.totalFindings,
          result.stats.critical,
          result.stats.high,
          result.stats.medium,
          result.stats.low,
          result.stats.info,
        ]
      );

      // Insert findings
      for (const finding of result.findings) {
        await client.query(
          `INSERT INTO findings (
            id, analysis_id, type, severity, message, file, line, column,
            code, fix_suggestion, rule_id, rule_name
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            finding.id,
            result.id,
            finding.type,
            finding.severity,
            finding.message,
            finding.file,
            finding.line || null,
            finding.column || null,
            finding.code || null,
            finding.fixSuggestion || null,
            finding.ruleId,
            finding.ruleName,
          ]
        );
      }

      await client.query('COMMIT');
      logger.info(`Saved analysis ${result.id} with ${result.findings.length} findings`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error saving analysis:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get analysis by ID
   */
  async getAnalysis(id: string): Promise<AnalysisResult | null> {
    try {
      const analysisResult = await db.query(
        'SELECT * FROM analyses WHERE id = $1',
        [id]
      );

      if (analysisResult.rows.length === 0) {
        return null;
      }

      const analysis = analysisResult.rows[0];

      const findingsResult = await db.query(
        'SELECT * FROM findings WHERE analysis_id = $1 ORDER BY severity, file, line',
        [id]
      );

      return this.mapToAnalysisResult(analysis, findingsResult.rows);
    } catch (error) {
      logger.error(`Error fetching analysis ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get recent analyses
   */
  async getRecentAnalyses(limit: number = 50): Promise<AnalysisResult[]> {
    try {
      const result = await db.query(
        'SELECT * FROM analyses ORDER BY analyzed_at DESC LIMIT $1',
        [limit]
      );

      return Promise.all(
        result.rows.map(async (row) => {
          const findingsResult = await db.query(
            'SELECT * FROM findings WHERE analysis_id = $1',
            [row.id]
          );
          return this.mapToAnalysisResult(row, findingsResult.rows);
        })
      );
    } catch (error) {
      logger.error('Error fetching recent analyses:', error);
      throw error;
    }
  }

  /**
   * Get analyses for a repository
   */
  async getAnalysesByRepo(repoFullName: string, limit: number = 50): Promise<AnalysisResult[]> {
    try {
      const result = await db.query(
        'SELECT * FROM analyses WHERE repo_full_name = $1 ORDER BY analyzed_at DESC LIMIT $2',
        [repoFullName, limit]
      );

      return Promise.all(
        result.rows.map(async (row) => {
          const findingsResult = await db.query(
            'SELECT * FROM findings WHERE analysis_id = $1',
            [row.id]
          );
          return this.mapToAnalysisResult(row, findingsResult.rows);
        })
      );
    } catch (error) {
      logger.error(`Error fetching analyses for ${repoFullName}:`, error);
      throw error;
    }
  }

  /**
   * Get analysis statistics
   */
  async getStats() {
    const defaultStats = {
      total_analyses: '0',
      total_findings: '0',
      total_critical: '0',
      total_high: '0',
      total_medium: '0',
      total_low: '0',
      total_info: '0',
      avg_duration: '0',
    };

    try {
      const result = await db.query(`
        SELECT
          COUNT(*)::INTEGER as total_analyses,
          COALESCE(SUM(total_findings), 0)::INTEGER as total_findings,
          COALESCE(SUM(critical_count), 0)::INTEGER as total_critical,
          COALESCE(SUM(high_count), 0)::INTEGER as total_high,
          COALESCE(SUM(medium_count), 0)::INTEGER as total_medium,
          COALESCE(SUM(low_count), 0)::INTEGER as total_low,
          COALESCE(SUM(info_count), 0)::INTEGER as total_info,
          COALESCE(AVG(duration), 0)::NUMERIC as avg_duration
        FROM analyses
        WHERE status = 'completed'
      `);

      // Return default values if no rows found
      if (!result.rows || result.rows.length === 0) {
        return defaultStats;
      }

      return result.rows[0];
    } catch (error: unknown) {
      // Handle table doesn't exist error (42P01) or other database errors gracefully
      const dbError = error as { code?: string };
      if (dbError?.code === '42P01' || dbError?.code === '42P02') {
        logger.warn('Analyses table does not exist yet. Run migrations to create it.');
        return defaultStats;
      }
      logger.error('Error fetching stats:', error);
      // Return default stats instead of throwing to prevent 500 errors
      return defaultStats;
    }
  }

  /**
   * Map database rows to AnalysisResult
   */
  private mapToAnalysisResult(analysis: Record<string, unknown>, findings: Array<Record<string, unknown>>): AnalysisResult {
    return {
      id: String(analysis.id),
      prNumber: Number(analysis.pr_number),
      repoFullName: String(analysis.repo_full_name),
      status: analysis.status as AnalysisResult['status'],
      findings: findings.map(this.mapToFinding),
      analyzedAt: analysis.analyzed_at as Date,
      duration: Number(analysis.duration),
      stats: {
        totalFiles: Number(analysis.total_files),
        totalFindings: Number(analysis.total_findings),
        critical: Number(analysis.critical_count),
        high: Number(analysis.high_count),
        medium: Number(analysis.medium_count),
        low: Number(analysis.low_count),
        info: Number(analysis.info_count),
      },
    };
  }

  /**
   * Map database row to ComplianceFinding
   */
  private mapToFinding(row: Record<string, unknown>): ComplianceFinding {
    return {
      id: String(row.id),
      type: row.type as ComplianceFinding['type'],
      severity: row.severity as ComplianceFinding['severity'],
      message: String(row.message),
      file: String(row.file),
      line: row.line as number | undefined,
      column: row.column as number | undefined,
      code: row.code as string | undefined,
      fixSuggestion: row.fix_suggestion as string | undefined,
      ruleId: String(row.rule_id),
      ruleName: String(row.rule_name),
    };
  }
}

export default AnalysisRepository;
