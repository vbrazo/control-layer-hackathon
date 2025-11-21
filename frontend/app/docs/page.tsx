import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, ArrowLeft, Book, Code, Settings } from 'lucide-react';

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container flex h-16 items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Documentation</span>
          </div>
        </div>
      </header>

      <div className="container py-8 max-w-4xl">
        {/* Quick Links */}
        <div className="grid md:grid-cols-3 gap-4 mb-12">
          <Card>
            <CardHeader>
              <Book className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-lg">Getting Started</CardTitle>
              <CardDescription>Installation and setup guide</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <Code className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-lg">API Reference</CardTitle>
              <CardDescription>REST API endpoints and schemas</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <Settings className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-lg">Configuration</CardTitle>
              <CardDescription>Custom rules and settings</CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Installation */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-4">Installation</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-2">1. Install GitHub App</h3>
              <p className="text-muted-foreground mb-4">
                Visit the GitHub Marketplace and install the Compliance Copilot app to your repositories.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2">2. Configure Repositories</h3>
              <p className="text-muted-foreground mb-4">
                Select which repositories should have automated compliance checking enabled.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-2">3. Create a Pull Request</h3>
              <p className="text-muted-foreground mb-4">
                Open a PR and the bot will automatically analyze it for compliance issues.
              </p>
            </div>
          </div>
        </section>

        {/* Commands */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-4">Bot Commands</h2>
          
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div>
                  <code className="bg-muted px-2 py-1 rounded">@compliance-bot scan</code>
                  <p className="text-sm text-muted-foreground mt-1">
                    Manually trigger a compliance analysis on the current PR
                  </p>
                </div>
                <div>
                  <code className="bg-muted px-2 py-1 rounded">@compliance-bot fix</code>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create a new PR with automated fixes for detected issues
                  </p>
                </div>
                <div>
                  <code className="bg-muted px-2 py-1 rounded">@compliance-bot ignore [rule]</code>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ignore specific rule violations in this PR
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Custom Rules */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-4">Custom Rules</h2>
          
          <p className="text-muted-foreground mb-4">
            Configure custom compliance rules for your organization. Rules can be regex patterns,
            dependency checks, or license validations.
          </p>

          <Card>
            <CardHeader>
              <CardTitle>Example Rule Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
{`{
  "id": "custom-api-pattern",
  "name": "Internal API Pattern",
  "description": "Use internal API endpoints only",
  "type": "regex",
  "pattern": "https://external-api\\\\.com",
  "severity": "high",
  "category": "custom",
  "fixTemplate": "Use https://internal-api.company.com instead"
}`}
              </pre>
            </CardContent>
          </Card>
        </section>

        {/* API Reference */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-4">API Reference</h2>
          
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <code className="text-sm">GET /api/analyses</code>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Get recent compliance analyses
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Query params: limit (number), repo (string)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <code className="text-sm">GET /api/analyses/:id</code>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Get detailed analysis with all findings
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <code className="text-sm">GET /api/stats</code>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Get overall compliance statistics
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <code className="text-sm">POST /api/trigger-scan</code>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Manually trigger a PR scan
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Body: {`{ owner, repo, prNumber }`}
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Architecture */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-4">Architecture</h2>
          
          <p className="text-muted-foreground mb-4">
            Compliance Copilot uses a multi-stage analysis pipeline combining regex rules,
            E2B sandboxed execution with MCP tools, and Groq AI for intelligent validation.
          </p>

          <div className="space-y-2 text-sm">
            <p><strong>Stage 1:</strong> Rules Engine - Fast regex-based pattern matching</p>
            <p><strong>Stage 2:</strong> E2B Sandbox - Isolated code analysis with MCP integrations</p>
            <p><strong>Stage 3:</strong> Groq AI - AI-powered validation and fix suggestions</p>
          </div>
        </section>
      </div>
    </div>
  );
}

