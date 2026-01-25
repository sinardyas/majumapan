import { Client } from 'pg';
import fs from 'fs';

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pos',
});

async function runMigration() {
  try {
    await client.connect();
    console.log('Connected to database');
    
    const sql = fs.readFileSync('./apps/api/drizzle/0009_eod_tables_supplemental.sql', 'utf-8');
    
    // Split by statement-breakpoint and execute each
    const statements = sql.split('--> statement-breakpoint');
    
    for (const statement of statements) {
      const trimmed = statement.trim();
      if (trimmed) {
        try {
          await client.query(trimmed);
          console.log('Executed:', trimmed.substring(0, 60) + '...');
        } catch (err) {
          if (err.message.includes('already exists') || err.message.includes('already')) {
            console.log('Skipped (already exists):', trimmed.substring(0, 60) + '...');
          } else {
            console.error('Error:', err.message);
          }
        }
      }
    }
    
    console.log('Migration completed!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.end();
  }
}

runMigration();
