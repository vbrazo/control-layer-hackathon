import { AnalysisRepository } from '../../src/db/repositories/analysis-repository';
import { db } from '../../src/db/client';
import { AnalysisResult } from '../../src/types';

// Mock database client
jest.mock('../../src/db/client');

describe('AnalysisRepository', () => {
  let repository: AnalysisRepository;
  let mockQuery: jest.Mock;
  let mockRelease: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    repository = new AnalysisRepository();
    mockQuery = jest.fn();
    mockRelease = jest.fn();
    
    // Mock db.query
    (db as  any).query = mockQuery;
    
    // Mock db.getClient for transactions
    (db as any).getClient = jest.fn().mockResolvedValue({
      query: mockQuery,
      release: mockRelease,
    });
  });

  describe('saveAnalysis', () => {
    it('should save analysis result successfully', async () => {
      const analysisResult: AnalysisResult = {
        id: 'test-analysis-1',
        repoFullName: 'owner/repo',
        prNumber: 123,
        status: 'completed',
        findings: [
          {
            id: 'finding-1',
            type: 'security',
            severity: 'high',
            message: 'SQL injection detected',
            file: 'db.js',
            line: 10,
            ruleId: 'sql-injection',
            ruleName: 'SQL Injection',
          },
        ],
        analyzedAt: new Date(),
        duration: 30,
        stats: {
          totalFiles: 5,
          totalFindings: 1,
          critical: 0,
          high: 1,
          medium: 0,
          low: 0,
          info: 0,
        },
      };

      mockQuery.mockResolvedValue({ rowCount: 1 });

      await repository.saveAnalysis(analysisResult);

      expect(mockQuery).toHaveBeenCalled();
      // First call is BEGIN, second is the INSERT
      expect(mockQuery.mock.calls.length).toBeGreaterThanOrEqual(1);
      const insertCall = mockQuery.mock.calls.find(call => call[0].includes('INSERT INTO analyses'));
      expect(insertCall).toBeDefined();
    });

    it('should handle save errors', async () => {
      const analysisResult: any = {
        id: 'test-analysis-1',
        repoFullName: 'owner/repo',
        prNumber: 123,
        status: 'completed',
      };

      mockQuery.mockRejectedValue(new Error('Database error'));

      await expect(repository.saveAnalysis(analysisResult)).rejects.toThrow(
        'Database error'
      );
    });
  });

  describe('getAnalysis', () => {
    it('should retrieve analysis by ID', async () => {
      const mockAnalysis = {
        id: 'test-analysis-1',
        repo_full_name: 'owner/repo',
        pr_number: 123,
        status: 'completed',
        analyzed_at: new Date(),
        duration: 30,
        total_files: 5,
        total_findings: 1,
        critical_count: 0,
        high_count: 1,
        medium_count: 0,
        low_count: 0,
        info_count: 0,
      };

      const mockFindings = [
        {
          id: 'finding-1',
          type: 'security',
          severity: 'high',
          message: 'Test finding',
          file: 'test.js',
          line: 10,
          column: null,
          code: null,
          fix_suggestion: null,
          rule_id: 'test-rule',
          rule_name: 'Test Rule',
        },
      ];

      mockQuery
        .mockResolvedValueOnce({ rows: [mockAnalysis] })
        .mockResolvedValueOnce({ rows: mockFindings });

      const result = await repository.getAnalysis('test-analysis-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('test-analysis-1');
      expect(result?.prNumber).toBe(123);
      expect(result?.repoFullName).toBe('owner/repo');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM analyses'),
        ['test-analysis-1']
      );
    });

    it('should return null when analysis not found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await repository.getAnalysis('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getRecentAnalyses', () => {
    it('should retrieve recent analyses with default limit', async () => {
      const mockAnalyses = [
        {
          id: 'analysis-1',
          repo_full_name: 'owner/repo1',
          pr_number: 1,
          status: 'completed',
          analyzed_at: new Date(),
          duration: 30,
          total_files: 5,
          total_findings: 1,
          critical_count: 0,
          high_count: 1,
          medium_count: 0,
          low_count: 0,
          info_count: 0,
        },
        {
          id: 'analysis-2',
          repo_full_name: 'owner/repo2',
          pr_number: 2,
          status: 'completed',
          analyzed_at: new Date(),
          duration: 25,
          total_files: 3,
          total_findings: 0,
          critical_count: 0,
          high_count: 0,
          medium_count: 0,
          low_count: 0,
          info_count: 0,
        },
      ];

      // Mock for analyses query and findings queries
      mockQuery
        .mockResolvedValueOnce({ rows: mockAnalyses })
        .mockResolvedValue({ rows: [] }); // Empty findings for each analysis

      const result = await repository.getRecentAnalyses();

      expect(result).toBeDefined();
      expect(result.length).toBe(2);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY analyzed_at DESC'),
        [50]
      );
    });

    it('should respect custom limit', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await repository.getRecentAnalyses(10);

      expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [10]);
    });
  });

  describe('getAnalysesByRepo', () => {
    it('should retrieve analyses for specific repository', async () => {
      const mockAnalyses = [
        {
          id: 'analysis-1',
          repo_full_name: 'owner/repo',
          pr_number: 1,
          status: 'completed',
          analyzed_at: new Date(),
          duration: 30,
          total_files: 5,
          total_findings: 1,
          critical_count: 0,
          high_count: 1,
          medium_count: 0,
          low_count: 0,
          info_count: 0,
        },
        {
          id: 'analysis-2',
          repo_full_name: 'owner/repo',
          pr_number: 2,
          status: 'completed',
          analyzed_at: new Date(),
          duration: 25,
          total_files: 3,
          total_findings: 0,
          critical_count: 0,
          high_count: 0,
          medium_count: 0,
          low_count: 0,
          info_count: 0,
        },
      ];

      mockQuery
        .mockResolvedValueOnce({ rows: mockAnalyses })
        .mockResolvedValue({ rows: [] });

      const result = await repository.getAnalysesByRepo('owner/repo');

      expect(result).toBeDefined();
      expect(result.length).toBe(2);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE repo_full_name = $1'),
        ['owner/repo', 50]
      );
    });

    it('should respect custom limit', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await repository.getAnalysesByRepo('owner/repo', 25);

      expect(mockQuery).toHaveBeenCalledWith(expect.any(String), ['owner/repo', 25]);
    });
  });

  describe('getStats', () => {
    it('should retrieve overall statistics', async () => {
      const mockStats = {
        total_analyses: 100,
        total_findings: 500,
        total_critical: 50,
        total_high: 100,
        total_medium: 200,
        total_low: 100,
        total_info: 50,
        avg_duration: 45.5,
      };

      mockQuery.mockResolvedValue({ rows: [mockStats] });

      const result = await repository.getStats();

      expect(result).toEqual(mockStats);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT')
      );
    });

    it('should handle empty statistics', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await repository.getStats();

      // Should return default stats when no rows found
      expect(result).toEqual({
        total_analyses: '0',
        total_findings: '0',
        total_critical: '0',
        total_high: '0',
        total_medium: '0',
        total_low: '0',
        total_info: '0',
        avg_duration: '0',
      });
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors', async () => {
      mockQuery.mockRejectedValue(new Error('Connection failed'));

      await expect(repository.getAnalysis('test-id')).rejects.toThrow('Connection failed');
    });

    it('should handle malformed data gracefully', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await repository.getRecentAnalyses();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });
});
