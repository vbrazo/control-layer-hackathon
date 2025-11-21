const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  // Heroku Postgres requires SSL connections
  const isProduction = process.env.NODE_ENV === 'production';
  const sslConfig = isProduction 
    ? { rejectUnauthorized: false } // Heroku Postgres uses self-signed certs
    : undefined;

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
    ssl: sslConfig,
  });

  // Retry logic for database connection
  let retries = 10;
  let client;
  
  while (retries > 0) {
    try {
      console.log(`Connecting to database... (${11 - retries}/10)`);
      client = await pool.connect();
      console.log('Connected successfully!');
      break;
    } catch (error) {
      retries--;
      if (retries === 0) {
        console.error('Failed to connect to database after 10 attempts');
        throw error;
      }
      console.log(`Connection failed, retrying in 2 seconds... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  try {

    // Read the schema file
    // Handle both source (backend/src/db/schema.sql) and compiled (backend/dist/src/db/schema.sql) locations
    let schemaPath = path.join(__dirname, '../src/db/schema.sql');
    if (!fs.existsSync(schemaPath)) {
      // Try alternative path if running from compiled location
      schemaPath = path.join(__dirname, '../../src/db/schema.sql');
    }
    if (!fs.existsSync(schemaPath)) {
      // Try root-relative path (for Heroku deployment from root)
      schemaPath = path.join(process.cwd(), 'backend/src/db/schema.sql');
    }
    if (!fs.existsSync(schemaPath)) {
      console.error(`Schema file not found. Tried: ${schemaPath}`);
      process.exit(1);
    }
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('Running migrations...');
    
    // Execute the schema (PostgreSQL handles multiple statements)
    await client.query(schema);
    
    console.log('Migration completed successfully!');
    
    client.release();
  } catch (error) {
    console.error('Migration failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();

