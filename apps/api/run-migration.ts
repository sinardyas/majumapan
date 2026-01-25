import { db } from './src/db/index.js';
import * as fs from 'fs';

const sql = fs.readFileSync('./drizzle/0009_eod_tables_supplemental.sql', 'utf-8');
const statements = sql.split('--> statement-breakpoint');

for (const statement of statements) {
  if (statement.trim()) {
    try {
      await db.execute(statement);
      console.log('OK:', statement.substring(0, 60));
    } catch (e: any) {
      if (e.message?.includes('already exists')) {
        console.log('SKIP:', statement.substring(0, 60));
      } else {
        console.log('ERR:', e.message?.substring(0, 100) || statement.substring(0, 60));
      }
    }
  }
}

console.log('Migration completed!');
