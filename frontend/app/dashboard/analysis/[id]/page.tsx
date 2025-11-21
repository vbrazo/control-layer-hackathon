'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { analysisApi, AnalysisResult } from '@/lib/api';
import { ComplianceTable } from '@/components/ComplianceTable';
import { SeverityBadge } from '@/components/SeverityBadge';
import { formatDate, formatDuration } from '@/lib/utils';
import { Shield, ArrowLeft, Activity } from 'lucide-react';
import { getMockAnalysis } from '@/lib/mock-data';

export default function AnalysisDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalysis() {
      try {
        const data = await analysisApi.getAnalysis(id);
        setAnalysis(data);
      } catch (error) {
        console.error('Failed to fetch analysis, using mock data:', error);
        // Use mock data as fallback
        const mockData = getMockAnalysis(id);
        if (mockData) {
          setAnalysis(mockData);
        }
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchAnalysis();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Activity className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Analysis not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container flex h-16 items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Analysis Details</span>
          </div>
        </div>
      </header>

      <div className="container py-8 space-y-8">
        {/* Analysis Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">{analysis.repoFullName}</CardTitle>
                <p className="text-muted-foreground mt-1">
                  Pull Request #{analysis.prNumber}
                </p>
              </div>
              <div className="flex gap-2">
                {analysis.stats.critical > 0 && <SeverityBadge severity="critical" />}
                {analysis.stats.high > 0 && <SeverityBadge severity="high" />}
                {analysis.stats.medium > 0 && <SeverityBadge severity="medium" />}
                {analysis.stats.low > 0 && <SeverityBadge severity="low" />}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <p className="text-lg font-semibold capitalize">{analysis.status}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Analyzed At</p>
                <p className="text-lg font-semibold">{formatDate(analysis.analyzedAt)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Duration</p>
                <p className="text-lg font-semibold">{formatDuration(analysis.duration)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Files Analyzed</p>
                <p className="text-lg font-semibold">{analysis.stats.totalFiles}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Summary */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-red-500">{analysis.stats.critical}</p>
                <p className="text-sm text-muted-foreground mt-1">Critical</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-orange-500">{analysis.stats.high}</p>
                <p className="text-sm text-muted-foreground mt-1">High</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-yellow-500">{analysis.stats.medium}</p>
                <p className="text-sm text-muted-foreground mt-1">Medium</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-500">{analysis.stats.low}</p>
                <p className="text-sm text-muted-foreground mt-1">Low</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-gray-500">{analysis.stats.info}</p>
                <p className="text-sm text-muted-foreground mt-1">Info</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Findings */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Findings</h2>
          <ComplianceTable findings={analysis.findings} />
        </div>
      </div>
    </div>
  );
}

