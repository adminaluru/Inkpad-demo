import { randomUUID } from 'node:crypto';
import { hashPassword } from './passwords.js';

// These accounts exist so reviewers can try the sharing flow without a signup
// step. The password is public on purpose; see the README.
export const DEMO_PASSWORD = 'inkpad-demo';

export const DEMO_USERS = [
  { name: 'Alice Chen', email: 'alice@inkpad.test' },
  { name: 'Bob Martin', email: 'bob@inkpad.test' },
  { name: 'Carol Diaz', email: 'carol@inkpad.test' },
];

const WELCOME_HTML = `
<h1>Welcome to Inkpad</h1>
<p>This document belongs to <strong>Alice</strong> and is shared with <strong>Bob</strong> as an editor. Sign in as either of them to see how it shows up on each side.</p>
<h2>Things to try</h2>
<ul>
  <li>Format text with <strong>bold</strong>, <em>italic</em> and <u>underline</u></li>
  <li>Switch a paragraph to a heading from the toolbar</li>
  <li>Upload a .txt, .md or .docx file from the documents page</li>
</ul>
<ol>
  <li>Open the Share dialog</li>
  <li>Give Carol view-only access</li>
  <li>Sign in as Carol and check that she can read but not edit</li>
</ol>
`.trim();

export function seedUsers(db) {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO users (email, name, password_hash) VALUES (?, ?, ?)',
  );
  const exists = db.prepare('SELECT 1 FROM users WHERE email = ?');

  let created = 0;
  for (const user of DEMO_USERS) {
    if (exists.get(user.email)) continue;
    insert.run(user.email, user.name, hashPassword(DEMO_PASSWORD));
    created += 1;
  }
  return created;
}

export function seedDemoData(db) {
  const created = seedUsers(db);
  // Only add the welcome doc on a brand new database, otherwise it would come
  // back every time someone deleted it and restarted the server.
  if (created !== DEMO_USERS.length) return;

  const findUser = db.prepare('SELECT id FROM users WHERE email = ?');
  const alice = findUser.get('alice@inkpad.test');
  const bob = findUser.get('bob@inkpad.test');
  const now = new Date().toISOString();
  const id = randomUUID();

  db.prepare(
    `INSERT INTO documents (id, title, content, owner_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, 'Welcome to Inkpad', WELCOME_HTML, alice.id, now, now);

  db.prepare(
    'INSERT INTO shares (document_id, user_id, role, created_at) VALUES (?, ?, ?, ?)',
  ).run(id, bob.id, 'editor', now);
}
