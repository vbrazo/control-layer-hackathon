import axios from 'axios';

// Get API URL - avoid localhost in production to prevent local network permission prompts
// When a page served over HTTPS tries to connect to http://localhost, browsers
// trigger "local network access" permission prompts for security reasons.
function getApiUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  
  if (envUrl) {
    return envUrl;
  }
  
  // Check if we're in production (client-side)
  if (typeof window !== 'undefined') {
    const isProduction = !window.location.hostname.match(/^(localhost|127\.0\.0\.1)$/);
    
    if (isProduction) {
      // In production, NEXT_PUBLIC_API_URL must be set
      // Using localhost here would trigger browser permission prompts
      console.error(
        '⚠️ NEXT_PUBLIC_API_URL is not set in production!\n' +
        'This causes browser permission prompts for local network access.\n' +
        'Please set NEXT_PUBLIC_API_URL to your backend URL (e.g., https://your-backend-app.herokuapp.com)'
      );
      // Return empty string - API calls will fail, but at least we won't trigger permission prompts
      return '';
    }
  }
  
  // Development fallback
  return 'http://localhost:3001';
}

const API_URL = getApiUrl();

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout to prevent hanging requests
});

export interface ComplianceFinding {
  id: string;
  type: 'security' | 'license' | 'quality' | 'custom';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  message: string;
  file: string;
  line?: number;
  column?: number;
  code?: string;
  fixSuggestion?: string;
  ruleId: string;
  ruleName: string;
}

export interface AnalysisResult {
  id: string;
  prNumber: number;
  repoFullName: string;
  status: 'pending' | 'analyzing' | 'completed' | 'failed';
  findings: ComplianceFinding[];
  analyzedAt: Date;
  duration: number;
  stats: {
    totalFiles: number;
    totalFindings: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
}

export interface Stats {
  totalAnalyses: number;
  totalFindings: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  infoIssues: number;
  avgDuration: number;
}

// Helper function to handle API errors gracefully
function handleApiError(error: any, operation: string): never {
  // Log error for debugging
  if (error.response) {
    // Server responded with error status (4xx, 5xx)
    console.error(`API Error (${operation}):`, {
      status: error.response.status,
      data: error.response.data,
      message: error.message,
    });
  } else if (error.request) {
    // Request made but no response received (network error, timeout, CORS, etc.)
    console.error(`Network Error (${operation}):`, {
      message: error.message,
      code: error.code,
    });
  } else {
    // Something else happened
    console.error(`Error (${operation}):`, error.message);
  }
  
  // Re-throw to be caught by calling code (which will use mock data)
  throw error;
}

// API methods
export const analysisApi = {
  getRecentAnalyses: async (limit = 50): Promise<AnalysisResult[]> => {
    try {
      const response = await api.get('/analyses', { params: { limit } });
      return response.data.data;
    } catch (error) {
      handleApiError(error, 'getRecentAnalyses');
    }
  },

  getAnalysis: async (id: string): Promise<AnalysisResult> => {
    try {
      const response = await api.get(`/analyses/${id}`);
      return response.data.data;
    } catch (error) {
      handleApiError(error, 'getAnalysis');
    }
  },

  getAnalysesByRepo: async (repo: string, limit = 50): Promise<AnalysisResult[]> => {
    try {
      const response = await api.get('/analyses', { params: { repo, limit } });
      return response.data.data;
    } catch (error) {
      handleApiError(error, 'getAnalysesByRepo');
    }
  },

  getStats: async (): Promise<Stats> => {
    try {
      const response = await api.get('/stats');
      return response.data.data;
    } catch (error) {
      handleApiError(error, 'getStats');
    }
  },

  triggerScan: async (owner: string, repo: string, prNumber: number) => {
    try {
      const response = await api.post('/trigger-scan', { owner, repo, prNumber });
      return response.data;
    } catch (error) {
      handleApiError(error, 'triggerScan');
    }
  },
};
