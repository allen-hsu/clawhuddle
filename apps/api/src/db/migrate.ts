import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb, closeDb } from './index.js';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const db = getDb();

// Run base schema
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

// Run migration files in order
const migrationsDir = path.join(__dirname, 'migrations');
if (fs.existsSync(migrationsDir)) {
  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    try {
      db.exec(sql);
      console.log(`Migration applied: ${file}`);
    } catch (err: any) {
      // Ignore "duplicate column" errors for idempotency
      if (err.message?.includes('duplicate column')) {
        console.log(`Migration skipped (already applied): ${file}`);
      } else {
        throw err;
      }
    }
  }
}

closeDb();
console.log('Database migrated successfully.');
