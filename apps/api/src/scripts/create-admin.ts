import { getDb, closeDb } from '../db/index.js';
import { v4 as uuid } from 'uuid';
import 'dotenv/config';

const email = process.argv[2];
if (!email) {
  console.error('Usage: npm run create-admin -- <email>');
  process.exit(1);
}

const db = getDb();

const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
if (existing) {
  db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(email);
  console.log(`Updated ${email} to admin.`);
} else {
  const id = uuid();
  db.prepare(
    "INSERT INTO users (id, email, role) VALUES (?, ?, 'admin')"
  ).run(id, email);
  console.log(`Created admin user: ${email} (id: ${id})`);
}

closeDb();
