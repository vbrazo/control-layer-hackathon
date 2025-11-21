import { Pool, PoolClient, QueryResult } from 'pg';
import config from '../config';
import logger from '../utils/logger';

class DatabaseClient {
  private pool: Pool;

  constructor() {
    // Heroku Postgres requires SSL connections
    const isProduction = config.NODE_ENV === 'production';
    const sslConfig = isProduction 
      ? { rejectUnauthorized: false } // Heroku Postgres uses self-signed certs
      : undefined;

    this.pool = new Pool({
      connectionString: config.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ssl: sslConfig,
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected database error:', err);
    });

    logger.info('Database client initialized');
  }

  /**
   * Execute a query
   */
  async query(text: string, params?: unknown[]): Promise<QueryResult> {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      logger.debug(`Query executed in ${duration}ms`);
      return result;
    } catch (error) {
      logger.error('Database query error:', error);
      throw error;
    }
  }

  /**
   * Get a client for transactions
   */
  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    await this.pool.end();
    logger.info('Database pool closed');
  }

  /**
   * Check database health
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  }
}

export const db = new DatabaseClient();
export default db;

