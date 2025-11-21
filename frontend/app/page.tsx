'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Zap, Lock, FileCheck, Github, ArrowRight } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Compliance Copilot</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost">Dashboard</Button>
            </Link>
            <Link href="/docs">
              <Button variant="ghost">Docs</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container py-24 md:py-32">
        <div className="flex flex-col items-center text-center space-y-8">
          <div className="inline-flex items-center rounded-full border px-3 py-1 text-sm">
            <Zap className="mr-2 h-3 w-3 text-yellow-500" />
            Powered by E2B, MCP, and Groq AI
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight max-w-4xl">
            Automated Compliance Analysis for GitHub Pull Requests
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl">
            AI-powered compliance assistant that automatically checks for security vulnerabilities,
            license compliance, code quality issues, and custom company rules.
          </p>

          <div className="flex gap-4">
            <Link href="/dashboard">
              <Button size="lg" variant="outline">
                View Demo <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container pb-24">
        <h2 className="text-3xl font-bold text-center mb-12">
          Comprehensive Compliance Checks
        </h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader>
              <Lock className="h-10 w-10 text-red-500 mb-2" />
              <CardTitle>Security</CardTitle>
              <CardDescription>
                Detect hardcoded secrets, SQL injection, XSS, weak cryptography, and more
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• API key detection</li>
                <li>• Vulnerability scanning</li>
                <li>• Dangerous code patterns</li>
                <li>• OWASP Top 10 checks</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <FileCheck className="h-10 w-10 text-blue-500 mb-2" />
              <CardTitle>License Compliance</CardTitle>
              <CardDescription>
                Ensure license compatibility and detect GPL violations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• GPL violation detection</li>
                <li>• Missing license headers</li>
                <li>• License compatibility</li>
                <li>• Open source compliance</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Zap className="h-10 w-10 text-yellow-500 mb-2" />
              <CardTitle>Code Quality</CardTitle>
              <CardDescription>
                Maintain high code quality with automated analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Complexity analysis</li>
                <li>• Code smell detection</li>
                <li>• Best practice validation</li>
                <li>• Maintainability scoring</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Shield className="h-10 w-10 text-green-500 mb-2" />
              <CardTitle>Custom Rules</CardTitle>
              <CardDescription>
                Configure company-specific policies and rules
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Regex pattern matching</li>
                <li>• Banned dependencies</li>
                <li>• Custom severity levels</li>
                <li>• Flexible configuration</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How It Works */}
      <section className="container pb-24">
        <h2 className="text-3xl font-bold text-center mb-12">
          How It Works
        </h2>
        
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
              1
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Open a Pull Request</h3>
              <p className="text-muted-foreground">
                When you open or update a PR, our GitHub App automatically receives a webhook notification.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
              2
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">E2B Sandbox Analysis</h3>
              <p className="text-muted-foreground">
                Code is analyzed in an isolated E2B sandbox with MCP tools for secure scanning.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
              3
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">AI-Powered Validation</h3>
              <p className="text-muted-foreground">
                Groq AI validates findings and provides actionable fix suggestions with code examples.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
              4
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Get Results</h3>
              <p className="text-muted-foreground">
                Receive detailed findings as PR comments with severity levels, descriptions, and fixes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container pb-24">
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="flex flex-col items-center text-center py-16 space-y-6">
            <h2 className="text-3xl font-bold">Ready to Automate Compliance?</h2>
            <p className="text-lg max-w-2xl opacity-90">
              Install our GitHub App and start catching compliance issues before they reach production.
            </p>
            <Button size="lg" variant="secondary" onClick={() => window.open('https://calendly.com/imvitoroliveira', '_blank')}>
              <Github className="mr-2 h-5 w-5" />
              Contact us to install the app
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            Built with ❤️ for the E2B + MCP Hackathon
          </p>
          <div className="flex gap-4">
            <Link href="/docs" className="text-sm text-muted-foreground hover:text-foreground">
              Documentation
            </Link>
            <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
              Dashboard
            </Link>
            <a href="https://github.com" className="text-sm text-muted-foreground hover:text-foreground">
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

