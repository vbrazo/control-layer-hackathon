import { E2BAgent } from '../../src/agent/e2b-agent';
import { ChangedFile, E2BAnalysisContext, PRContext } from '../../src/types';

// Mock E2B SDK
jest.mock('@e2b/code-interpreter', () => ({
  __esModule: true,
  default: {
    create: jest.fn().mockResolvedValue({
      sandboxId: 'test-sandbox-id',
      runPythonCode: jest.fn().mockResolvedValue({
        text: '{"findings": []}',
        stdout: [],
        stderr: [],
      }),
      kill: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

describe('E2BAgent', () => {
  let agent: E2BAgent;
  const mockGithubToken = 'test_github_token';

  beforeEach(() => {
    jest.clearAllMocks();
    agent = new E2BAgent(mockGithubToken);
  });

  describe('analyzeWithMCP', () => {
    it('should analyze files using E2B sandbox', async () => {
      const files: ChangedFile[] = [
        {
          filename: 'test.js',
          status: 'modified',
          additions: 5,
          deletions: 2,
          content: 'const secret = "my-api-key";',
        },
      ];

      const prContext: PRContext = {
        owner: 'testowner',
        repo: 'testrepo',
        prNumber: 1,
        branch: 'feature',
        baseBranch: 'main',
        author: 'testuser',
        title: 'Test PR',
        description: 'Test description',
        changedFiles: files,
      };

      const context: E2BAnalysisContext = {
        files,
        customRules: [],
        prContext,
      };

      const result = await agent.analyzeWithMCP(context);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle empty files array', async () => {
      const prContext: PRContext = {
        owner: 'testowner',
        repo: 'testrepo',
        prNumber: 1,
        branch: 'feature',
        baseBranch: 'main',
        author: 'testuser',
        title: 'Test PR',
        description: 'Test description',
        changedFiles: [],
      };

      const context: E2BAnalysisContext = {
        files: [],
        customRules: [],
        prContext,
      };

      const result = await agent.analyzeWithMCP(context);

      expect(result).toBeDefined();
    });

    it('should handle analysis errors gracefully', async () => {
      const CodeInterpreter = require('@e2b/code-interpreter').default;
      CodeInterpreter.create = jest.fn().mockResolvedValue({
        sandboxId: 'test-id',
        runPythonCode: jest.fn().mockRejectedValue(new Error('Sandbox error')),
        kill: jest.fn(),
      });

      const files: ChangedFile[] = [
        {
          filename: 'test.js',
          status: 'modified',
          additions: 1,
          deletions: 0,
          content: 'test content',
        },
      ];

      const prContext: PRContext = {
        owner: 'testowner',
        repo: 'testrepo',
        prNumber: 1,
        branch: 'feature',
        baseBranch: 'main',
        author: 'testuser',
        title: 'Test PR',
        description: 'Test description',
        changedFiles: files,
      };

      const context: E2BAnalysisContext = {
        files,
        customRules: [],
        prContext,
      };

      await expect(agent.analyzeWithMCP(context)).rejects.toThrow();
    });
  });

  describe('initialize', () => {
    it('should initialize E2B sandbox', async () => {
      const CodeInterpreter = require('@e2b/code-interpreter').default;
      CodeInterpreter.create.mockResolvedValueOnce({
        sandboxId: 'test-sandbox-id',
        runPythonCode: jest.fn().mockResolvedValue({ text: 'Installation complete' }),
        kill: jest.fn(),
      });

      await agent.initialize();

      const info = agent.getSandboxInfo();
      expect(info.sandboxId).toBe('test-sandbox-id');
      expect(info.status).toBe('running');
    });

    it('should handle initialization errors', async () => {
      const CodeInterpreter = require('@e2b/code-interpreter').default;
      CodeInterpreter.create = jest.fn().mockRejectedValue(new Error('Init error'));

      const newAgent = new E2BAgent(mockGithubToken);
      await expect(newAgent.initialize()).rejects.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should close sandbox properly', async () => {
      const mockKill = jest.fn();
      const CodeInterpreter = require('@e2b/code-interpreter').default;
      CodeInterpreter.create.mockResolvedValueOnce({
        sandboxId: 'test-sandbox-id',
        runPythonCode: jest.fn().mockResolvedValue({ text: 'Done' }),
        kill: mockKill,
      });

      await agent.initialize();
      await agent.cleanup();

      const info = agent.getSandboxInfo();
      expect(info.status).toBe('not_initialized');
      expect(mockKill).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      const CodeInterpreter = require('@e2b/code-interpreter').default;
      CodeInterpreter.create = jest.fn().mockResolvedValue({
        sandboxId: 'test-id',
        runPythonCode: jest.fn(),
        kill: jest.fn().mockRejectedValue(new Error('Cleanup error')),
      });

      const newAgent = new E2BAgent(mockGithubToken);
      await newAgent.initialize();
      
      // Should not throw
      await expect(newAgent.cleanup()).resolves.not.toThrow();
    });
  });

  describe('getSandboxInfo', () => {
    it('should return sandbox info when initialized', async () => {
      const CodeInterpreter = require('@e2b/code-interpreter').default;
      CodeInterpreter.create.mockResolvedValueOnce({
        sandboxId: 'test-sandbox-id',
        runPythonCode: jest.fn().mockResolvedValue({ text: 'OK' }),
        kill: jest.fn(),
      });

      await agent.initialize();
      
      const info = agent.getSandboxInfo();
      expect(info.sandboxId).toBe('test-sandbox-id');
      expect(info.status).toBe('running');
    });
    
    it('should return not_initialized when sandbox not created', () => {
      const newAgent = new E2BAgent(mockGithubToken);
      const info = newAgent.getSandboxInfo();
      expect(info.sandboxId).toBeNull();
      expect(info.status).toBe('not_initialized');
    });
  });

  describe('runSecurityScan', () => {
    it('should run security scan on files', async () => {
      const CodeInterpreter = require('@e2b/code-interpreter').default;
      CodeInterpreter.create.mockResolvedValueOnce({
        sandboxId: 'test-scan-id',
        runPythonCode: jest.fn().mockResolvedValue({ text: '{"findings": []}' }),
        kill: jest.fn(),
      });

      const files: ChangedFile[] = [
        {
          filename: 'auth.js',
          status: 'modified',
          additions: 10,
          deletions: 5,
          content: 'function authenticate(password) { /* ... */ }',
        },
      ];

      const findings = await agent.runSecurityScan(files);

      expect(Array.isArray(findings)).toBe(true);
    });

    it('should handle security scan errors gracefully', async () => {
      const mockRunPython = jest.fn()
        .mockResolvedValueOnce({ text: 'Install complete' })  // For npm install in setupMCPServers
        .mockResolvedValueOnce({ text: 'GitHub MCP configured' })  // For GitHub config in setupMCPServers
        .mockResolvedValueOnce({ text: 'Workspace setup' })  // For setupWorkspace
        .mockRejectedValueOnce(new Error('Scan error'));  // For runAnalysis - this one fails
      
      const CodeInterpreter = require('@e2b/code-interpreter').default;
      CodeInterpreter.create.mockResolvedValueOnce({
        sandboxId: 'test-error-id',
        runPythonCode: mockRunPython,
        kill: jest.fn(),
      });

      const newAgent = new E2BAgent(mockGithubToken);
      
      const files: ChangedFile[] = [
        {
          filename: 'test.js',
          status: 'modified',
          additions: 1,
          deletions: 0,
          content: 'test',
        },
      ];

      const findings = await newAgent.runSecurityScan(files);
      
      // Should return empty array on error
      expect(Array.isArray(findings)).toBe(true);
      expect(findings.length).toBe(0);
    });
  });

  describe('fetchFileFromGitHub', () => {
    it('should fetch file from GitHub using MCP', async () => {
      const CodeInterpreter = require('@e2b/code-interpreter').default;
      CodeInterpreter.create.mockResolvedValueOnce({
        sandboxId: 'test-fetch-id',
        runPythonCode: jest.fn().mockResolvedValue({ text: 'file content' }),
        kill: jest.fn(),
      });

      const result = await agent.fetchFileFromGitHub('owner', 'repo', 'path/to/file.js');

      expect(result).toBeDefined();
    });

    it('should handle fetch errors', async () => {
      const CodeInterpreter = require('@e2b/code-interpreter').default;
      CodeInterpreter.create = jest.fn().mockResolvedValue({
        sandboxId: 'test-id',
        runPythonCode: jest.fn().mockResolvedValue({ text: '{"error": "Not found"}' }),
        kill: jest.fn(),
      });

      const newAgent = new E2BAgent(mockGithubToken);
      const result = await newAgent.fetchFileFromGitHub('owner', 'repo', 'invalid.js');

      expect(result).toBeNull();
    });
  });
});

