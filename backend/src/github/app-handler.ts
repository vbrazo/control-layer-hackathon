import { App } from '@octokit/app';
import { Octokit } from '@octokit/rest';
import { createNodeMiddleware, EmitterWebhookEvent } from '@octokit/webhooks';
import crypto from 'crypto';
import config from '../config';
import logger from '../utils/logger';

// Type definitions for webhook events
type PullRequestPayload = EmitterWebhookEvent<'pull_request.opened'>['payload'] | 
  EmitterWebhookEvent<'pull_request.synchronize'>['payload'] | 
  EmitterWebhookEvent<'pull_request.reopened'>['payload'];

type IssueCommentPayload = EmitterWebhookEvent<'issue_comment.created'>['payload'];

export interface PullRequestEvent {
  payload: PullRequestPayload;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  octokit: any;
}

export interface IssueCommentEvent {
  payload: IssueCommentPayload;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  octokit: any;
}

export class GitHubAppHandler {
  private app: App;
  private webhookSecret: string;

  constructor() {
    this.app = new App({
      appId: config.GITHUB_APP_ID,
      privateKey: config.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n'),
      webhooks: {
        secret: config.GITHUB_WEBHOOK_SECRET,
      },
    });

    this.webhookSecret = config.GITHUB_WEBHOOK_SECRET;
    logger.info('GitHub App handler initialized');
  }

  /**
   * Get Octokit instance for an installation
   */
  async getOctokit(installationId: number): Promise<Octokit> {
    const octokit = await this.app.getInstallationOctokit(installationId);
    return octokit as unknown as Octokit;
  }

  /**
   * Get installation access token
   */
  async getInstallationToken(installationId: number): Promise<string> {
    const response = await this.app.octokit.request(
      'POST /app/installations/{installation_id}/access_tokens',
      {
        installation_id: installationId,
      }
    );
    return response.data.token;
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      const hmac = crypto.createHmac('sha256', this.webhookSecret);
      const digest = 'sha256=' + hmac.update(payload).digest('hex');
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
    } catch (error) {
      logger.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  /**
   * Setup webhook event handlers
   */
  setupWebhooks(
    onPullRequest: (event: PullRequestEvent) => Promise<void>,
    onIssueComment: (event: IssueCommentEvent) => Promise<void>
  ): void {
    // Handle pull_request events
    this.app.webhooks.on('pull_request.opened', async (event) => {
      logger.info(`PR opened: ${event.payload.repository.full_name}#${event.payload.pull_request.number}`);
      await onPullRequest(event);
    });

    this.app.webhooks.on('pull_request.synchronize', async (event) => {
      logger.info(`PR updated: ${event.payload.repository.full_name}#${event.payload.pull_request.number}`);
      await onPullRequest(event);
    });

    this.app.webhooks.on('pull_request.reopened', async (event) => {
      logger.info(`PR reopened: ${event.payload.repository.full_name}#${event.payload.pull_request.number}`);
      await onPullRequest(event);
    });

    // Handle issue_comment events (for @mention commands)
    this.app.webhooks.on('issue_comment.created', async (event) => {
      // Check if comment is on a PR
      if (event.payload.issue.pull_request) {
        logger.info(`Comment on PR: ${event.payload.repository.full_name}#${event.payload.issue.number}`);
        await onIssueComment(event);
      }
    });

    logger.info('Webhook handlers registered');
  }

  /**
   * Get webhook middleware for Express
   */
  getWebhookMiddleware() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return createNodeMiddleware(this.app.webhooks as any, {
      path: '/api/webhook',
    });
  }

  /**
   * Parse @mention commands from comment
   */
  parseCommand(commentBody: string): { command: string; args: string[] } | null {
    const botMentions = [
      '@compliance-bot',
      '@compliance-copilot',
      '@compliancebot',
    ];

    let command: string | null = null;
    
    for (const mention of botMentions) {
      if (commentBody.includes(mention)) {
        const commandMatch = commentBody.match(
          new RegExp(`${mention}\\s+(\\w+)(?:\\s+(.*))?`)
        );
        
        if (commandMatch) {
          command = commandMatch[1];
          const args = commandMatch[2]?.split(/\s+/) || [];
          return { command: command.toLowerCase(), args };
        }
      }
    }

    return null;
  }

  /**
   * Post comment on PR
   */
  async postComment(
    octokit: Octokit,
    owner: string,
    repo: string,
    issueNumber: number,
    body: string
  ): Promise<void> {
    try {
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body,
      });
      logger.info(`Posted comment on ${owner}/${repo}#${issueNumber}`);
    } catch (error) {
      logger.error('Error posting comment:', error);
      throw error;
    }
  }

  /**
   * Post review comment on specific line
   */
  async postReviewComment(
    octokit: Octokit,
    owner: string,
    repo: string,
    prNumber: number,
    body: string,
    commitId: string,
    path: string,
    line: number
  ): Promise<void> {
    try {
      await octokit.pulls.createReviewComment({
        owner,
        repo,
        pull_number: prNumber,
        body,
        commit_id: commitId,
        path,
        line,
      });
      logger.info(`Posted review comment on ${path}:${line}`);
    } catch (error) {
      logger.error('Error posting review comment:', error);
      throw error;
    }
  }

  /**
   * Create a check run for PR status
   */
  async createCheckRun(
    octokit: Octokit,
    owner: string,
    repo: string,
    headSha: string,
    name: string,
    status: 'queued' | 'in_progress' | 'completed',
    conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped'
  ): Promise<number> {
    try {
      const response = await octokit.checks.create({
        owner,
        repo,
        name,
        head_sha: headSha,
        status,
        ...(conclusion && { conclusion }),
      });
      
      logger.info(`Created check run: ${name} (${status})`);
      return response.data.id;
    } catch (error) {
      logger.error('Error creating check run:', error);
      throw error;
    }
  }

  /**
   * Update check run
   */
  async updateCheckRun(
    octokit: Octokit,
    owner: string,
    repo: string,
    checkRunId: number,
    status: 'queued' | 'in_progress' | 'completed',
    conclusion?: 'success' | 'failure' | 'neutral',
    output?: {
      title: string;
      summary: string;
      text?: string;
    }
  ): Promise<void> {
    try {
      await octokit.checks.update({
        owner,
        repo,
        check_run_id: checkRunId,
        status,
        ...(conclusion && { conclusion }),
        ...(output && { output }),
      });
      
      logger.info(`Updated check run ${checkRunId}: ${status}`);
    } catch (error) {
      logger.error('Error updating check run:', error);
      throw error;
    }
  }

  /**
   * Get PR files
   */
  async getPRFiles(
    octokit: Octokit,
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<Array<Record<string, unknown>>> {
    try {
      const { data: files } = await octokit.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber,
        per_page: 100,
      });
      
      logger.info(`Fetched ${files.length} files from PR #${prNumber}`);
      return files;
    } catch (error) {
      logger.error('Error fetching PR files:', error);
      throw error;
    }
  }

  /**
   * Get file content
   */
  async getFileContent(
    octokit: Octokit,
    owner: string,
    repo: string,
    path: string,
    ref: string
  ): Promise<string> {
    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });

      if ('content' in data && data.content) {
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }

      throw new Error('File content not available');
    } catch (error) {
      logger.error(`Error fetching file ${path}:`, error);
      throw error;
    }
  }

  /**
   * Create a new branch and PR with fixes
   */
  async createFixPR(
    octokit: Octokit,
    owner: string,
    repo: string,
    baseBranch: string,
    title: string,
    body: string,
    files: Array<{ path: string; content: string }>
  ): Promise<number> {
    try {
      // Get base branch ref
      const { data: baseRef } = await octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${baseBranch}`,
      });

      const baseSha = baseRef.object.sha;

      // Create new branch
      const newBranchName = `compliance-fix-${Date.now()}`;
      await octokit.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${newBranchName}`,
        sha: baseSha,
      });

      // Get base tree
      const { data: baseCommit } = await octokit.git.getCommit({
        owner,
        repo,
        commit_sha: baseSha,
      });

      // Create blobs for changed files
      const tree = await Promise.all(
        files.map(async (file) => {
          const { data: blob } = await octokit.git.createBlob({
            owner,
            repo,
            content: Buffer.from(file.content).toString('base64'),
            encoding: 'base64',
          });

          return {
            path: file.path,
            mode: '100644' as const,
            type: 'blob' as const,
            sha: blob.sha,
          };
        })
      );

      // Create new tree
      const { data: newTree } = await octokit.git.createTree({
        owner,
        repo,
        tree,
        base_tree: baseCommit.tree.sha,
      });

      // Create commit
      const { data: newCommit } = await octokit.git.createCommit({
        owner,
        repo,
        message: title,
        tree: newTree.sha,
        parents: [baseSha],
      });

      // Update branch ref
      await octokit.git.updateRef({
        owner,
        repo,
        ref: `heads/${newBranchName}`,
        sha: newCommit.sha,
      });

      // Create PR
      const { data: pr } = await octokit.pulls.create({
        owner,
        repo,
        title,
        body,
        head: newBranchName,
        base: baseBranch,
      });

      logger.info(`Created fix PR #${pr.number} on branch ${newBranchName}`);
      return pr.number;
    } catch (error) {
      logger.error('Error creating fix PR:', error);
      throw error;
    }
  }
}

export default GitHubAppHandler;

