import Groq from 'groq-sdk';
import { ComplianceFinding, ChangedFile, CustomRule } from '../types';
import { v4 as uuidv4 } from 'uuid';
import config from '../config';
import logger from '../utils/logger';

export class GroqAnalyzer {
  private client: Groq;
  private model: string;

  constructor() {
    this.client = new Groq({
      apiKey: config.GROQ_API_KEY,
    });
    this.model = config.GROQ_MODEL;
    logger.info(`Groq analyzer initialized with model: ${this.model}`);
  }

  /**
   * Analyze code files using Groq AI
   * Validates findings from rules engine and provides AI-powered insights
   */
  async analyzeCode(
    files: ChangedFile[],
    existingFindings: ComplianceFinding[],
    customRules: CustomRule[] = []
  ): Promise<ComplianceFinding[]> {
    logger.info(`Starting Groq analysis for ${files.length} files`);

    const findings: ComplianceFinding[] = [];

    // Batch files for efficient analysis (max 5 files per request)
    const batches = this.batchFiles(files, 5);

    for (const batch of batches) {
      try {
        const batchFindings = await this.analyzeBatch(batch, customRules);
        findings.push(...batchFindings);
      } catch (error) {
        logger.error('Error analyzing batch with Groq:', error);
      }
    }

    // Enhance existing findings with AI suggestions
    const enhancedFindings = await this.enhanceFindings(existingFindings);

    logger.info(`Groq analysis complete: ${findings.length} new findings, ${enhancedFindings.length} enhanced`);
    return [...findings, ...enhancedFindings];
  }

  /**
   * Analyze a batch of files
   */
  private async analyzeBatch(
    files: ChangedFile[],
    customRules: CustomRule[]
  ): Promise<ComplianceFinding[]> {
    const prompt = this.buildAnalysisPrompt(files, customRules);

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1, // Low temperature for consistent, factual output
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        logger.warn('Empty response from Groq');
        return [];
      }

      return this.parseGroqResponse(response);
    } catch (error) {
      logger.error('Error calling Groq API:', error);
      throw error;
    }
  }

  /**
   * Build system prompt for compliance analysis
   */
  private getSystemPrompt(): string {
    return `You are an expert security and compliance analyzer specializing in code review.
Your task is to identify security vulnerabilities, license compliance issues, code quality problems, and custom rule violations.

Focus on these categories:
1. SECURITY: SQL injection, XSS, hardcoded secrets, weak cryptography, command injection, authentication issues
2. LICENSE: GPL violations, missing license headers, incompatible licenses
3. QUALITY: Code complexity, code smells, maintainability issues, best practice violations
4. CUSTOM: Company-specific rules and policies

For each issue found, provide:
- Exact file path and line number
- Severity level (critical, high, medium, low, info)
- Clear description of the issue
- Actionable fix suggestion with code example if possible

Return ONLY valid JSON in this exact format:
{
  "findings": [
    {
      "file": "path/to/file.js",
      "line": 42,
      "type": "security",
      "severity": "high",
      "message": "SQL injection vulnerability detected",
      "code": "execute('SELECT * FROM users WHERE id = ' + userId)",
      "fixSuggestion": "Use parameterized query: execute('SELECT * FROM users WHERE id = ?', [userId])",
      "ruleName": "SQL Injection"
    }
  ]
}`;
  }

  /**
   * Build analysis prompt for specific files
   */
  private buildAnalysisPrompt(files: ChangedFile[], customRules: CustomRule[]): string {
    let prompt = 'Analyze the following code changes for compliance issues:\n\n';

    files.forEach((file) => {
      const content = file.content || file.patch || '';
      prompt += `\n## File: ${file.filename}\n`;
      prompt += `Status: ${file.status}\n`;
      prompt += `\`\`\`\n${content.substring(0, 2000)}\n\`\`\`\n`;
    });

    if (customRules.length > 0) {
      prompt += '\n## Custom Rules to Check:\n';
      customRules.forEach((rule) => {
        prompt += `- ${rule.name}: ${rule.description}\n`;
      });
    }

    prompt += '\n\nProvide detailed analysis in JSON format.';
    return prompt;
  }

  /**
   * Parse Groq API response into findings
   */
  private parseGroqResponse(response: string): ComplianceFinding[] {
    try {
      const parsed = JSON.parse(response);
      
      if (!parsed.findings || !Array.isArray(parsed.findings)) {
        logger.warn('Invalid Groq response format');
        return [];
      }

      return parsed.findings.map((finding: Record<string, unknown>) => ({
        id: uuidv4(),
        type: (finding.type as ComplianceFinding['type']) || 'quality',
        severity: (finding.severity as ComplianceFinding['severity']) || 'medium',
        message: String(finding.message || 'Issue detected'),
        file: String(finding.file),
        line: finding.line as number | undefined,
        column: finding.column,
        code: finding.code,
        fixSuggestion: finding.fixSuggestion || finding.fix_suggestion,
        ruleId: `groq-${finding.type}`,
        ruleName: finding.ruleName || finding.rule_name || 'AI Analysis',
      }));
    } catch (error) {
      logger.error('Error parsing Groq response:', error);
      return [];
    }
  }

  /**
   * Enhance existing findings with AI-generated fix suggestions
   */
  private async enhanceFindings(findings: ComplianceFinding[]): Promise<ComplianceFinding[]> {
    if (findings.length === 0) {
      return [];
    }

    // Only enhance high-severity findings without fix suggestions
    const toEnhance = findings
      .filter(f => ['critical', 'high'].includes(f.severity) && !f.fixSuggestion)
      .slice(0, 10); // Limit to 10 for cost efficiency

    if (toEnhance.length === 0) {
      return [];
    }

    const prompt = this.buildEnhancementPrompt(toEnhance);

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a code remediation expert. Provide specific, actionable fix suggestions for security and compliance issues.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 2048,
        response_format: { type: 'json_object' },
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        return [];
      }

      const parsed = JSON.parse(response);
      const suggestions = parsed.suggestions || [];

      // Merge suggestions back into findings
      return findings.map(finding => {
        const suggestion = suggestions.find((s: Record<string, unknown>) => s.id === finding.id);
        if (suggestion) {
          return {
            ...finding,
            fixSuggestion: String(suggestion.fix),
          };
        }
        return finding;
      });
    } catch (error) {
      logger.error('Error enhancing findings:', error);
      return findings;
    }
  }

  /**
   * Build prompt for enhancing findings
   */
  private buildEnhancementPrompt(findings: ComplianceFinding[]): string {
    let prompt = 'Provide fix suggestions for these compliance issues:\n\n';

    findings.forEach((finding, index) => {
      prompt += `${index + 1}. ${finding.ruleName} in ${finding.file}:${finding.line}\n`;
      prompt += `   Issue: ${finding.message}\n`;
      if (finding.code) {
        prompt += `   Code: ${finding.code}\n`;
      }
      prompt += '\n';
    });

    prompt += 'Return JSON: {"suggestions": [{"id": "finding-id", "fix": "specific fix description with code example"}]}';
    return prompt;
  }

  /**
   * Batch files for efficient processing
   */
  private batchFiles(files: ChangedFile[], batchSize: number): ChangedFile[][] {
    const batches: ChangedFile[][] = [];
    for (let i = 0; i < files.length; i += batchSize) {
      batches.push(files.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Analyze a single file for quick checks
   */
  async analyzeFile(file: ChangedFile): Promise<ComplianceFinding[]> {
    return this.analyzeBatch([file], []);
  }

  /**
   * Generate automated fix for a finding
   */
  async generateFix(finding: ComplianceFinding, fileContent: string): Promise<string | null> {
    const prompt = `
Generate a code fix for this issue:

File: ${finding.file}
Line: ${finding.line}
Issue: ${finding.message}
Current code:
\`\`\`
${fileContent}
\`\`\`

Provide ONLY the fixed code without explanations.
`;

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a code fixing expert. Generate clean, secure code fixes.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 1024,
      });

      return completion.choices[0]?.message?.content || null;
    } catch (error) {
      logger.error('Error generating fix:', error);
      return null;
    }
  }
}

export default GroqAnalyzer;
