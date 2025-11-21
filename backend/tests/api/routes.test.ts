import request from 'supertest';
import express, { Application } from 'express';
import { db } from '../../src/db/client';

// Mock dependencies before importing routes
jest.mock('../../src/db/client');
jest.mock('../../src/db/repositories/analysis-repository');

// Import after mocking
import apiRoutes from '../../src/api/routes';
import { AnalysisRepository } from '../../src/db/repositories/analysis-repository';

describe('API Routes', () => {
  let app: Application;

  beforeEach(() => {
    jest.clearAllMocks();
    
    app = express();
    app.use(express.json());
    app.use('/api', apiRoutes);
  });

  describe('GET /api/health', () => {
    it('should return health status when database is healthy', async () => {
      (db.healthCheck as jest.Mock) = jest.fn().mockResolvedValue(true);

      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'ok',
        services: {
          database: 'healthy',
        },
      });
      expect(response.body.timestamp).toBeDefined();
    });

    it('should return health status when database is unhealthy', async () => {
      (db.healthCheck as jest.Mock) = jest.fn().mockResolvedValue(false);

      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.services.database).toBe('unhealthy');
    });

    it('should handle health check errors', async () => {
      (db.healthCheck as jest.Mock) = jest.fn().mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/health');

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        status: 'error',
        message: 'Health check failed',
      });
    });
  });

  describe('GET /api/analyses', () => {
    it('should return recent analyses', async () => {
      const mockAnalyses = [
        {
          id: 'analysis-1',
          repo_full_name: 'owner/repo',
          pr_number: 1,
          status: 'completed',
          created_at: new Date().toISOString(),
        },
        {
          id: 'analysis-2',
          repo_full_name: 'owner/repo2',
          pr_number: 2,
          status: 'completed',
          created_at: new Date().toISOString(),
        },
      ];

      jest.spyOn(AnalysisRepository.prototype, 'getRecentAnalyses').mockResolvedValue(mockAnalyses as any);

      const response = await request(app).get('/api/analyses');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAnalyses);
      expect(response.body.count).toBe(2);
    });

    it('should filter analyses by repo', async () => {
      const mockAnalyses = [
        {
          id: 'analysis-1',
          repo_full_name: 'owner/repo',
          pr_number: 1,
          status: 'completed',
        },
      ];

      jest.spyOn(AnalysisRepository.prototype, 'getAnalysesByRepo').mockResolvedValue(mockAnalyses as any);

      const response = await request(app).get('/api/analyses?repo=owner/repo');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockAnalyses);
    });

    it('should respect limit parameter', async () => {
      const spy = jest.spyOn(AnalysisRepository.prototype, 'getRecentAnalyses').mockResolvedValue([]);

      await request(app).get('/api/analyses?limit=10');

      expect(spy).toHaveBeenCalledWith(10);
    });

    it('should handle errors', async () => {
      jest.spyOn(AnalysisRepository.prototype, 'getRecentAnalyses').mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/analyses');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch analyses');
    });
  });

  describe('GET /api/analyses/:id', () => {
    it('should return analysis by ID', async () => {
      const mockAnalysis = {
        id: 'analysis-1',
        repo_full_name: 'owner/repo',
        pr_number: 1,
        status: 'completed',
        findings: [],
      };

      jest.spyOn(AnalysisRepository.prototype, 'getAnalysis').mockResolvedValue(mockAnalysis as any);

      const response = await request(app).get('/api/analyses/analysis-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAnalysis);
    });

    it('should return 404 when analysis not found', async () => {
      jest.spyOn(AnalysisRepository.prototype, 'getAnalysis').mockResolvedValue(null);

      const response = await request(app).get('/api/analyses/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Analysis not found');
    });

    it('should handle errors', async () => {
      jest.spyOn(AnalysisRepository.prototype, 'getAnalysis').mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/analyses/analysis-1');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/stats', () => {
    it('should return statistics', async () => {
      const mockStats = {
        total_analyses: '10',
        total_findings: '50',
        total_critical: '5',
        total_high: '10',
        total_medium: '20',
        total_low: '10',
        total_info: '5',
        avg_duration: '30.5',
      };

      jest.spyOn(AnalysisRepository.prototype, 'getStats').mockResolvedValue(mockStats as any);

      const response = await request(app).get('/api/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        totalAnalyses: 10,
        totalFindings: 50,
        criticalIssues: 5,
        highIssues: 10,
        mediumIssues: 20,
        lowIssues: 10,
        infoIssues: 5,
        avgDuration: 30.5,
      });
    });

    it('should handle null values safely', async () => {
      const mockStats = {
        total_analyses: null,
        total_findings: undefined,
        total_critical: 'invalid',
        avg_duration: NaN,
      };

      jest.spyOn(AnalysisRepository.prototype, 'getStats').mockResolvedValueOnce(mockStats as any);

      const response = await request(app).get('/api/stats');

      expect(response.status).toBe(200);
      expect(response.body.data.totalAnalyses).toBe(0);
      expect(response.body.data.totalFindings).toBe(0);
      expect(response.body.data.criticalIssues).toBe(0);
      expect(response.body.data.avgDuration).toBe(0);
    });

    it('should return default stats on error', async () => {
      jest.spyOn(AnalysisRepository.prototype, 'getStats').mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app).get('/api/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        totalAnalyses: 0,
        totalFindings: 0,
        criticalIssues: 0,
      });
    });
  });

  describe('POST /api/config/rules', () => {
    it('should save a valid rule', async () => {
      const rule = {
        name: 'Test Rule',
        type: 'regex',
        severity: 'high',
        category: 'custom',
        pattern: 'test.*pattern',
      };

      const response = await request(app)
        .post('/api/config/rules')
        .send(rule);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Rule saved successfully');
      expect(response.body.data).toMatchObject(rule);
    });

    it('should reject rule with missing fields', async () => {
      const incompleteRule = {
        name: 'Test Rule',
        // missing type, severity, category
      };

      const response = await request(app)
        .post('/api/config/rules')
        .send(incompleteRule);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Missing required fields');
    });
  });

  describe('POST /api/trigger-scan', () => {
    it('should trigger scan with valid parameters', async () => {
      const scanParams = {
        owner: 'testowner',
        repo: 'testrepo',
        prNumber: 123,
      };

      const response = await request(app)
        .post('/api/trigger-scan')
        .send(scanParams);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Scan triggered successfully');
      expect(response.body.data).toMatchObject({
        owner: 'testowner',
        repo: 'testrepo',
        prNumber: 123,
        status: 'queued',
      });
    });

    it('should reject scan with missing parameters', async () => {
      const response = await request(app)
        .post('/api/trigger-scan')
        .send({ owner: 'testowner' }); // missing repo and prNumber

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required parameters');
    });
  });

  describe('GET /api/webhook', () => {
    it('should return webhook information', async () => {
      const response = await request(app).get('/api/webhook');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('GitHub webhook endpoint');
      expect(response.body.info.endpoint).toBe('/api/webhook');
      expect(response.body.info.method).toBe('POST');
      expect(response.body.info.events).toContain('pull_request.opened');
    });
  });
});
