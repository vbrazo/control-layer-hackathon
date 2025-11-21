import { ComplianceFinding, CustomRule, ChangedFile } from '../types';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

/**
 * Built-in compliance rules for security, license, and code quality
 */
const builtInRules: CustomRule[] = [
  // Security Rules - Hardcoded Secrets
  {
    id: 'secret-api-key',
    name: 'Hardcoded API Key',
    description: 'Detects hardcoded API keys in source code',
    enabled: true,
    type: 'regex',
    pattern: '(api[_-]?key|apikey)\\s*[=:]\\s*["\']([A-Za-z0-9_\\-]{20,})["\']',
    severity: 'critical',
    category: 'security',
    fixTemplate: 'Move API key to environment variables',
  },
  {
    id: 'secret-aws-key',
    name: 'AWS Access Key',
    description: 'Detects AWS access keys',
    enabled: true,
    type: 'regex',
    pattern: '(AKIA[0-9A-Z]{16})',
    severity: 'critical',
    category: 'security',
    fixTemplate: 'Use AWS Secrets Manager or IAM roles',
  },
  {
    id: 'secret-private-key',
    name: 'Private Key',
    description: 'Detects private keys in source code',
    enabled: true,
    type: 'regex',
    pattern: '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----',
    severity: 'critical',
    category: 'security',
    fixTemplate: 'Remove private key and use secure key management',
  },
  {
    id: 'secret-password',
    name: 'Hardcoded Password',
    description: 'Detects hardcoded passwords',
    enabled: true,
    type: 'regex',
    pattern: '(password|passwd|pwd)\\s*[=:]\\s*["\'](?!\\$\\{)[^"\']{8,}["\']',
    severity: 'high',
    category: 'security',
    fixTemplate: 'Use environment variables or secure vaults',
  },
  {
    id: 'secret-token',
    name: 'Authentication Token',
    description: 'Detects hardcoded auth tokens',
    enabled: true,
    type: 'regex',
    pattern: '(token|bearer|auth)\\s*[=:]\\s*["\']([A-Za-z0-9_\\-]{32,})["\']',
    severity: 'high',
    category: 'security',
    fixTemplate: 'Store tokens in secure configuration',
  },
  
  // Security Rules - Vulnerable Code Patterns
  {
    id: 'security-sql-injection',
    name: 'Potential SQL Injection',
    description: 'Detects string concatenation in SQL queries',
    enabled: true,
    type: 'regex',
    pattern: '(execute|query|exec)\\s*\\([^)]*\\+[^)]*\\)',
    severity: 'high',
    category: 'security',
    fixTemplate: 'Use parameterized queries or prepared statements',
  },
  {
    id: 'security-eval',
    name: 'Dangerous eval() Usage',
    description: 'Detects use of eval() which can execute arbitrary code',
    enabled: true,
    type: 'regex',
    pattern: '\\beval\\s*\\(',
    severity: 'high',
    category: 'security',
    fixTemplate: 'Avoid eval() and use safer alternatives',
  },
  {
    id: 'security-exec',
    name: 'Command Injection Risk',
    description: 'Detects shell command execution with user input',
    enabled: true,
    type: 'regex',
    pattern: '(exec|system|spawn|execSync)\\s*\\([^)]*\\$',
    severity: 'high',
    category: 'security',
    fixTemplate: 'Validate and sanitize all inputs, use safe APIs',
  },
  {
    id: 'security-weak-crypto',
    name: 'Weak Cryptography',
    description: 'Detects use of weak cryptographic algorithms',
    enabled: true,
    type: 'regex',
    pattern: '(MD5|SHA1|DES)\\s*\\(',
    severity: 'medium',
    category: 'security',
    fixTemplate: 'Use strong algorithms like SHA-256 or bcrypt',
  },
  
  // License Rules
  {
    id: 'license-missing-header',
    name: 'Missing License Header',
    description: 'Source files should contain license headers',
    enabled: true,
    type: 'regex',
    pattern: '^(?!.*Copyright)(?!.*License).*',
    severity: 'low',
    category: 'license',
    fixTemplate: 'Add appropriate license header to file',
  },
  {
    id: 'license-gpl-violation',
    name: 'GPL License Violation',
    description: 'Detects GPL library usage in proprietary code',
    enabled: true,
    type: 'regex',
    pattern: '(gpl|gnu general public license)',
    severity: 'high',
    category: 'license',
    fixTemplate: 'Replace with MIT/Apache licensed alternative or open source your code',
  },
  
  // Code Quality Rules
  {
    id: 'quality-long-function',
    name: 'Long Function',
    description: 'Functions should be concise and focused',
    enabled: true,
    type: 'regex',
    pattern: 'function\\s+\\w+\\s*\\([^)]*\\)\\s*\\{[\\s\\S]{1000,}\\}',
    severity: 'low',
    category: 'quality',
    fixTemplate: 'Break down into smaller, focused functions',
  },
  {
    id: 'quality-console-log',
    name: 'Console Log Statement',
    description: 'Remove debug console.log statements',
    enabled: true,
    type: 'regex',
    pattern: 'console\\.(log|debug|info)\\s*\\(',
    severity: 'info',
    category: 'quality',
    fixTemplate: 'Use proper logging framework',
  },
  {
    id: 'quality-todo-comment',
    name: 'TODO Comment',
    description: 'Unresolved TODO comments',
    enabled: true,
    type: 'regex',
    pattern: '(TODO|FIXME|HACK|XXX):',
    severity: 'info',
    category: 'quality',
    fixTemplate: 'Create issue or resolve TODO',
  },
];

export class RulesEngine {
  private rules: CustomRule[];

  constructor(customRules: CustomRule[] = []) {
    // Merge built-in rules with custom rules
    this.rules = [...builtInRules, ...customRules].filter(rule => rule.enabled);
    logger.info(`Rules engine initialized with ${this.rules.length} rules`);
  }

  /**
   * Analyze files against all enabled rules
   */
  async analyzeFiles(files: ChangedFile[]): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = [];

    for (const file of files) {
      if (!file.content && !file.patch) {
        continue;
      }

      const content = file.content || file.patch || '';
      const fileFindings = await this.analyzeFile(file.filename, content);
      findings.push(...fileFindings);
    }

    logger.info(`Rules engine found ${findings.length} issues across ${files.length} files`);
    return findings;
  }

  /**
   * Analyze a single file
   */
  private async analyzeFile(filename: string, content: string): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = [];

    for (const rule of this.rules) {
      if (rule.type === 'regex' && rule.pattern) {
        const ruleFindings = this.applyRegexRule(filename, content, rule);
        findings.push(...ruleFindings);
      } else if (rule.type === 'dependency') {
        const ruleFindings = await this.applyDependencyRule(filename, content, rule);
        findings.push(...ruleFindings);
      } else if (rule.type === 'license') {
        const ruleFindings = this.applyLicenseRule(filename, content, rule);
        findings.push(...ruleFindings);
      }
    }

    return findings;
  }

  /**
   * Apply regex-based rule
   */
  private applyRegexRule(
    filename: string,
    content: string,
    rule: CustomRule
  ): ComplianceFinding[] {
    const findings: ComplianceFinding[] = [];

    try {
      const regex = new RegExp(rule.pattern!, 'gmi');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        const matches = line.matchAll(regex);
        for (const match of matches) {
          findings.push({
            id: uuidv4(),
            type: rule.category,
            severity: rule.severity,
            message: `${rule.name}: ${rule.description}`,
            file: filename,
            line: index + 1,
            column: match.index,
            code: line.trim(),
            fixSuggestion: rule.fixTemplate,
            ruleId: rule.id,
            ruleName: rule.name,
          });
        }
      });
    } catch (error) {
      logger.error(`Error applying regex rule ${rule.id}:`, error);
    }

    return findings;
  }

  /**
   * Apply dependency scanning rule
   */
  private async applyDependencyRule(
    filename: string,
    content: string,
    _rule: CustomRule
  ): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = [];

    // Check if this is a dependency file
    if (!['package.json', 'requirements.txt', 'Gemfile', 'pom.xml'].includes(filename)) {
      return findings;
    }

    // Parse dependencies based on file type
    if (filename === 'package.json') {
      try {
        const pkg = JSON.parse(content);
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        // Check for known vulnerable versions
        const vulnerableDeps = this.checkVulnerableDependencies(deps);
        
        for (const [depName, version] of Object.entries(vulnerableDeps)) {
          findings.push({
            id: uuidv4(),
            type: 'security',
            severity: 'high',
            message: `Vulnerable dependency: ${depName}@${version}`,
            file: filename,
            fixSuggestion: `Update ${depName} to latest secure version`,
            ruleId: 'dependency-vulnerability',
            ruleName: 'Vulnerable Dependency',
          });
        }
      } catch (error) {
        logger.error('Error parsing package.json:', error);
      }
    }

    return findings;
  }

  /**
   * Apply license checking rule
   */
  private applyLicenseRule(
    filename: string,
    content: string,
    rule: CustomRule
  ): ComplianceFinding[] {
    const findings: ComplianceFinding[] = [];

    // Check for license file
    if (filename.toLowerCase() === 'license' || filename.toLowerCase() === 'license.md') {
      return findings;
    }

    // Check for license headers in source files
    const sourceExtensions = ['.js', '.ts', '.py', '.java', '.go', '.rs', '.cpp', '.c', '.h'];
    const hasSourceExtension = sourceExtensions.some(ext => filename.endsWith(ext));

    if (hasSourceExtension && rule.id === 'license-missing-header') {
      const hasLicenseHeader = /copyright|license/i.test(content.substring(0, 500));
      
      if (!hasLicenseHeader) {
        findings.push({
          id: uuidv4(),
          type: 'license',
          severity: 'low',
          message: 'Missing license header in source file',
          file: filename,
          line: 1,
          fixSuggestion: rule.fixTemplate,
          ruleId: rule.id,
          ruleName: rule.name,
        });
      }
    }

    return findings;
  }

  /**
   * Check for known vulnerable dependencies
   * In production, this would query a CVE database
   */
  private checkVulnerableDependencies(deps: Record<string, string>): Record<string, string> {
    const vulnerable: Record<string, string> = {};

    // Known vulnerable versions (examples for demo)
    const knownVulnerable: Record<string, string[]> = {
      'express': ['4.0.0', '4.1.0', '4.2.0'],
      'lodash': ['4.17.0', '4.17.1'],
      'axios': ['0.18.0', '0.19.0'],
      'crypto-js': ['3.1.2', '3.1.3'],
    };

    for (const [dep, version] of Object.entries(deps)) {
      if (knownVulnerable[dep]?.includes(version.replace(/[\^~]/g, ''))) {
        vulnerable[dep] = version;
      }
    }

    return vulnerable;
  }

  /**
   * Add custom rule
   */
  addRule(rule: CustomRule): void {
    this.rules.push(rule);
    logger.info(`Added custom rule: ${rule.id}`);
  }

  /**
   * Remove rule by ID
   */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId);
    logger.info(`Removed rule: ${ruleId}`);
  }

  /**
   * Get all rules
   */
  getRules(): CustomRule[] {
    return this.rules;
  }
}

export default RulesEngine;

