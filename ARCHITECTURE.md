# Architecture note

## Shape

```
Browser (React + TipTap)  ──/api──▶  Express  ──▶  SQLite file
```

One Node process serves the JSON API and the built React app from the same
origin. One deployable, no CORS, and the session cookie can be `SameSite=Lax`
and `HttpOnly` without any cross-origin handling.

## What I prioritised

**1. The sharing rules, enforced on the server.** This is the part of the brief
where a bug is a real problem rather than a rough edge, so it got the most
attention and most of the tests. Every document route goes through one
function, `loadDocument`, which returns the document together with the caller's
role (owner, editor, viewer) or throws. A document you have no access to
returns 404, the same as one that doesn't exist, so ids can't be probed. The UI
hides controls a role can't use, but that is cosmetic; the API refuses the
request either way.

**2. Not losing what the user typed.** Saving is automatic and debounced. The
`useAutosave` hook queues changed fields, sends one request when typing pauses,
runs saves strictly one after another so an older request can't overwrite a
newer one, keeps failed changes for retry, flushes when you leave the page
inside the app, and warns before closing the tab with unsaved changes.

**3. Stored content is safe and predictable.** Documents are stored as HTML.
The server sanitises it on every write, including imports, against a short
allowlist that matches what the editor can produce. A script tag sent straight
to the API never reaches the database. The same allowlist is why imports
degrade predictably: unsupported structure is dropped, text is kept.

**4. A reviewer can try it in a minute.** Seeded accounts with one-click login,
a welcome document that is already shared, and no external services to set up.

## Decisions and trade-offs

**HTML rather than editor JSON.** TipTap can emit either. HTML made import
simple (Markdown and Word both convert to HTML) and lets one sanitiser guard
every write path. The cost is that structural queries or migrations over
content would be harder. For this scope that was worth it.

**SQLite.** No setup for reviewers, real foreign keys and constraints (the
`role` column has a CHECK, shares cascade when a document is deleted), and
synchronous queries keep the route code short. It limits the app to a single
instance and needs a persistent disk in production. Moving to Postgres would
mean swapping `db.js` and the prepared statements in two files.

**Server-side sessions in a cookie, not JWT.** A random token in an `HttpOnly`
cookie mapped to a row in `sessions`. Logging out actually revokes it, and
JavaScript on the page can't read it. Passwords are hashed with scrypt from
Node's standard library.

**Last write wins.** Two editors in the same document overwrite each other.
Real collaboration (CRDT or OT, presence, a websocket layer) is a project of
its own. The cheap next step would be an `updatedAt` precondition on PATCH so
the second writer gets a "document changed" prompt instead of silently winning.

**Share with existing users only.** Sharing targets an account by email.
Invitations for people without accounts and public links were left out.

## What I'd do next

1. Conflict detection on save, as described above.
2. Rate limiting on login and a real signup flow.
3. A few browser-level tests (Playwright) for the editor and autosave. The
   current tests cover the API thoroughly, but the frontend was checked by hand.
4. Keep links and images on import.
