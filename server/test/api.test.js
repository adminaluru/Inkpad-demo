import assert from 'node:assert/strict';
import path from 'node:path';
import { beforeEach, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/db.js';
import { DEMO_PASSWORD, seedUsers } from '../src/seed.js';

const ALICE = 'alice@inkpad.test';
const BOB = 'bob@inkpad.test';
const CAROL = 'carol@inkpad.test';
const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

let app;

beforeEach(() => {
  const db = openDatabase(':memory:');
  seedUsers(db);
  app = createApp(db);
});

async function signIn(email) {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email, password: DEMO_PASSWORD }).expect(200);
  return agent;
}

async function createDoc(agent, title = 'Quarterly plan') {
  const res = await agent.post('/api/documents').send({ title }).expect(201);
  return res.body.document;
}

describe('auth', () => {
  test('rejects a wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ALICE, password: 'nope' })
      .expect(401);
    assert.match(res.body.error, /incorrect/i);
  });

  test('document routes require a session', async () => {
    await request(app).get('/api/documents').expect(401);
  });

  test('logging out ends the session', async () => {
    const alice = await signIn(ALICE);
    await alice.get('/api/auth/me').expect(200);
    await alice.post('/api/auth/logout').expect(204);
    await alice.get('/api/auth/me').expect(401);
  });
});

describe('documents', () => {
  test('create, rename, edit and reopen', async () => {
    const alice = await signIn(ALICE);
    const doc = await createDoc(alice);
    assert.equal(doc.role, 'owner');

    const html = '<h1>Goals</h1><p><strong>Ship</strong> the <em>editor</em></p><ul><li><p>one</p></li></ul>';
    await alice.patch(`/api/documents/${doc.id}`).send({ title: 'Q3 plan', content: html }).expect(200);

    const reopened = await alice.get(`/api/documents/${doc.id}`).expect(200);
    assert.equal(reopened.body.document.title, 'Q3 plan');
    assert.equal(reopened.body.document.content, html);
  });

  test('a rename on its own leaves the content alone', async () => {
    const alice = await signIn(ALICE);
    const doc = await createDoc(alice);
    await alice.patch(`/api/documents/${doc.id}`).send({ content: '<p>hello</p>' }).expect(200);
    await alice.patch(`/api/documents/${doc.id}`).send({ title: 'Renamed' }).expect(200);

    const res = await alice.get(`/api/documents/${doc.id}`).expect(200);
    assert.equal(res.body.document.content, '<p>hello</p>');
  });

  test('rejects an empty or oversized title', async () => {
    const alice = await signIn(ALICE);
    const doc = await createDoc(alice);
    await alice.patch(`/api/documents/${doc.id}`).send({ title: '   ' }).expect(400);
    await alice.patch(`/api/documents/${doc.id}`).send({ title: 'x'.repeat(201) }).expect(400);
    await alice.patch(`/api/documents/${doc.id}`).send({}).expect(400);
  });

  test('strips scripts and event handlers from saved content', async () => {
    const alice = await signIn(ALICE);
    const doc = await createDoc(alice);
    const res = await alice
      .patch(`/api/documents/${doc.id}`)
      .send({ content: '<p onclick="steal()">hi<script>alert(1)</script></p><img src=x onerror=alert(1)>' })
      .expect(200);
    assert.equal(res.body.document.content, '<p>hi</p>');
  });
});

describe('sharing', () => {
  test('documents are private until shared', async () => {
    const alice = await signIn(ALICE);
    const bob = await signIn(BOB);
    const doc = await createDoc(alice);

    await bob.get(`/api/documents/${doc.id}`).expect(404);
    await bob.patch(`/api/documents/${doc.id}`).send({ title: 'Mine now' }).expect(404);

    const list = await bob.get('/api/documents').expect(200);
    assert.deepEqual(list.body.documents, []);
  });

  test('a viewer can read but not change the document', async () => {
    const alice = await signIn(ALICE);
    const bob = await signIn(BOB);
    const doc = await createDoc(alice);

    await alice.put(`/api/documents/${doc.id}/shares`).send({ email: BOB, role: 'viewer' }).expect(200);

    const seen = await bob.get(`/api/documents/${doc.id}`).expect(200);
    assert.equal(seen.body.document.role, 'viewer');
    assert.equal(seen.body.document.shares, undefined, 'only the owner sees the share list');

    await bob.patch(`/api/documents/${doc.id}`).send({ content: '<p>edited</p>' }).expect(403);
    await bob.delete(`/api/documents/${doc.id}`).expect(403);
  });

  test('an editor can change content but cannot re-share or delete', async () => {
    const alice = await signIn(ALICE);
    const bob = await signIn(BOB);
    const doc = await createDoc(alice);

    await alice.put(`/api/documents/${doc.id}/shares`).send({ email: BOB, role: 'editor' }).expect(200);

    await bob.patch(`/api/documents/${doc.id}`).send({ content: '<p>from bob</p>' }).expect(200);
    await bob.put(`/api/documents/${doc.id}/shares`).send({ email: CAROL, role: 'viewer' }).expect(403);
    await bob.delete(`/api/documents/${doc.id}`).expect(403);

    const res = await alice.get(`/api/documents/${doc.id}`).expect(200);
    assert.equal(res.body.document.content, '<p>from bob</p>');
  });

  test('the list tells owned and shared documents apart', async () => {
    const alice = await signIn(ALICE);
    const bob = await signIn(BOB);
    const shared = await createDoc(alice, 'From Alice');
    await createDoc(bob, 'Bob only');
    await alice.put(`/api/documents/${shared.id}/shares`).send({ email: BOB, role: 'editor' }).expect(200);

    const res = await bob.get('/api/documents').expect(200);
    const byTitle = Object.fromEntries(res.body.documents.map((d) => [d.title, d]));
    assert.equal(byTitle['Bob only'].role, 'owner');
    assert.equal(byTitle['From Alice'].role, 'editor');
    assert.equal(byTitle['From Alice'].ownerName, 'Alice Chen');
  });

  test('sharing twice updates the role instead of duplicating', async () => {
    const alice = await signIn(ALICE);
    const doc = await createDoc(alice);
    await alice.put(`/api/documents/${doc.id}/shares`).send({ email: BOB, role: 'viewer' }).expect(200);
    const res = await alice.put(`/api/documents/${doc.id}/shares`).send({ email: BOB, role: 'editor' }).expect(200);

    assert.equal(res.body.shares.length, 1);
    assert.equal(res.body.shares[0].role, 'editor');
  });

  test('revoking access takes effect immediately', async () => {
    const alice = await signIn(ALICE);
    const bob = await signIn(BOB);
    const doc = await createDoc(alice);
    const granted = await alice
      .put(`/api/documents/${doc.id}/shares`)
      .send({ email: BOB, role: 'editor' })
      .expect(200);

    await alice.delete(`/api/documents/${doc.id}/shares/${granted.body.shares[0].id}`).expect(200);
    await bob.get(`/api/documents/${doc.id}`).expect(404);
  });

  test('validates the share request', async () => {
    const alice = await signIn(ALICE);
    const doc = await createDoc(alice);
    const share = (body) => alice.put(`/api/documents/${doc.id}/shares`).send(body);

    await share({ email: 'nobody@inkpad.test', role: 'viewer' }).expect(404);
    await share({ email: BOB, role: 'admin' }).expect(400);
    await share({ email: 'not-an-email', role: 'viewer' }).expect(400);
    await share({ email: ALICE, role: 'editor' }).expect(400);
  });
});

describe('file import', () => {
  test('a markdown file becomes a formatted document', async () => {
    const alice = await signIn(ALICE);
    const markdown = '# Meeting notes\n\nWe agreed on **two** things:\n\n- ship it\n- write it down\n';
    const res = await alice
      .post('/api/documents/import')
      .attach('file', Buffer.from(markdown), 'meeting-notes.md')
      .expect(201);

    const { document } = res.body;
    assert.equal(document.title, 'meeting-notes');
    assert.match(document.content, /<h1>Meeting notes<\/h1>/);
    assert.match(document.content, /<strong>two<\/strong>/);
    assert.match(document.content, /<li>ship it<\/li>/);
  });

  test('a text file keeps its paragraphs and escapes markup', async () => {
    const alice = await signIn(ALICE);
    const res = await alice
      .post('/api/documents/import')
      .attach('file', Buffer.from('first line\nsecond line\n\n<b>not bold</b>'), 'notes.txt')
      .expect(201);
    assert.equal(
      res.body.document.content,
      '<p>first line<br />second line</p><p>&lt;b&gt;not bold&lt;/b&gt;</p>',
    );
  });

  test('a Word file keeps its heading and inline formatting', async () => {
    const alice = await signIn(ALICE);
    const res = await alice
      .post('/api/documents/import')
      .attach('file', path.join(fixtures, 'brief.docx'))
      .expect(201);

    assert.equal(res.body.document.title, 'brief');
    assert.equal(
      res.body.document.content,
      '<h1>Project brief</h1><p>Some <strong>bold</strong> and <em>italic</em><u> underlined</u></p>',
    );
  });

  test('rejects unsupported types, empty files and oversized files', async () => {
    const alice = await signIn(ALICE);
    const attach = (buffer, name) => alice.post('/api/documents/import').attach('file', buffer, name);

    const wrongType = await attach(Buffer.from('%PDF-1.4'), 'report.pdf').expect(415);
    assert.match(wrongType.body.error, /\.txt, \.md, \.docx/);

    await attach(Buffer.alloc(0), 'empty.txt').expect(400);
    await attach(Buffer.alloc(2 * 1024 * 1024 + 1, 'a'), 'huge.txt').expect(413);
    await attach(Buffer.from('this is not a zip archive'), 'broken.docx').expect(422);
    await alice.post('/api/documents/import').expect(400);
  });
});
