import { GitHubAppHandler } from '../../src/github/app-handler';
import { Octokit } from '@octokit/rest';

// Mock @octokit modules
const mockWebhooksOn = jest.fn();
const mockWebhooks = {
  on: mockWebhooksOn,
};

jest.mock('@octokit/app', () => ({
  App: jest.fn().mockImplementation(() => ({
    webhooks: mockWebhooks,
    getInstallationOctokit: jest.fn(),
    octokit: {
      request: jest.fn(),
    },
  })),
}));

jest.mock('@octokit/webhooks', () => ({
  createNodeMiddleware: jest.fn((webhooks) => jest.fn()),
}));

jest.mock('@octokit/rest');

describe('GitHubAppHandler', () => {
  let handler: GitHubAppHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new GitHubAppHandler();
  });

  describe('parseCommand', () => {
    it('should parse scan command', () => {
      const comment = '@compliance-bot scan';
      const result = handler.parseCommand(comment);

      expect(result).toEqual({
        command: 'scan',
        args: [],
      });
    });

    it('should parse fix command', () => {
      const comment = '@compliance-bot fix';
      const result = handler.parseCommand(comment);

      expect(result).toEqual({
        command: 'fix',
        args: [],
      });
    });

    it('should parse command with arguments', () => {
      const comment = '@compliance-bot ignore security-001';
      const result = handler.parseCommand(comment);

      expect(result).toEqual({
        command: 'ignore',
        args: ['security-001'],
      });
    });

    it('should handle alternative bot mentions', () => {
      const comment1 = '@compliance-copilot scan';
      const comment2 = '@compliancebot scan';

      expect(handler.parseCommand(comment1)?.command).toBe('scan');
      expect(handler.parseCommand(comment2)?.command).toBe('scan');
    });

    it('should return null for non-command comments', () => {
      const comment = 'This is just a regular comment';
      const result = handler.parseCommand(comment);

      expect(result).toBeNull();
    });

    it('should handle commands in middle of text', () => {
      const comment = 'Thanks! @compliance-bot scan please';
      const result = handler.parseCommand(comment);

      expect(result?.command).toBe('scan');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify valid signature', () => {
      const payload = JSON.stringify({ test: 'data' });
      const crypto = require('crypto');
      const secret = 'test_webhook_secret';
      
      // Create valid signature
      const hmac = crypto.createHmac('sha256', secret);
      const signature = 'sha256=' + hmac.update(payload).digest('hex');

      // Mock the webhook secret
      (handler as any).webhookSecret = secret;

      const isValid = handler.verifyWebhookSignature(payload, signature);
      
      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = JSON.stringify({ test: 'data' });
      const invalidSignature = 'sha256=invalid_signature';

      (handler as any).webhookSecret = 'test_secret';

      const isValid = handler.verifyWebhookSignature(payload, invalidSignature);
      
      expect(isValid).toBe(false);
    });

    it('should handle verification errors gracefully', () => {
      const payload = JSON.stringify({ test: 'data' });
      const signature = 'malformed';

      const isValid = handler.verifyWebhookSignature(payload, signature);
      
      expect(isValid).toBe(false);
    });
  });

  describe('setupWebhooks', () => {
    it('should register webhook handlers', () => {
      const onPullRequest = jest.fn();
      const onIssueComment = jest.fn();

      handler.setupWebhooks(onPullRequest, onIssueComment);

      // Verify that webhook handlers are set up
      expect((handler as any).app.webhooks.on).toBeDefined();
    });
  });

  describe('getWebhookMiddleware', () => {
    it('should return webhook middleware', () => {
      const middleware = handler.getWebhookMiddleware();

      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });
  });

  describe('postComment', () => {
    it('should post comment successfully', async () => {
      const mockOctokit = {
        issues: {
          createComment: jest.fn().mockResolvedValue({ data: { id: 123 } }),
        },
      } as unknown as Octokit;

      await handler.postComment(
        mockOctokit,
        'owner',
        'repo',
        1,
        'Test comment'
      );

      expect(mockOctokit.issues.createComment).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 1,
        body: 'Test comment',
      });
    });

    it('should handle errors when posting comment', async () => {
      const mockOctokit = {
        issues: {
          createComment: jest.fn().mockRejectedValue(new Error('API error')),
        },
      } as unknown as Octokit;

      await expect(
        handler.postComment(mockOctokit, 'owner', 'repo', 1, 'Test')
      ).rejects.toThrow('API error');
    });
  });

  describe('postReviewComment', () => {
    it('should post review comment on specific line', async () => {
      const mockOctokit = {
        pulls: {
          createReviewComment: jest.fn().mockResolvedValue({ data: { id: 456 } }),
        },
      } as unknown as Octokit;

      await handler.postReviewComment(
        mockOctokit,
        'owner',
        'repo',
        1,
        'Security issue found',
        'abc123',
        'src/file.js',
        10
      );

      expect(mockOctokit.pulls.createReviewComment).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        pull_number: 1,
        body: 'Security issue found',
        commit_id: 'abc123',
        path: 'src/file.js',
        line: 10,
      });
    });
  });

  describe('createCheckRun', () => {
    it('should create check run successfully', async () => {
      const mockOctokit = {
        checks: {
          create: jest.fn().mockResolvedValue({ data: { id: 789 } }),
        },
      } as unknown as Octokit;

      const checkRunId = await handler.createCheckRun(
        mockOctokit,
        'owner',
        'repo',
        'abc123',
        'Compliance Check',
        'in_progress'
      );

      expect(checkRunId).toBe(789);
      expect(mockOctokit.checks.create).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        name: 'Compliance Check',
        head_sha: 'abc123',
        status: 'in_progress',
      });
    });

    it('should create completed check run with conclusion', async () => {
      const mockOctokit = {
        checks: {
          create: jest.fn().mockResolvedValue({ data: { id: 789 } }),
        },
      } as unknown as Octokit;

      await handler.createCheckRun(
        mockOctokit,
        'owner',
        'repo',
        'abc123',
        'Compliance Check',
        'completed',
        'success'
      );

      expect(mockOctokit.checks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          conclusion: 'success',
        })
      );
    });
  });

  describe('updateCheckRun', () => {
    it('should update check run with output', async () => {
      const mockOctokit = {
        checks: {
          update: jest.fn().mockResolvedValue({ data: {} }),
        },
      } as unknown as Octokit;

      await handler.updateCheckRun(
        mockOctokit,
        'owner',
        'repo',
        789,
        'completed',
        'failure',
        {
          title: 'Compliance Issues Found',
          summary: '5 issues found',
          text: 'Detailed results...',
        }
      );

      expect(mockOctokit.checks.update).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        check_run_id: 789,
        status: 'completed',
        conclusion: 'failure',
        output: {
          title: 'Compliance Issues Found',
          summary: '5 issues found',
          text: 'Detailed results...',
        },
      });
    });
  });

  describe('getPRFiles', () => {
    it('should fetch PR files', async () => {
      const mockFiles = [
        { filename: 'file1.js', status: 'modified' },
        { filename: 'file2.js', status: 'added' },
      ];

      const mockOctokit = {
        pulls: {
          listFiles: jest.fn().mockResolvedValue({ data: mockFiles }),
        },
      } as unknown as Octokit;

      const files = await handler.getPRFiles(mockOctokit, 'owner', 'repo', 1);

      expect(files).toEqual(mockFiles);
      expect(mockOctokit.pulls.listFiles).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        pull_number: 1,
        per_page: 100,
      });
    });
  });

  describe('getFileContent', () => {
    it('should fetch and decode file content', async () => {
      const content = Buffer.from('file content').toString('base64');
      
      const mockOctokit = {
        repos: {
          getContent: jest.fn().mockResolvedValue({
            data: { content, encoding: 'base64' },
          }),
        },
      } as unknown as Octokit;

      const fileContent = await handler.getFileContent(
        mockOctokit,
        'owner',
        'repo',
        'path/to/file.js',
        'main'
      );

      expect(fileContent).toBe('file content');
    });

    it('should handle missing content', async () => {
      const mockOctokit = {
        repos: {
          getContent: jest.fn().mockResolvedValue({
            data: { type: 'directory' },
          }),
        },
      } as unknown as Octokit;

      await expect(
        handler.getFileContent(mockOctokit, 'owner', 'repo', 'dir', 'main')
      ).rejects.toThrow('File content not available');
    });
  });

  describe('getInstallationToken', () => {
    it('should get installation access token', async () => {
      const mockToken = 'ghs_test_token';
      
      (handler as any).app.octokit = {
        request: jest.fn().mockResolvedValue({
          data: { token: mockToken },
        }),
      };

      const token = await handler.getInstallationToken(12345);

      expect(token).toBe(mockToken);
    });
  });
});
