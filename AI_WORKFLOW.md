# AI workflow note

## Tools

Claude Code (Anthropic's coding agent), running in the desktop app. It wrote
code, ran commands and tests, and drove a browser against the local build. No
other AI tools were used.

## Where it materially sped things up

- **Scaffolding both halves at once.** The Express API, the SQLite schema, and
  the React client with the TipTap editor were generated in one pass from the
  brief. This is the bulk of the time saved.
- **The API test suite.** 18 tests covering the permission matrix, validation
  and file import. Writing out every "viewer can't do X, editor can't do Y"
  case by hand is the part I would have been most tempted to cut short.
- **File import plumbing.** Wiring multer, marked and mammoth together,
  including details like mammoth ignoring underline by default and multer
  decoding filenames as latin1.
- **The first draft of the README and architecture note.**

## What was changed or rejected

- **TipTap 2 was replaced with TipTap 3.** The first version of the client
  used TipTap 2 with a separate underline extension. `npm audit` reported an
  advisory against `@tiptap/core` that is only fixed in the 3.x line, so the
  editor was moved to 3.33. That had a side effect: the v3 starter kit turns on
  links by default, but the server's sanitiser doesn't store links, so a pasted
  link would have looked fine and then vanished after a reload. Links are
  switched off in the editor to keep the two sides consistent.
- **React Router 6 was replaced with 7** for the same reason (an open advisory
  flagged by `npm audit`). `npm audit` now reports zero findings.
- **Word import lost underlines.** Running a real `.docx` through the importer
  showed bold and italic surviving but underline disappearing. A style mapping
  was added and a `.docx` fixture test now pins that behaviour.
- **Rejected: real-time collaboration, signup, public share links.** All three
  are easy to ask an AI tool for and expensive to get right. They are listed
  as limitations instead of being half-built.
- **Rejected: hiding the limits of the free hosting tier.** The deployment
  section says plainly that SQLite on a host without a persistent disk resets
  on restart, rather than leaving reviewers to discover it.

## How correctness, UX and reliability were verified

- **Automated tests.** `npm test` runs the API against an in-memory SQLite
  database through supertest. All 18 pass. The assertions that matter most are
  the negative ones: a stranger gets 404, a viewer gets 403 on write, an editor
  gets 403 on share and delete, revoking access takes effect on the next
  request, and a `<script>` payload is stripped before it is stored.
- **Browser walkthrough of the production build** (`npm run build && npm
  start`, not the dev server): sign in as Alice, create and rename a document,
  apply bold, underline, a heading and both list types, wait for "All changes
  saved", reload, and compare the editor HTML to what was typed. Share it with
  Carol as view-only, sign in as Carol, confirm it appears under "Shared with
  me" with a View only badge and that typing into it does nothing. Upload a
  `.md` file and confirm formatting came through; try a `.pdf` and confirm the
  error names the supported types. This was repeated after the TipTap upgrade.
- **Narrow screen check** at 375px for the editor and toolbar.
- **Dependency audit** as described above.

Not verified: behaviour under concurrent edits (known last-write-wins), and
the frontend has no automated tests of its own.
