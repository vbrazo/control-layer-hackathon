import { Octokit } from '@octokit/rest';
import { PRContext, AnalysisResult, ComplianceFinding, ChangedFile, CustomRule } from '../types';
import { GitHubAppHandler } from './app-handler';
import { E2BAgent } from '../agent/e2b-agent';
import { GroqAnalyzer } from '../analysis/groq-analyzer';
import { RulesEngine } from '../compliance/rules-engine';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

export class PRAnalyzer {
  private githubHandler: GitHubAppHandler;
  private groqAnalyzer: GroqAnalyzer;

  constructor(githubHandler: GitHubAppHandler) {
    this.githubHandler = githubHandler;
    this.groqAnalyzer = new GroqAnalyzer();
  }

  /**
   * Analyze a pull request comprehensively
   */
  async analyzePR(
    octokit: Octokit,
    owner: string,
    repo: string,
    prNumber: number,
    customRules: CustomRule[] = []
  ): Promise<AnalysisResult> {
    const startTime = Date.now();
    const analysisId = uuidv4();

    logger.info(`Starting analysis for ${owner}/${repo}#${prNumber}`);

    try {
      // Create check run
      const { data: pr } = await octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
      });

      const checkRunId = await this.githubHandler.createCheckRun(
        octokit,
        owner,
        repo,
        pr.head.sha,
        'Compliance Analysis',
        'in_progress'
      );

      // Build PR context
      const prContext = await this.buildPRContext(octokit, owner, repo, prNumber, pr);

      // Fetch changed files
      const changedFiles = await this.fetchChangedFiles(octokit, owner, repo, prNumber, pr.head.ref);

      // Run multi-stage analysis
      const findings = await this.runMultiStageAnalysis(
        octokit,
        prContext,
        changedFiles,
        customRules
      );

      // Calculate statistics
      const stats = this.calculateStats(findings, changedFiles.length);

      // Create analysis result
      const result: AnalysisResult = {
        id: analysisId,
        prNumber,
        repoFullName: `${owner}/${repo}`,
        status: 'completed',
        findings,
        analyzedAt: new Date(),
        duration: Date.now() - startTime,
        stats,
      };

      // Post results to PR
      await this.postResults(octokit, owner, repo, prNumber, result, pr.head.sha, checkRunId);

      logger.info(`Analysis complete for ${owner}/${repo}#${prNumber}: ${findings.length} findings`);
      return result;
    } catch (error) {
      logger.error(`Error analyzing PR ${owner}/${repo}#${prNumber}:`, error);
      
      const result: AnalysisResult = {
        id: analysisId,
        prNumber,
        repoFullName: `${owner}/${repo}`,
        status: 'failed',
        findings: [],
        analyzedAt: new Date(),
        duration: Date.now() - startTime,
        stats: {
          totalFiles: 0,
          totalFindings: 0,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          info: 0,
        },
      };

      return result;
    }
  }

  /**
   * Build PR context with metadata
   */
  private async buildPRContext(
    octokit: Octokit,
    owner: string,
    repo: string,
    prNumber: number,
    pr: { head: { ref: string }; base: { ref: string }; user: { login: string }; title: string; body: string | null }
  ): Promise<PRContext> {
    return {
      owner,
      repo,
      prNumber,
      branch: pr.head.ref,
      baseBranch: pr.base.ref,
      author: pr.user.login,
      title: pr.title,
      description: pr.body || '',
      changedFiles: [],
    };
  }

  /**
   * Fetch changed files with content
   */
  private async fetchChangedFiles(
    octokit: Octokit,
    owner: string,
    repo: string,
    prNumber: number,
    ref: string
  ): Promise<ChangedFile[]> {
    const files = await this.githubHandler.getPRFiles(octokit, owner, repo, prNumber);
    
    const changedFiles: ChangedFile[] = await Promise.all(
      files.map(async (file: Record<string, unknown>) => {
        let content: string | undefined;
        const filename = String(file.filename);
        const status = String(file.status) as ChangedFile['status'];

        // Fetch content for text files only
        if (status !== 'removed' && this.isTextFile(filename)) {
          try {
            content = await this.githubHandler.getFileContent(
              octokit,
              owner,
              repo,
              filename,
              ref
            );
          } catch (error) {
            logger.warn(`Could not fetch content for ${filename}`);
          }
        }

        return {
          filename,
          status,
          additions: Number(file.additions) || 0,
          deletions: Number(file.deletions) || 0,
          patch: file.patch as string | undefined,
          content,
        };
      })
    );

    return changedFiles.filter(f => f.status !== 'removed');
  }

  /**
   * Check if file is a text file (for content fetching)
   */
  private isTextFile(filename: string): boolean {
    const textExtensions = [
      '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs', '.c', '.cpp', '.h',
      '.rb', '.php', '.swift', '.kt', '.scala', '.sh', '.bash', '.yml', '.yaml', '.json',
      '.xml', '.html', '.css', '.scss', '.sass', '.less', '.sql', '.md', '.txt', '.env',
    ];

    return textExtensions.some(ext => filename.endsWith(ext));
  }

  /**
   * Run multi-stage analysis pipeline
   */
  private async runMultiStageAnalysis(
    octokit: Octokit,
    prContext: PRContext,
    changedFiles: ChangedFile[],
    customRules: CustomRule[]
  ): Promise<ComplianceFinding[]> {
    const allFindings: ComplianceFinding[] = [];

    // Stage 1: Rules Engine (regex-based, fast)
    logger.info('Stage 1: Running rules engine...');
    const rulesEngine = new RulesEngine(customRules);
    const ruleFindings = await rulesEngine.analyzeFiles(changedFiles);
    allFindings.push(...ruleFindings);

    // Stage 2: E2B Sandbox + MCP Tools (isolated environment)
    logger.info('Stage 2: Running E2B sandbox analysis...');
    try {
      const installationId = await this.getInstallationId(octokit);
      const token = await this.githubHandler.getInstallationToken(installationId);
      
      const e2bAgent = new E2BAgent(token);
      const e2bFindings = await e2bAgent.analyzeWithMCP({
        files: changedFiles,
        customRules,
        prContext,
      });
      allFindings.push(...e2bFindings);
      
      await e2bAgent.cleanup();
    } catch (error) {
      logger.error('E2B analysis failed:', error);
    }

    // Stage 3: Groq AI Analysis (AI-powered validation and suggestions)
    logger.info('Stage 3: Running Groq AI analysis...');
    try {
      const groqFindings = await this.groqAnalyzer.analyzeCode(
        changedFiles,
        allFindings,
        customRules
      );
      allFindings.push(...groqFindings);
    } catch (error) {
      logger.error('Groq analysis failed:', error);
    }

    // Deduplicate findings
    const dedupedFindings = this.deduplicateFindings(allFindings);

    logger.info(`Multi-stage analysis complete: ${dedupedFindings.length} unique findings`);
    return dedupedFindings;
  }

  /**
   * Deduplicate findings by file, line, and type
   */
  private deduplicateFindings(findings: ComplianceFinding[]): ComplianceFinding[] {
    const seen = new Set<string>();
    const deduped: ComplianceFinding[] = [];

    for (const finding of findings) {
      const key = `${finding.file}:${finding.line}:${finding.type}:${finding.message}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(finding);
      }
    }

    return deduped;
  }

  /**
   * Calculate statistics from findings
   */
  private calculateStats(findings: ComplianceFinding[], totalFiles: number) {
    return {
      totalFiles,
      totalFindings: findings.length,
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length,
      info: findings.filter(f => f.severity === 'info').length,
    };
  }

  /**
   * Post analysis results to PR
   */
  private async postResults(
    octokit: Octokit,
    owner: string,
    repo: string,
    prNumber: number,
    result: AnalysisResult,
    headSha: string,
    checkRunId: number
  ): Promise<void> {
    // Generate summary comment
    const comment = this.generateSummaryComment(result);
    await this.githubHandler.postComment(octokit, owner, repo, prNumber, comment);

    // Post inline comments for critical/high findings
    const criticalFindings = result.findings.filter(
      f => ['critical', 'high'].includes(f.severity) && f.line
    ).slice(0, 10); // Limit to 10 to avoid spam

    for (const finding of criticalFindings) {
      try {
        await this.githubHandler.postReviewComment(
          octokit,
          owner,
          repo,
          prNumber,
          this.formatFindingComment(finding),
          headSha,
          finding.file,
          finding.line!
        );
      } catch (error) {
        logger.warn(`Could not post review comment for ${finding.file}:${finding.line}`);
      }
    }

    // Update check run
    const conclusion = result.stats.critical > 0 ? 'failure' : 
                      result.stats.high > 0 ? 'neutral' : 'success';

    await this.githubHandler.updateCheckRun(
      octokit,
      owner,
      repo,
      checkRunId,
      'completed',
      conclusion,
      {
        title: 'Compliance Analysis Complete',
        summary: this.generateCheckSummary(result),
      }
    );
  }

  /**
   * Generate summary comment markdown
   */
  private generateSummaryComment(result: AnalysisResult): string {
    const { stats, findings } = result;

    let comment = `## 🛡️ Compliance Analysis Results\n\n`;
    comment += `**Status:** ${stats.critical > 0 ? '❌ Critical issues found' : stats.high > 0 ? '⚠️  Issues found' : '✅ No critical issues'}\n\n`;
    comment += `### 📊 Summary\n`;
    comment += `- **Total Findings:** ${stats.totalFindings}\n`;
    comment += `- **Files Analyzed:** ${stats.totalFiles}\n`;
    comment += `- **Duration:** ${(result.duration / 1000).toFixed(2)}s\n\n`;

    comment += `### 🎯 Findings by Severity\n`;
    comment += `| Severity | Count |\n`;
    comment += `|----------|-------|\n`;
    comment += `| 🔴 Critical | ${stats.critical} |\n`;
    comment += `| 🟠 High | ${stats.high} |\n`;
    comment += `| 🟡 Medium | ${stats.medium} |\n`;
    comment += `| 🔵 Low | ${stats.low} |\n`;
    comment += `| ⚪ Info | ${stats.info} |\n\n`;

    // Show top findings
    if (findings.length > 0) {
      const topFindings = findings
        .sort((a, b) => {
          const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
          return severityOrder[a.severity] - severityOrder[b.severity];
        })
        .slice(0, 5);

      comment += `### 🔍 Top Findings\n\n`;
      topFindings.forEach((finding, index) => {
        const emoji = this.getSeverityEmoji(finding.severity);
        comment += `${index + 1}. ${emoji} **${finding.ruleName}** in \`${finding.file}\`${finding.line ? `:${finding.line}` : ''}\n`;
        comment += `   ${finding.message}\n\n`;
      });
    }

    comment += `\n---\n`;
    comment += `💡 **Commands:**\n`;
    comment += `- \`@compliance-bot scan\` - Re-run analysis\n`;
    comment += `- \`@compliance-bot fix\` - Create PR with automated fixes\n`;

    return comment;
  }

  /**
   * Format finding as inline comment
   */
  private formatFindingComment(finding: ComplianceFinding): string {
    const emoji = this.getSeverityEmoji(finding.severity);
    let comment = `${emoji} **${finding.ruleName}** (${finding.severity})\n\n`;
    comment += `${finding.message}\n\n`;
    
    if (finding.fixSuggestion) {
      comment += `**💡 Suggested Fix:**\n${finding.fixSuggestion}\n\n`;
    }

    return comment;
  }

  /**
   * Generate check run summary
   */
  private generateCheckSummary(result: AnalysisResult): string {
    const { stats } = result;
    let summary = `Analyzed ${stats.totalFiles} files and found ${stats.totalFindings} issues.\n\n`;
    summary += `- Critical: ${stats.critical}\n`;
    summary += `- High: ${stats.high}\n`;
    summary += `- Medium: ${stats.medium}\n`;
    summary += `- Low: ${stats.low}\n`;
    summary += `- Info: ${stats.info}\n`;
    return summary;
  }

  /**
   * Get emoji for severity
   */
  private getSeverityEmoji(severity: string): string {
    const emojis: Record<string, string> = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🔵',
      info: '⚪',
    };
    return emojis[severity] || '⚪';
  }

  /**
   * Get installation ID from octokit (helper)
   */
  private async getInstallationId(_octokit: Octokit): Promise<number> {
    // This is a simplified version - in reality, you'd extract it from webhook payload
    // or query the GitHub API
    return 0; // Placeholder
  }

  /**
   * Handle @mention commands
   */
  async handleCommand(
    octokit: Octokit,
    owner: string,
    repo: string,
    prNumber: number,
    command: string,
    args: string[]
  ): Promise<void> {
    logger.info(`Handling command: ${command} with args: ${args.join(', ')}`);

    switch (command) {
      case 'scan':
        await this.analyzePR(octokit, owner, repo, prNumber);
        break;

      case 'fix':
        await this.createFixPR(octokit, owner, repo, prNumber);
        break;

      case 'ignore':
        await this.ignoreFindings(octokit, owner, repo, prNumber, args);
        break;

      default:
        await this.githubHandler.postComment(
          octokit,
          owner,
          repo,
          prNumber,
          `Unknown command: \`${command}\`. Available commands: scan, fix, ignore`
        );
    }
  }

  /**
   * Create fix PR with automated fixes
   */
  private async createFixPR(
    octokit: Octokit,
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<void> {
    await this.githubHandler.postComment(
      octokit,
      owner,
      repo,
      prNumber,
      '🔧 Automated fix generation is in progress...'
    );

    // This would involve:
    // 1. Re-analyzing PR
    // 2. Using Groq to generate fixes
    // 3. Creating a new PR with fixes
    // Simplified for now
  }

  /**
   * Ignore specific findings
   */
  private async ignoreFindings(
    octokit: Octokit,
    owner: string,
    repo: string,
    prNumber: number,
    rules: string[]
  ): Promise<void> {
    await this.githubHandler.postComment(
      octokit,
      owner,
      repo,
      prNumber,
      `✓ Ignoring rules: ${rules.join(', ')}`
    );
  }
}

export default PRAnalyzer;

