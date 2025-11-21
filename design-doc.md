# AI Compliance Copilot Implementation Plan

## 1. Project Structure & Dependencies

Create monorepo structure with backend, frontend, demo repos, and shared configuration:

- `/backend` - Node.js/TypeScript API with E2B + Groq + MCP
- `/frontend` - Next.js 14 dashboard and landing page  
- `/demo-repos` - 3 sample repos with intentional compliance issues
- `/docs` - Setup guides and API documentation
- Root config files: `package.json`, `docker-compose.yml`, `.env.example`

## 2. Backend Implementation

### Core Services

**`backend/src/agent/e2b-agent.ts`**

- E2B Code Interpreter sandbox initialization
- MCP tool registration (GitHub, filesystem, security scanners)
- Sandbox lifecycle management with proper cleanup

**`backend/src/analysis/groq-analyzer.ts`**

- Groq API integration (llama-3.1-70b-versatile for speed)
- Prompt engineering for 4 compliance categories:
  - Security vulnerabilities (SQL injection, XSS, hardcoded secrets)
  - License compliance (GPL violations, missing headers)
  - Code quality (complexity, code smells)
  - Custom company rules validation
- Structured output parsing (JSON mode)

**`backend/src/compliance/rules-engine.ts`**

- Regex-based pattern matching (API keys, AWS credentials, private keys)
- Dependency scanning (package.json/requirements.txt for known CVEs)
- License header validation
- Configurable rule sets with severity levels

**`backend/src/github/app-handler.ts`**

- GitHub App authentication (JWT + installation tokens)
- Webhook signature verification
- Event handlers: `pull_request.opened`, `pull_request.synchronize`, `issue_comment.created`

**`backend/src/github/pr-analyzer.ts`**

- Orchestrates full PR analysis workflow:

  1. Fetch changed files via GitHub MCP
  2. Run rules engine on all files
  3. Send files to E2B sandbox for MCP tool analysis
  4. Pass findings to Groq for AI validation + fix suggestions
  5. Post findings as PR comments or create fix PR

- Handles @mention commands in comments (`@compliance-bot scan`, `@compliance-bot fix`)

**`backend/src/api/routes.ts`**

- REST API for dashboard:
  - `GET /api/analyses` - Recent analysis history
  - `GET /api/analyses/:id` - Detailed findings
  - `POST /api/config/rules` - Update custom rules
  - `GET /api/stats` - Compliance statistics
  - `POST /api/trigger-scan` - Manual PR scan trigger

### Configuration

**`backend/src/config/mcp-config.ts`**

- MCP server configurations for E2B:
  - GitHub MCP: repo access, PR operations, file reading
  - Filesystem MCP: code navigation in sandbox
  - Security scanner MCPs (if available)

**`backend/.env.example`**

```
E2B_API_KEY=
GROQ_API_KEY=
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_WEBHOOK_SECRET=
DATABASE_URL=
PORT=3001
```

### Testing

- Unit tests for rules engine (Jest)
- Integration tests for GitHub webhook flow
- E2B sandbox mock tests

## 3. Frontend Implementation

### Pages & Components

**`frontend/app/page.tsx` - Landing Page**

- Hero section with animated compliance check demo
- Feature grid: 4 compliance types with icons
- Live demo: embedded PR analysis example
- Architecture diagram: E2B + MCP + Groq flow
- GitHub App installation button
- Tech stack badges (E2B, Groq, MCP logos)

**`frontend/app/dashboard/page.tsx` - Dashboard**

- Recent analyses table (repo, PR, status, findings count)
- Statistics cards: total scans, critical issues, auto-fixed
- Severity breakdown chart (Recharts pie chart)
- Quick action buttons: trigger scan, configure rules

**`frontend/app/dashboard/config/page.tsx` - Configuration**

- Custom rules editor (Monaco editor for regex patterns)
- Enable/disable compliance categories
- Severity threshold settings
- GitHub repositories management

**`frontend/app/docs/page.tsx` - Documentation**

- Installation guide for GitHub App
- Custom rules syntax reference
- API documentation (auto-generated from OpenAPI spec)
- MCP integrations explanation

**Shared Components**

- `components/ui/*` - shadcn/ui primitives (Button, Card, Table, Dialog)
- `components/ComplianceTable.tsx` - Reusable findings table
- `components/SeverityBadge.tsx` - Color-coded severity indicators
- `components/CodeViewer.tsx` - Syntax-highlighted code snippets

### Styling

- Tailwind CSS with dark mode support
- Custom theme matching E2B brand colors
- Responsive design (mobile-first)

## 4. Demo Repositories

**`demo-repos/vulnerable-ecommerce/`**

```
src/
  config.js - Hardcoded Stripe API key
  db.js - SQL injection vulnerability
  auth.js - Weak password hashing (MD5)
package.json - express@4.0.0 (CVE-2014-6393)
LICENSE - Missing
```

**`demo-repos/corporate-backend/`**

```
.env - Committed AWS credentials (intentional)
src/
  license-violation.js - Uses GPL library in proprietary code
  api.js - Missing helmet security headers
  utils.js - 200-line function (complexity issue)
LICENSE - Proprietary but imports GPL dependency
```

**`demo-repos/crypto-wallet/`**

```
src/
  crypto.js - Uses DES encryption (weak algorithm)
  keys.js - Hardcoded private key in source
  wallet.js - Dangerous eval() usage
  validation.js - No input sanitization
package.json - crypto-js@3.1.2 (known vulnerability)
```

Each repo includes:

- README with "intentional issues" disclaimer
- GitHub Actions workflow triggering compliance checks
- Example PR with compliance bot comments

## 5. Deployment Configuration

**`docker-compose.yml`**

- Backend service (Node.js container)
- PostgreSQL database (analysis history)
- Redis (webhook queue)
- Frontend service (Next.js production build)
- Nginx reverse proxy

**`backend/Dockerfile`**

- Multi-stage build (TypeScript compilation)
- Production dependencies only
- Health check endpoint

**`frontend/Dockerfile`**

- Next.js production build
- Static asset optimization
- Environment variable injection

**`.github/workflows/deploy.yml`**

- CI/CD pipeline: lint → test → build → deploy
- Deploy to Railway/Vercel (backend) + Vercel (frontend)
- Automated E2B sandbox testing

**`docs/DEPLOYMENT.md`**

- GitHub App setup instructions (webhook URL, permissions)
- Environment variables guide
- Scaling considerations (E2B sandbox limits)

## 6. Documentation

**`README.md`**

- Project overview with demo video/GIF
- Quick start guide
- Architecture diagram (Mermaid)
- Features showcase
- Contributing guidelines

**`docs/ARCHITECTURE.md`**

- Detailed E2B + MCP integration explanation
- Groq prompt engineering strategies
- Compliance rules taxonomy
- GitHub App flow diagrams

**`docs/API.md`**

- OpenAPI 3.0 specification
- cURL examples for all endpoints
- Webhook payload schemas

## 7. Key Implementation Details

### E2B Sandbox Workflow

1. Webhook triggers PR analysis
2. Spin up E2B Code Interpreter sandbox
3. Install MCP servers in sandbox (GitHub, security tools)
4. Execute analysis script with MCP tool access
5. Return findings + destroy sandbox (cost optimization)

### Groq Analysis Prompt Structure

```
You are a security compliance expert. Analyze this code for:
1. Security vulnerabilities (OWASP Top 10)
2. License compliance issues
3. Code quality problems (complexity, maintainability)
4. Custom rules violations: {custom_rules}

Code: {code_snippet}
Context: {file_path}, {pr_description}

Return JSON: {findings: [{type, severity, line, message, fix_suggestion}]}
```

### GitHub App Permissions Required

- Repository contents: Read & write (for fix PRs)
- Pull requests: Read & write (comments, status checks)
- Issues: Read & write (@mention commands)
- Metadata: Read (repo info)

## Success Criteria

- ✅ Backend successfully analyzes PRs in <30s
- ✅ All 4 compliance categories working
- ✅ E2B sandbox properly integrates MCPs
- ✅ Groq provides actionable fix suggestions
- ✅ Dashboard displays real-time analysis results
- ✅ Demo repos trigger compliance checks automatically
- ✅ Production-ready deployment configuration
- ✅ Comprehensive tests (>80% coverage)
