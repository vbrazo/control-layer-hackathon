-- Compliance Copilot Database Schema

-- Analysis Results Table
CREATE TABLE IF NOT EXISTS analyses (
    id UUID PRIMARY KEY,
    pr_number INTEGER NOT NULL,
    repo_full_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    analyzed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    duration INTEGER NOT NULL,
    total_files INTEGER NOT NULL,
    total_findings INTEGER NOT NULL,
    critical_count INTEGER NOT NULL DEFAULT 0,
    high_count INTEGER NOT NULL DEFAULT 0,
    medium_count INTEGER NOT NULL DEFAULT 0,
    low_count INTEGER NOT NULL DEFAULT 0,
    info_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Findings Table
CREATE TABLE IF NOT EXISTS findings (
    id UUID PRIMARY KEY,
    analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    file VARCHAR(500) NOT NULL,
    line INTEGER,
    "column" INTEGER,
    code TEXT,
    fix_suggestion TEXT,
    rule_id VARCHAR(100) NOT NULL,
    rule_name VARCHAR(200) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Custom Rules Table
CREATE TABLE IF NOT EXISTS custom_rules (
    id UUID PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    type VARCHAR(50) NOT NULL,
    pattern TEXT,
    severity VARCHAR(20) NOT NULL,
    category VARCHAR(50) NOT NULL,
    fix_template TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Repository Configuration Table
CREATE TABLE IF NOT EXISTS repo_configs (
    id UUID PRIMARY KEY,
    repo_full_name VARCHAR(255) NOT NULL UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    auto_scan BOOLEAN NOT NULL DEFAULT true,
    auto_fix BOOLEAN NOT NULL DEFAULT false,
    severity_threshold VARCHAR(20) NOT NULL DEFAULT 'high',
    custom_rules JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_analyses_repo ON analyses(repo_full_name);
CREATE INDEX IF NOT EXISTS idx_analyses_pr ON analyses(pr_number);
CREATE INDEX IF NOT EXISTS idx_analyses_status ON analyses(status);
CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_findings_analysis_id ON findings(analysis_id);
CREATE INDEX IF NOT EXISTS idx_findings_severity ON findings(severity);
CREATE INDEX IF NOT EXISTS idx_findings_type ON findings(type);
CREATE INDEX IF NOT EXISTS idx_custom_rules_enabled ON custom_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_repo_configs_repo ON repo_configs(repo_full_name);

