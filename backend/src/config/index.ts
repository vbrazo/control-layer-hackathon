import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env file if it exists (for local development)
// On Heroku, environment variables are already in process.env
dotenv.config({ path: '.env' });

// Debug: Log which env vars are present (without values for security)
if (process.env.NODE_ENV === 'production') {
  const requiredVars = ['E2B_API_KEY', 'GROQ_API_KEY', 'GITHUB_APP_ID', 'GITHUB_APP_PRIVATE_KEY', 'GITHUB_WEBHOOK_SECRET', 'DATABASE_URL'];
  console.log('Environment variables check:');
  requiredVars.forEach(varName => {
    const isSet = !!process.env[varName];
    const length = process.env[varName]?.length || 0;
    console.log(`  ${varName}: ${isSet ? `SET (${length} chars)` : 'NOT SET'}`);
  });
}

const configSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3001'),
  
  // E2B
  E2B_API_KEY: z.string().min(1, 'E2B_API_KEY is required'),
  
  // Groq
  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is required'),
  GROQ_MODEL: z.string().default('llama-3.1-70b-versatile'),
  
  // GitHub App
  GITHUB_APP_ID: z.string().min(1, 'GITHUB_APP_ID is required'),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1, 'GITHUB_APP_PRIVATE_KEY is required'),
  GITHUB_WEBHOOK_SECRET: z.string().min(1, 'GITHUB_WEBHOOK_SECRET is required'),
  
  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  
  // Redis
  REDIS_URL: z.string().url('REDIS_URL must be a valid URL').default('redis://localhost:6379'),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

type Config = z.infer<typeof configSchema>;

let config: Config;

try {
  config = configSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('Configuration validation failed:');
    console.error('Missing or invalid environment variables:');
    error.errors.forEach((err) => {
      const varName = err.path.join('.');
      const isSet = process.env[varName] !== undefined;
      console.error(`  - ${varName}: ${err.message}${isSet ? ' (value is set but invalid)' : ' (not set)'}`);
    });
    console.error('\nPlease ensure all required environment variables are set in Heroku:');
    console.error('  heroku config:set E2B_API_KEY=your_key -a your-app-name');
    console.error('  heroku config:set GROQ_API_KEY=your_key -a your-app-name');
    console.error('  heroku config:set GITHUB_APP_ID=your_id -a your-app-name');
    console.error('  heroku config:set GITHUB_APP_PRIVATE_KEY="your_key" -a your-app-name');
    console.error('  heroku config:set GITHUB_WEBHOOK_SECRET=your_secret -a your-app-name');
    process.exit(1);
  }
  throw error;
}

export default config;
