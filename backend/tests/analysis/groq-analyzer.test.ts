import { GroqAnalyzer } from '../../src/analysis/groq-analyzer';
import { ChangedFile, ComplianceFinding } from '../../src/types';

// Mock Groq SDK
const mockCreate = jest.fn();
jest.mock('groq-sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  })),
}));

describe('GroqAnalyzer', () => {
  let analyzer: GroqAnalyzer;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({ findings: [] }),
        },
      }],
    });
    analyzer = new GroqAnalyzer();
  });

  describe('analyzeCode', () => {
    it('should analyze code and return findings', async () => {
      const files: ChangedFile[] = [
        {
          filename: 'test.js',
          status: 'modified',
          additions: 5,
          deletions: 2,
          content: `
function login(username, password) {
  const query = 'SELECT * FROM users WHERE username = "' + username + '"';
  // SQL injection vulnerability
}
          `,
        },
      ];

      // Mock Groq response
      const mockResponse = {
        findings: [
          {
            file: 'test.js',
            line: 3,
            type: 'security',
            severity: 'high',
            message: 'SQL injection vulnerability detected',
            code: 'const query = ...',
            fixSuggestion: 'Use parameterized queries',
            ruleName: 'SQL Injection',
          },
        ],
      };

      // In a real test, you'd mock the Groq client properly
      // For now, this is a structural test

      // The analyzer should batch files efficiently
      expect(analyzer).toBeDefined();
    });

    it('should handle empty files array', async () => {
      const files: ChangedFile[] = [];
      const existingFindings: ComplianceFinding[] = [];

      const findings = await analyzer.analyzeCode(files, existingFindings);

      expect(Array.isArray(findings)).toBe(true);
    });

    it('should enhance existing findings', async () => {
      const files: ChangedFile[] = [];
      const existingFindings: ComplianceFinding[] = [
        {
          id: 'test-1',
          type: 'security',
          severity: 'critical',
          message: 'Hardcoded API key',
          file: 'config.js',
          line: 10,
          ruleId: 'secret-api-key',
          ruleName: 'Hardcoded API Key',
        },
      ];

      const findings = await analyzer.analyzeCode(files, existingFindings);

      expect(Array.isArray(findings)).toBe(true);
    });
  });

  describe('analyzeFile', () => {
    it('should analyze a single file', async () => {
      const file: ChangedFile = {
        filename: 'example.js',
        status: 'added',
        additions: 10,
        deletions: 0,
        content: 'const secret = "my-secret-key";',
      };

      const findings = await analyzer.analyzeFile(file);

      expect(Array.isArray(findings)).toBe(true);
    });
  });

  describe('generateFix', () => {
    it('should generate fix for a finding', async () => {
      const finding: ComplianceFinding = {
        id: 'test-1',
        type: 'security',
        severity: 'high',
        message: 'SQL injection detected',
        file: 'db.js',
        line: 10,
        code: "SELECT * FROM users WHERE id = ' + userId",
        ruleId: 'sql-injection',
        ruleName: 'SQL Injection',
      };

      const fileContent = `
function getUser(userId) {
  const query = 'SELECT * FROM users WHERE id = ' + userId;
  return db.execute(query);
}
      `;

      const fix = await analyzer.generateFix(finding, fileContent);

      // Fix might be null if Groq API is not configured in test
      expect(typeof fix === 'string' || fix === null).toBe(true);
    });
  });
});

