import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import config from './config';
import logger from './utils/logger';
import apiRoutes from './api/routes';
import { GitHubAppHandler } from './github/app-handler';
import { PRAnalyzer } from './github/pr-analyzer';
import { AnalysisRepository } from './db/repositories/analysis-repository';
import { db } from './db/client';

const app: Application = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health check endpoint (before other routes)
app.get('/health', async (req: Request, res: Response) => {
  try {
    const dbHealthy = await db.healthCheck();
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealthy ? 'healthy' : 'unhealthy',
        e2b: 'configured',
        groq: 'configured',
      },
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({ status: 'error' });
  }
});

// API routes
app.use('/api', apiRoutes);

// Initialize GitHub App and webhook handlers
const githubHandler = new GitHubAppHandler();
const prAnalyzer = new PRAnalyzer(githubHandler);
const analysisRepo = new AnalysisRepository();

// Setup webhook handlers
githubHandler.setupWebhooks(
  // Handle pull request events
  async ({ payload, octokit }) => {
    try {
      const { repository, pull_request, installation } = payload;
      
      if (!installation) {
        logger.warn('No installation found in webhook payload');
        return;
      }

      logger.info(
        `Processing PR event: ${repository.full_name}#${pull_request.number}`
      );

      // Run analysis
      const result = await prAnalyzer.analyzePR(
        octokit,
        repository.owner.login,
        repository.name,
        pull_request.number
      );

      // Save to database
      await analysisRepo.saveAnalysis(result);

      logger.info(
        `Analysis complete: ${result.findings.length} findings`
      );
    } catch (error) {
      logger.error('Error processing PR webhook:', error);
    }
  },
  // Handle issue comment events
  async ({ payload, octokit }) => {
    try {
      const { repository, issue, comment, installation } = payload;
      
      if (!installation) {
        logger.warn('No installation found in webhook payload');
        return;
      }

      // Parse command from comment
      const parsedCommand = githubHandler.parseCommand(comment.body);
      
      if (parsedCommand) {
        logger.info(
          `Processing command: ${parsedCommand.command} on ${repository.full_name}#${issue.number}`
        );

        await prAnalyzer.handleCommand(
          octokit,
          repository.owner.login,
          repository.name,
          issue.number,
          parsedCommand.command,
          parsedCommand.args
        );
      }
    } catch (error) {
      logger.error('Error processing comment webhook:', error);
    }
  }
);

// Mount GitHub webhooks
app.use(githubHandler.getWebhookMiddleware());

// Error handling middleware
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: config.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

// Start server
const PORT = config.PORT;

async function startServer() {
  try {
    // Check database connection
    const dbHealthy = await db.healthCheck();
    if (!dbHealthy) {
      logger.error('Database health check failed');
      process.exit(1);
    }

    app.listen(PORT, () => {
      logger.info(`🚀 Server started on port ${PORT}`);
      logger.info(`📊 Environment: ${config.NODE_ENV}`);
      logger.info(`🔒 GitHub App ID: ${config.GITHUB_APP_ID}`);
      logger.info(`🤖 E2B API configured`);
      logger.info(`⚡ Groq AI configured (${config.GROQ_MODEL})`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  await db.close();
  process.exit(0);
});

// Start the server
startServer();

export default app;

