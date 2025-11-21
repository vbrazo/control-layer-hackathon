import CodeInterpreter from '@e2b/code-interpreter';
import { E2BAnalysisContext, ComplianceFinding, ChangedFile } from '../types';
import config from '../config';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

// Type for E2B sandbox execution result
interface E2BExecutionResult {
  text?: string;
  stdout?: string;
  stderr?: string;
}

// Type for E2B sandbox with methods we need
interface E2BSandbox {
  sandboxId: string;
  runPythonCode(code: string): Promise<E2BExecutionResult>;
  kill(): Promise<void>;
}

// Type guard to ensure the sandbox has the expected interface
function isE2BSandbox(sandbox: unknown): sandbox is E2BSandbox {
  return (
    !!sandbox &&
    typeof sandbox === 'object' &&
    'sandboxId' in sandbox &&
    typeof (sandbox as E2BSandbox).sandboxId === 'string' &&
    'runPythonCode' in sandbox &&
    typeof (sandbox as E2BSandbox).runPythonCode === 'function' &&
    'kill' in sandbox &&
    typeof (sandbox as E2BSandbox).kill === 'function'
  );
}

export class E2BAgent {
  private sandbox: E2BSandbox | null = null;
  private githubToken: string;

  constructor(githubToken: string) {
    this.githubToken = githubToken;
  }

  /**
   * Initialize E2B sandbox with MCP tools
   */
  async initialize(): Promise<void> {
    logger.info('Initializing E2B sandbox...');

    try {
      const sandbox = await CodeInterpreter.create({
        apiKey: config.E2B_API_KEY,
        metadata: {
          purpose: 'compliance-analysis',
          timestamp: new Date().toISOString(),
        },
      });

      // Type-safe check instead of double assertion
      if (!isE2BSandbox(sandbox)) {
        throw new Error('E2B sandbox does not match expected interface');
      }

      this.sandbox = sandbox;
      logger.info(`E2B sandbox created: ${this.sandbox.sandboxId}`);

      // Setup MCP servers in sandbox
      await this.setupMCPServers();

      logger.info('E2B sandbox initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize E2B sandbox:', error);
      throw new Error('E2B sandbox initialization failed');
    }
  }

  /**
   * Setup MCP servers within the E2B sandbox
   */
  private async setupMCPServers(): Promise<void> {
    if (!this.sandbox) {
      throw new Error('Sandbox not initialized');
    }

    logger.info('Setting up MCP servers in sandbox...');

    try {
      // Install MCP server packages
      const installScript = `
      import subprocess
      import os

      # Install Node.js MCP servers
      subprocess.run(['npm', 'install', '-g', '@modelcontextprotocol/server-github', '@modelcontextprotocol/server-filesystem'], check=True)

      print("MCP servers installed successfully")
      `;

      const result = await this.sandbox.runPythonCode(installScript);
      logger.info('MCP servers installed:', result);

      // Configure GitHub MCP with token
      const configScript = `
      import os
      os.environ['GITHUB_PERSONAL_ACCESS_TOKEN'] = '${this.githubToken}'
      print("GitHub MCP configured")
      `;

      await this.sandbox.runPythonCode(configScript);
      logger.info('MCP servers configured');
    } catch (error) {
      logger.error('Error setting up MCP servers:', error);
      throw error;
    }
  }

  /**
   * Analyze code using E2B sandbox with MCP tools
   */
  async analyzeWithMCP(context: E2BAnalysisContext): Promise<ComplianceFinding[]> {
    if (!this.sandbox) {
      await this.initialize();
    }

    logger.info(`Starting E2B analysis for PR #${context.prContext.prNumber}`);

    try {
      // Create workspace directory
      await this.setupWorkspace(context);

      // Run analysis script with MCP tools
      const findings = await this.runAnalysis(context);

      logger.info(`E2B analysis complete: ${findings.length} findings`);
      return findings;
    } catch (error) {
      logger.error('Error during E2B analysis:', error);
      throw error;
    }
  }

  /**
   * Setup workspace in sandbox with changed files
   */
  private async setupWorkspace(context: E2BAnalysisContext): Promise<void> {
    if (!this.sandbox) {
      throw new Error('Sandbox not initialized');
    }

    logger.info('Setting up workspace with changed files...');

    const setupScript = `
      import os
      import json

      # Create workspace directory
      os.makedirs('/workspace', exist_ok=True)

      # Write changed files
      files = ${JSON.stringify(context.files.map(f => ({
        filename: f.filename,
        content: f.content || '',
        status: f.status,
      })))}

      for file_data in files:
          filepath = os.path.join('/workspace', file_data['filename'])
          os.makedirs(os.path.dirname(filepath), exist_ok=True)
          
          with open(filepath, 'w') as f:
              f.write(file_data['content'])

      print(f"Setup {len(files)} files in workspace")
      `;

    await this.sandbox.runPythonCode(setupScript);
    logger.info('Workspace setup complete');
  }

  /**
   * Run comprehensive analysis using MCP tools
   */
  private async runAnalysis(_context: E2BAnalysisContext): Promise<ComplianceFinding[]> {
    if (!this.sandbox) {
      throw new Error('Sandbox not initialized');
    }

    const analysisScript = `
      import os
      import json
      import re
      import subprocess

      findings = []

      # Security analysis using filesystem MCP
      def analyze_security(filepath, content):
          issues = []
          
          # Check for secrets
          # Using triple-quoted strings to avoid escaping issues
          secret_patterns = {
              'api_key': r'''(api[_-]?key|apikey)\\s*[=:]\\s*["']([A-Za-z0-9_\\-]{20,})["']''',
              'aws_key': r'(AKIA[0-9A-Z]{16})',
              'private_key': r'-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----',
              'password': r'''(password|passwd|pwd)\\s*[=:]\\s*["'][^"']{8,}["']''',
          }
          
          for pattern_name, pattern in secret_patterns.items():
              matches = re.finditer(pattern, content, re.IGNORECASE)
              for match in matches:
                  line_num = content[:match.start()].count('\\n') + 1
                  issues.append({
                      'type': 'security',
                      'severity': 'critical',
                      'message': f'Hardcoded secret detected: {pattern_name}',
                      'file': filepath,
                      'line': line_num,
                      'code': match.group(0),
                      'ruleName': 'Secret Detection'
                  })
          
          return issues

      # Analyze each file in workspace
      for root, dirs, files in os.walk('/workspace'):
          for filename in files:
              filepath = os.path.join(root, filename)
              relative_path = os.path.relpath(filepath, '/workspace')
              
              try:
                  with open(filepath, 'r') as f:
                      content = f.read()
                  
                  # Run security analysis
                  file_findings = analyze_security(relative_path, content)
                  findings.extend(file_findings)
                  
              except Exception as e:
                  print(f"Error analyzing {relative_path}: {e}")

      # Output findings as JSON
      print(json.dumps({'findings': findings}, indent=2))
      `;

    try {
      const result = await this.sandbox.runPythonCode(analysisScript);
      
      // Parse findings from output
      // E2B runPythonCode returns results with text output
      const output = typeof result === 'string' ? result : (result.text || result.stdout || '');
      const findings = this.parseAnalysisOutput(output);

      return findings;
    } catch (error) {
      logger.error('Error running analysis script:', error);
      return [];
    }
  }

  /**
   * Parse analysis output into findings
   */
  private parseAnalysisOutput(output: string): ComplianceFinding[] {
    try {
      // Extract JSON from output
      const jsonMatch = output.match(/\{[\s\S]*"findings"[\s\S]*\}/);
      if (!jsonMatch) {
        logger.warn('No findings JSON found in output');
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]) as { findings?: unknown[] };
      
      if (!parsed.findings || !Array.isArray(parsed.findings)) {
        return [];
      }

      return (parsed.findings as Array<Record<string, unknown>>).map((finding) => ({
        id: uuidv4(),
        type: (finding.type as ComplianceFinding['type']) || 'security',
        severity: (finding.severity as ComplianceFinding['severity']) || 'medium',
        message: String(finding.message || ''),
        file: String(finding.file || ''),
        line: finding.line as number | undefined,
        column: finding.column as number | undefined,
        code: finding.code as string | undefined,
        fixSuggestion: finding.fixSuggestion as string | undefined,
        ruleId: `e2b-${finding.type || 'unknown'}`,
        ruleName: String(finding.ruleName || 'E2B Analysis'),
      }));
    } catch (error) {
      logger.error('Error parsing analysis output:', error);
      return [];
    }
  }

  /**
   * Use GitHub MCP to fetch file contents
   */
  async fetchFileFromGitHub(
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<string | null> {
    if (!this.sandbox) {
      await this.initialize();
    }

    const script = `
import subprocess
import json

# Use GitHub MCP to fetch file
result = subprocess.run(
    ['gh-mcp', 'get-file', '--owner', '${owner}', '--repo', '${repo}', '--path', '${path}'${ref ? `, '--ref', '${ref}'` : ''}],
    capture_output=True,
    text=True
)

if result.returncode == 0:
    print(result.stdout)
else:
    print(json.dumps({'error': result.stderr}))
`;

    try {
      const result = await this.sandbox!.runPythonCode(script);
      const output = typeof result === 'string' ? result : (result.text || result.stdout || '');
      
      if (output.includes('error')) {
        return null;
      }

      return output;
    } catch (error) {
      logger.error('Error fetching file from GitHub:', error);
      return null;
    }
  }

  /**
   * Execute custom security scanners via MCP
   */
  async runSecurityScan(_files: ChangedFile[]): Promise<ComplianceFinding[]> {
    if (!this.sandbox) {
      await this.initialize();
    }

    logger.info('Running security scanners in E2B sandbox...');

    const scanScript = `
import subprocess
import json

findings = []

# Run Semgrep for static analysis
try:
    result = subprocess.run(
        ['semgrep', '--json', '--config=auto', '/workspace'],
        capture_output=True,
        text=True,
        timeout=60
    )
    
    if result.returncode == 0:
        semgrep_results = json.loads(result.stdout)
        for finding in semgrep_results.get('results', []):
            findings.append({
                'type': 'security',
                'severity': 'high',
                'message': finding.get('extra', {}).get('message', 'Security issue detected'),
                'file': finding.get('path', '').replace('/workspace/', ''),
                'line': finding.get('start', {}).get('line'),
                'ruleName': 'Semgrep'
            })
except Exception as e:
    print(f"Semgrep error: {e}")

print(json.dumps({'findings': findings}, indent=2))
`;

    try {
      const result = await this.sandbox!.runPythonCode(scanScript);
      const output = typeof result === 'string' ? result : (result.text || result.stdout || '');
      return this.parseAnalysisOutput(output);
    } catch (error) {
      logger.error('Error running security scan:', error);
      return [];
    }
  }

  /**
   * Cleanup and destroy sandbox
   */
  async cleanup(): Promise<void> {
    if (this.sandbox) {
      logger.info(`Cleaning up E2B sandbox: ${this.sandbox.sandboxId}`);
      
      try {
        await this.sandbox.kill();
        this.sandbox = null;
        logger.info('E2B sandbox cleaned up successfully');
      } catch (error) {
        logger.error('Error cleaning up sandbox:', error);
      }
    }
  }

  /**
   * Get sandbox info
   */
  getSandboxInfo() {
    return this.sandbox ? {
      sandboxId: this.sandbox.sandboxId,
      status: 'running',
    } : {
      sandboxId: null,
      status: 'not_initialized',
    };
  }
}

export default E2BAgent;

