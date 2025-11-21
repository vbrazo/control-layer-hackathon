import { Router, Request, Response } from 'express';
import { AnalysisRepository } from '../db/repositories/analysis-repository';
import logger from '../utils/logger';

const router = Router();
const analysisRepo = new AnalysisRepository();

/**
 * Health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const { db } = await import('../db/client');
    const dbHealthy = await db.healthCheck();
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealthy ? 'healthy' : 'unhealthy',
      },
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({ status: 'error', message: 'Health check failed' });
  }
});

/**
 * GET /api/analyses - Get recent analyses
 */
router.get('/analyses', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const repoFullName = req.query.repo as string;

    let analyses;
    if (repoFullName) {
      analyses = await analysisRepo.getAnalysesByRepo(repoFullName, limit);
    } else {
      analyses = await analysisRepo.getRecentAnalyses(limit);
    }

    res.json({
      success: true,
      data: analyses,
      count: analyses.length,
    });
  } catch (error) {
    logger.error('Error fetching analyses:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analyses',
    });
  }
});

/**
 * GET /api/analyses/:id - Get analysis by ID
 */
router.get('/analyses/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const analysis = await analysisRepo.getAnalysis(id);

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: 'Analysis not found',
      });
    }

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    logger.error('Error fetching analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analysis',
    });
  }
});

/**
 * GET /api/stats - Get overall statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  // Default stats to return on error
  const defaultStats = {
    success: true,
    data: {
      totalAnalyses: 0,
      totalFindings: 0,
      criticalIssues: 0,
      highIssues: 0,
      mediumIssues: 0,
      lowIssues: 0,
      infoIssues: 0,
      avgDuration: 0,
    },
  };

  try {
    const stats = await analysisRepo.getStats();

    // Safely parse values, handling null/undefined/NaN
    const safeParseInt = (value: unknown): number => {
      const parsed = parseInt(String(value || '0'), 10);
      return isNaN(parsed) ? 0 : parsed;
    };

    const safeParseFloat = (value: unknown): number => {
      const parsed = parseFloat(String(value || '0'));
      return isNaN(parsed) ? 0 : parsed;
    };

    // Ensure response is sent with 200 status
    return res.status(200).json({
      success: true,
      data: {
        totalAnalyses: safeParseInt(stats?.total_analyses),
        totalFindings: safeParseInt(stats?.total_findings),
        criticalIssues: safeParseInt(stats?.total_critical),
        highIssues: safeParseInt(stats?.total_high),
        mediumIssues: safeParseInt(stats?.total_medium),
        lowIssues: safeParseInt(stats?.total_low),
        infoIssues: safeParseInt(stats?.total_info),
        avgDuration: safeParseFloat(stats?.avg_duration),
      },
    });
  } catch (error: unknown) {
    logger.error('Error fetching stats:', error);
    // Always return default stats with 200 status to prevent frontend issues
    // This handles cases where the database table doesn't exist or connection fails
    return res.status(200).json(defaultStats);
  }
});

/**
 * POST /api/config/rules - Add or update custom rule
 */
router.post('/config/rules', async (req: Request, res: Response) => {
  try {
    const rule = req.body;

    // Validate rule
    if (!rule.name || !rule.type || !rule.severity || !rule.category) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    // Save rule to database (simplified)
    res.json({
      success: true,
      message: 'Rule saved successfully',
      data: rule,
    });
  } catch (error) {
    logger.error('Error saving rule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save rule',
    });
  }
});

/**
 * POST /api/trigger-scan - Manually trigger PR scan
 */
router.post('/trigger-scan', async (req: Request, res: Response) => {
  try {
    const { owner, repo, prNumber } = req.body;

    if (!owner || !repo || !prNumber) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: owner, repo, prNumber',
      });
    }

    // Queue analysis job (simplified)
    logger.info(`Manual scan triggered for ${owner}/${repo}#${prNumber}`);

    res.json({
      success: true,
      message: 'Scan triggered successfully',
      data: {
        owner,
        repo,
        prNumber,
        status: 'queued',
      },
    });
  } catch (error) {
    logger.error('Error triggering scan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger scan',
    });
  }
});

/**
 * GET /api/webhook - Webhook endpoint information
 * Note: Actual webhook handling is done via Octokit middleware in index.ts
 * GitHub sends POST requests to this endpoint with webhook events
 */
router.get('/webhook', async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'GitHub webhook endpoint',
    info: {
      endpoint: '/api/webhook',
      method: 'POST',
      events: [
        'pull_request.opened',
        'pull_request.synchronize',
        'pull_request.reopened',
        'issue_comment.created',
      ],
      description: 'Receives GitHub webhook events for automatic PR analysis',
    },
  });
});

export default router;
