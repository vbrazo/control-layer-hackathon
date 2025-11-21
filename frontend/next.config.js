/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  env: {
    // Only default to localhost in development
    // In production, NEXT_PUBLIC_API_URL must be set to avoid local network permission prompts
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 
      (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001'),
  },
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 
      (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001');
    
    // Only add rewrite if we have an API URL (for local development)
    if (!apiUrl) {
      return [];
    }
    
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;

