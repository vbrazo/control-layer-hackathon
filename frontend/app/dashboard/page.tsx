'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { analysisApi, AnalysisResult, Stats } from '@/lib/api';
import { SeverityBadge } from '@/components/SeverityBadge';
import { formatDate, formatDuration } from '@/lib/utils';
import { Shield, ArrowLeft, Activity, AlertTriangle, CheckCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { mockAnalyses, mockStats } from '@/lib/mock-data';

// Skeleton loader component
function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="h-4 w-24 bg-muted animate-pulse rounded" />
        <div className="h-4 w-4 bg-muted animate-pulse rounded" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-16 bg-muted animate-pulse rounded mb-2" />
        <div className="h-3 w-32 bg-muted animate-pulse rounded" />
      </CardContent>
    </Card>
  );
}

function AnalysisItemSkeleton() {
  return (
    <div className="border rounded-lg p-4 animate-pulse">
      <div className="flex items-center justify-between mb-2">
        <div className="flex-1">
          <div className="h-5 w-48 bg-muted rounded mb-2" />
          <div className="h-4 w-24 bg-muted rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-6 w-16 bg-muted rounded" />
          <div className="h-6 w-16 bg-muted rounded" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="h-4 w-20 bg-muted rounded" />
        <div className="h-4 w-16 bg-muted rounded" />
        <div className="h-4 w-24 bg-muted rounded" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [analysesLoading, setAnalysesLoading] = useState(true);

  // Load stats and analyses independently for progressive loading
  useEffect(() => {
    // Load stats first (usually faster)
    async function fetchStats() {
      try {
        const statsData = await analysisApi.getStats();
        setStats(statsData);
      } catch (error) {
        console.error('Failed to fetch stats, using mock data:', error);
        setStats(mockStats);
      } finally {
        setStatsLoading(false);
      }
    }

    // Load analyses separately
    async function fetchAnalyses() {
      try {
        const analysesData = await analysisApi.getRecentAnalyses(20);
        setAnalyses(analysesData);
      } catch (error) {
        console.error('Failed to fetch analyses, using mock data:', error);
        setAnalyses(mockAnalyses);
      } finally {
        setAnalysesLoading(false);
      }
    }

    // Start both requests but don't wait for both
    fetchStats();
    fetchAnalyses();
  }, []);

  const chartData = stats
    ? [
        { name: 'Critical', value: stats.criticalIssues, color: '#ef4444' },
        { name: 'High', value: stats.highIssues, color: '#f97316' },
        { name: 'Medium', value: stats.mediumIssues, color: '#eab308' },
        { name: 'Low', value: stats.lowIssues, color: '#3b82f6' },
        { name: 'Info', value: stats.infoIssues, color: '#6b7280' },
      ]
    : [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">Compliance Dashboard</span>
            </div>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/docs">
              <Button variant="ghost">Docs</Button>
            </Link>
          </nav>
        </div>
      </header>

      <div className="container py-8 space-y-8">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statsLoading ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Analyses</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalAnalyses || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Avg: {stats ? formatDuration(stats.avgDuration) : '0s'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Findings</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalFindings || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Across all repositories
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Critical Issues</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-500">
                    {stats?.criticalIssues || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Requires immediate attention
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">High Priority</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-500">
                    {stats?.highIssues || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Should be addressed soon
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Charts and Recent Analyses */}
        <div className="grid gap-8 md:grid-cols-2">
          {/* Severity Distribution Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Findings by Severity</CardTitle>
              <CardDescription>Distribution of compliance issues</CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="flex items-center justify-center h-[300px]">
                  <Activity className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : chartData.some(d => d.value > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mr-2" />
                  <span>No issues found</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
              <CardDescription>Overall compliance metrics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {statsLoading ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b">
                    <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                    <div className="h-8 w-16 bg-muted animate-pulse rounded" />
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b">
                    <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                    <div className="h-8 w-16 bg-muted animate-pulse rounded" />
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b">
                    <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                    <div className="h-8 w-16 bg-muted animate-pulse rounded" />
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                    <div className="h-8 w-16 bg-muted animate-pulse rounded" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center pb-2 border-b">
                    <span className="text-sm font-medium">Security Issues</span>
                    <span className="text-2xl font-bold text-red-500">
                      {(stats?.criticalIssues ?? 0) + (stats?.highIssues ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b">
                    <span className="text-sm font-medium">Medium Priority</span>
                    <span className="text-2xl font-bold text-yellow-500">
                      {stats?.mediumIssues || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b">
                    <span className="text-sm font-medium">Low Priority</span>
                    <span className="text-2xl font-bold text-blue-500">
                      {stats?.lowIssues || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Info</span>
                    <span className="text-2xl font-bold text-gray-500">
                      {stats?.infoIssues || 0}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Analyses Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Analyses</CardTitle>
            <CardDescription>Latest PR compliance scans</CardDescription>
          </CardHeader>
          <CardContent>
            {analysesLoading ? (
              <div className="space-y-3">
                <AnalysisItemSkeleton />
                <AnalysisItemSkeleton />
                <AnalysisItemSkeleton />
              </div>
            ) : analyses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Activity className="h-12 w-12 mb-4" />
                <p>No analyses yet. Install the GitHub App to get started.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {analyses.map((analysis) => (
                  <Link
                    key={analysis.id}
                    href={`/dashboard/analysis/${analysis.id}`}
                    className="block"
                  >
                    <div className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium">{analysis.repoFullName}</p>
                          <p className="text-sm text-muted-foreground">
                            PR #{analysis.prNumber}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {analysis.stats.critical > 0 && (
                            <SeverityBadge severity="critical" />
                          )}
                          {analysis.stats.high > 0 && (
                            <SeverityBadge severity="high" />
                          )}
                          {analysis.stats.medium > 0 && (
                            <SeverityBadge severity="medium" />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{analysis.stats.totalFindings} findings</span>
                        <span>•</span>
                        <span>{analysis.stats.totalFiles} files</span>
                        <span>•</span>
                        <span>{formatDate(analysis.analyzedAt)}</span>
                        <span>•</span>
                        <span>{formatDuration(analysis.duration)}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

