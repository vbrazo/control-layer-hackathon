# Backend Tests

This directory contains comprehensive test suites for the AI Compliance Copilot backend.

## Test Structure

```
tests/
├── api/                    # API route tests
│   └── routes.test.ts     # Test all REST API endpoints
├── agent/                  # E2B agent tests
│   └── e2b-agent.test.ts  # Test E2B sandbox integration
├── analysis/               # Analysis engine tests
│   └── groq-analyzer.test.ts  # Test Groq AI integration
├── compliance/             # Rules engine tests
│   └── rules-engine.test.ts   # Test compliance rules
├── db/                     # Database tests
│   └── analysis-repository.test.ts  # Test database operations
├── github/                 # GitHub integration tests
│   ├── app-handler.test.ts    # Test GitHub App handlers
│   └── pr-analyzer.test.ts    # Test PR analysis logic
└── setup.ts                # Global test configuration
```

## Running Tests

### Prerequisites

First, install all dependencies including test libraries:

```bash
cd backend
npm install
```

This will install:
- `jest` - Test framework
- `ts-jest` - TypeScript support for Jest
- `supertest` - HTTP assertion library
- `@types/jest` - TypeScript types for Jest
- `@types/supertest` - TypeScript types for supertest

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

This will generate a coverage report showing which parts of the code are tested.

## Test Coverage Goals

The project is configured with the following coverage thresholds:
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%

## Test Categories

### 1. API Route Tests (`api/routes.test.ts`)

Tests all REST API endpoints:
- ✅ Health check endpoint
- ✅ Analyses retrieval (recent and by repo)
- ✅ Analysis by ID
- ✅ Statistics endpoint
- ✅ Custom rules configuration
- ✅ Manual scan triggering
- ✅ Webhook information

### 2. GitHub App Handler Tests (`github/app-handler.test.ts`)

Tests GitHub App integration:
- ✅ Command parsing from comments
- ✅ Webhook signature verification
- ✅ Posting comments and reviews
- ✅ Creating and updating check runs
- ✅ Fetching PR files and content
- ✅ Creating fix PRs

### 3. Database Repository Tests (`db/analysis-repository.test.ts`)

Tests database operations:
- ✅ Saving analysis results
- ✅ Retrieving analyses
- ✅ Filtering by repository
- ✅ Statistics aggregation
- ✅ Error handling

### 4. E2B Agent Tests (`agent/e2b-agent.test.ts`)

Tests E2B sandbox integration:
- ✅ Sandbox initialization
- ✅ MCP tool integration
- ✅ Code analysis
- ✅ Security scanning
- ✅ GitHub file fetching
- ✅ Cleanup operations

### 5. Rules Engine Tests (`compliance/rules-engine.test.ts`)

Tests compliance rule detection:
- ✅ Secret detection (API keys, AWS keys, passwords)
- ✅ SQL injection detection
- ✅ Weak cryptography detection
- ✅ Dangerous code patterns (eval, exec)
- ✅ License compliance
- ✅ Code quality checks
- ✅ Custom rule support

### 6. Groq Analyzer Tests (`analysis/groq-analyzer.test.ts`)

Tests AI-powered analysis:
- ✅ Code analysis with Groq AI
- ✅ Finding enhancement
- ✅ Fix generation
- ✅ Batch processing

### 7. PR Analyzer Tests (`github/pr-analyzer.test.ts`)

Tests PR analysis orchestration:
- ✅ Complete PR analysis workflow
- ✅ Command handling
- ✅ Error handling

## Writing New Tests

When adding new features, follow these guidelines:

### 1. Test File Naming

- Place tests in the corresponding directory under `tests/`
- Name test files with `.test.ts` extension
- Mirror the source file structure

### 2. Test Structure

```typescript
import { MyModule } from '../../src/path/to/module';

// Mock dependencies
jest.mock('../../src/dependencies');

describe('MyModule', () => {
  let instance: MyModule;

  beforeEach(() => {
    // Setup before each test
    instance = new MyModule();
  });

  describe('methodName', () => {
    it('should do something specific', async () => {
      // Arrange
      const input = 'test';

      // Act
      const result = await instance.methodName(input);

      // Assert
      expect(result).toBeDefined();
      expect(result).toEqual(expectedValue);
    });

    it('should handle errors gracefully', async () => {
      // Test error cases
      await expect(instance.methodName(invalidInput)).rejects.toThrow();
    });
  });
});
```

### 3. Mocking Guidelines

- Mock external dependencies (databases, APIs, third-party libraries)
- Keep mocks simple and focused
- Use `jest.fn()` for simple function mocks
- Use `jest.mock()` for module mocks

### 4. Test Cases to Include

For each function/method, test:
- ✅ Happy path (expected behavior)
- ✅ Edge cases (empty inputs, null values)
- ✅ Error cases (invalid inputs, failures)
- ✅ Boundary conditions

## Continuous Integration

Tests run automatically on:
- Every push to any branch
- Every pull request
- Before deployment

## Troubleshooting

### Tests Fail Locally

1. Make sure all dependencies are installed:
   ```bash
   npm install
   ```

2. Check that environment variables are set in `tests/setup.ts`

3. Clear Jest cache:
   ```bash
   npx jest --clearCache
   ```

### Mock Issues

If mocks aren't working:
- Ensure mocks are declared before imports
- Check mock paths are correct
- Verify `jest.clearAllMocks()` is called in `afterEach`

### Database Tests Failing

- Database tests use mocked `db.query()`
- No real database connection required
- Check that mocks return expected structure

## Best Practices

1. **Keep tests isolated** - Each test should be independent
2. **Use descriptive names** - Test names should explain what they verify
3. **Follow AAA pattern** - Arrange, Act, Assert
4. **Mock external dependencies** - Don't rely on external services
5. **Test one thing at a time** - Each test should verify one behavior
6. **Keep tests fast** - Use mocks to avoid slow operations
7. **Maintain high coverage** - Aim for >80% coverage on critical paths

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Testing Best Practices](https://testingjavascript.com/)
- [TypeScript Jest Guide](https://kulshekhar.github.io/ts-jest/)


