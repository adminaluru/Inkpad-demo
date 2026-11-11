import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { HttpError } from './errors.js';
import { verifyPassword } from './passwords.js';
import { parseEmail } from './validate.js';

const COOKIE_NAME = 'inkpad_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}

export function requireAuth(db) {
  const findUser = db.prepare(
    `SELECT u.id, u.name, u.email
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > ?`,
  );

  return (req, res, next) => {
    const token = req.cookies?.[COOKIE_NAME];
    const user = token ? findUser.get(token, Date.now()) : null;
    if (!user) {
      throw new HttpError(401, 'Please sign in to continue.');
    }
    req.user = user;
    next();
  };
}

export function authRoutes(db) {
  const router = Router();
  const authed = requireAuth(db);

  const findByEmail = db.prepare('SELECT * FROM users WHERE email = ?');
  const createSession = db.prepare(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
  );
  const deleteSession = db.prepare('DELETE FROM sessions WHERE token = ?');
  const purgeExpired = db.prepare('DELETE FROM sessions WHERE expires_at <= ?');

  router.post('/login', (req, res) => {
    const email = parseEmail(req.body?.email);
    const password = req.body?.password;
    if (typeof password !== 'string' || !password) {
      throw new HttpError(400, 'Enter your password.');
    }

    const user = findByEmail.get(email);
    if (!user || !verifyPassword(password, user.password_hash)) {
      throw new HttpError(401, 'Incorrect email or password.');
    }

    purgeExpired.run(Date.now());
    const token = randomBytes(32).toString('hex');
    createSession.run(token, user.id, Date.now() + SESSION_TTL_MS);

    res.cookie(COOKIE_NAME, token, { ...cookieOptions(), maxAge: SESSION_TTL_MS });
    res.json({ user: { id: user.id, name: user.name, email: user.email } });
  });

  router.post('/logout', (req, res) => {
    const token = req.cookies?.[COOKIE_NAME];
    if (token) deleteSession.run(token);
    res.clearCookie(COOKIE_NAME, cookieOptions());
    res.status(204).end();
  });

  router.get('/me', authed, (req, res) => {
    res.json({ user: req.user });
  });

  return router;
}

// People you can share with. Fine for a demo with seeded accounts; a real
// product would not expose its user directory like this.
export function userRoutes(db) {
  const router = Router();
  const listOthers = db.prepare(
    'SELECT id, name, email FROM users WHERE id != ? ORDER BY name',
  );

  router.get('/', (req, res) => {
    res.json({ users: listOthers.all(req.user.id) });
  });

  return router;
}
