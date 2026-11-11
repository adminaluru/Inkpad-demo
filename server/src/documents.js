import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { HttpError } from './errors.js';
import {
  MAX_UPLOAD_BYTES,
  SUPPORTED_EXTENSIONS,
  extensionOf,
  fileToHtml,
  titleFromFilename,
} from './importer.js';
import { cleanHtml } from './sanitize.js';
import { parseContent, parseEmail, parseRole, parseTitle } from './validate.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter(req, file, done) {
    if (SUPPORTED_EXTENSIONS.includes(extensionOf(file.originalname))) {
      return done(null, true);
    }
    done(new HttpError(415, `Unsupported file type. Upload one of: ${SUPPORTED_EXTENSIONS.join(', ')}.`));
  },
});

export function documentRoutes(db) {
  const router = Router();

  const q = {
    list: db.prepare(
      `SELECT d.id, d.title, d.updated_at, d.owner_id,
              u.name AS owner_name,
              CASE WHEN d.owner_id = @me THEN 'owner' ELSE s.role END AS role,
              (SELECT COUNT(*) FROM shares WHERE document_id = d.id) AS share_count
         FROM documents d
         JOIN users u ON u.id = d.owner_id
         LEFT JOIN shares s ON s.document_id = d.id AND s.user_id = @me
        WHERE d.owner_id = @me OR s.user_id IS NOT NULL
        ORDER BY d.updated_at DESC`,
    ),
    get: db.prepare(
      `SELECT d.*, u.name AS owner_name, u.email AS owner_email
         FROM documents d
         JOIN users u ON u.id = d.owner_id
        WHERE d.id = ?`,
    ),
    insert: db.prepare(
      `INSERT INTO documents (id, title, content, owner_id, created_at, updated_at)
       VALUES (@id, @title, @content, @ownerId, @now, @now)`,
    ),
    update: db.prepare(
      'UPDATE documents SET title = @title, content = @content, updated_at = @now WHERE id = @id',
    ),
    remove: db.prepare('DELETE FROM documents WHERE id = ?'),

    shareFor: db.prepare('SELECT role FROM shares WHERE document_id = ? AND user_id = ?'),
    shares: db.prepare(
      `SELECT u.id, u.name, u.email, s.role
         FROM shares s
         JOIN users u ON u.id = s.user_id
        WHERE s.document_id = ?
        ORDER BY u.name`,
    ),
    upsertShare: db.prepare(
      `INSERT INTO shares (document_id, user_id, role, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (document_id, user_id) DO UPDATE SET role = excluded.role`,
    ),
    removeShare: db.prepare('DELETE FROM shares WHERE document_id = ? AND user_id = ?'),
    userByEmail: db.prepare('SELECT id, name, email FROM users WHERE email = ?'),
  };

  // Resolves the document and the caller's role on it. Documents the caller
  // has no access to look exactly like documents that don't exist.
  function loadDocument(id, user) {
    const doc = q.get.get(id);
    if (!doc) throw new HttpError(404, 'Document not found.');

    if (doc.owner_id === user.id) return { doc, role: 'owner' };

    const share = q.shareFor.get(id, user.id);
    if (!share) throw new HttpError(404, 'Document not found.');
    return { doc, role: share.role };
  }

  function requireOwner(id, user) {
    const found = loadDocument(id, user);
    if (found.role !== 'owner') {
      throw new HttpError(403, 'Only the owner can do that.');
    }
    return found;
  }

  function present(doc, role) {
    const body = {
      id: doc.id,
      title: doc.title,
      content: doc.content,
      role,
      owner: { id: doc.owner_id, name: doc.owner_name, email: doc.owner_email },
      createdAt: doc.created_at,
      updatedAt: doc.updated_at,
    };
    if (role === 'owner') body.shares = q.shares.all(doc.id);
    return body;
  }

  function createDocument(user, title, content) {
    const id = randomUUID();
    q.insert.run({ id, title, content, ownerId: user.id, now: new Date().toISOString() });
    return present(q.get.get(id), 'owner');
  }

  router.get('/', (req, res) => {
    const documents = q.list.all({ me: req.user.id }).map((row) => ({
      id: row.id,
      title: row.title,
      role: row.role,
      ownerName: row.owner_name,
      shareCount: row.share_count,
      updatedAt: row.updated_at,
    }));
    res.json({ documents });
  });

  router.post('/', (req, res) => {
    const title = req.body?.title === undefined ? 'Untitled document' : parseTitle(req.body.title);
    res.status(201).json({ document: createDocument(req.user, title, '') });
  });

  router.post('/import', upload.single('file'), async (req, res) => {
    if (!req.file) {
      throw new HttpError(400, 'Choose a file to upload.');
    }
    if (req.file.size === 0) {
      throw new HttpError(400, 'That file is empty.');
    }

    const html = cleanHtml(await fileToHtml(req.file));
    const content = parseContent(html);
    const title = titleFromFilename(req.file.originalname);
    res.status(201).json({ document: createDocument(req.user, title, content) });
  });

  router.get('/:id', (req, res) => {
    const { doc, role } = loadDocument(req.params.id, req.user);
    res.json({ document: present(doc, role) });
  });

  router.patch('/:id', (req, res) => {
    const { doc, role } = loadDocument(req.params.id, req.user);
    if (role === 'viewer') {
      throw new HttpError(403, 'You have view-only access to this document.');
    }

    const { title, content } = req.body ?? {};
    if (title === undefined && content === undefined) {
      throw new HttpError(400, 'Nothing to update.');
    }

    q.update.run({
      id: doc.id,
      title: title === undefined ? doc.title : parseTitle(title),
      content: content === undefined ? doc.content : cleanHtml(parseContent(content)),
      now: new Date().toISOString(),
    });
    res.json({ document: present(q.get.get(doc.id), role) });
  });

  router.delete('/:id', (req, res) => {
    const { doc } = requireOwner(req.params.id, req.user);
    q.remove.run(doc.id);
    res.status(204).end();
  });

  // Grants access, or changes the role if the person already has access.
  router.put('/:id/shares', (req, res) => {
    const { doc } = requireOwner(req.params.id, req.user);
    const email = parseEmail(req.body?.email);
    const role = parseRole(req.body?.role);

    const target = q.userByEmail.get(email);
    if (!target) {
      throw new HttpError(404, `No Inkpad account found for ${email}.`);
    }
    if (target.id === req.user.id) {
      throw new HttpError(400, 'You already own this document.');
    }

    q.upsertShare.run(doc.id, target.id, role, new Date().toISOString());
    res.json({ shares: q.shares.all(doc.id) });
  });

  router.delete('/:id/shares/:userId', (req, res) => {
    const { doc } = requireOwner(req.params.id, req.user);
    q.removeShare.run(doc.id, Number(req.params.userId));
    res.json({ shares: q.shares.all(doc.id) });
  });

  return router;
}
