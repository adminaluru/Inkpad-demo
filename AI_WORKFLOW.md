# AI workflow note

## Tools and how the work was split

I used one AI tool: Claude Code (Anthropic's coding agent). It wrote the first
version of most of the code and ran the tests and a browser walkthrough. I set
the scope from the brief, ran and exercised the app myself, chose the hosting
trade-off, and did the deployment. No other AI tools were used.

I treated the tool the way I would treat a fast contractor: useful for
producing a lot of correct-looking code quickly, not trusted on anything until
it had been run. The sections below are about where that helped and where the
output had to be corrected.

## Where AI materially sped things up

- **Getting to a working vertical slice.** API, schema, editor and sharing UI
  existed and ran end to end in the first pass. That moved the time budget
  from typing to checking.
- **The permission test matrix.** 18 API tests, most of them negative cases:
  a stranger gets 404, a viewer gets 403 on write, an editor gets 403 on share
  and delete, revoked access fails on the very next request. These are tedious
  to write by hand and are exactly the tests that tend to get skipped.
- **Import plumbing.** Wiring three file formats into one HTML pipeline,
  including small traps such as multer decoding filenames as latin1.
- **First drafts of the documentation.**

## What AI-generated output was changed or rejected

- **Editor library replaced.** The first version used TipTap 2. `npm audit`
  flagged an advisory in `@tiptap/core` fixed only in 3.x, so it was moved to
  3.33. That upgrade quietly enabled links in the editor while the server's
  sanitiser still stripped them, so a pasted link would look fine and vanish
  after reload. Links were switched off so the editor and the stored format
  agree. This is the kind of mismatch that only shows up when you run it.
- **Router upgraded** from React Router 6 to 7 for the same reason. The audit
  is now clean.
- **Word import was losing underline.** Bold and italic survived a real
  `.docx`, underline did not. Fixed with a style mapping and pinned with a
  fixture test.
- **Features deliberately not built:** live collaboration, signup, public
  share links. Each is easy to generate and expensive to get right. They are
  listed as limitations rather than shipped half-working.
- **Hosting limits stated, not hidden.** I chose the free tier for the demo,
  which has no persistent disk. The README and submission notes say plainly
  that demo data resets on restart instead of leaving reviewers to find out.

## The engineering standards the output was held to

These are the things I would not accept from generated code without evidence:

- **Access control lives on the server, in one place.** Every document route
  resolves the caller's role through a single function. The UI hiding a button
  is not a permission check. Documents you cannot access return 404, the same
  as documents that do not exist.
- **Never store unsanitised content.** All HTML is cleaned against a short
  allowlist on every write path, including imports. A test sends a script
  payload straight to the API and asserts it is not stored.
- **Validate at the boundary, fail with a useful message.** Titles, content
  size, roles, emails, file type and file size are checked server-side, each
  with a specific status code and a message the UI can show as-is. Unexpected
  errors are logged and returned as a generic 500, never swallowed.
- **Writes are safe to repeat.** Sharing twice updates the role rather than
  creating a duplicate; seeding is idempotent.
- **Do not lose user input.** Autosave runs saves strictly in order, keeps
  failed changes for retry, and warns before the tab closes with unsaved work.

## How correctness, UX and reliability were verified

- **Automated:** `npm test` runs the API against an in-memory database. All 18
  tests pass.
- **Production build in a browser,** not the dev server: create, rename,
  format with every toolbar control, wait for "All changes saved", reload and
  compare. Share as view-only, sign in as the second user, confirm the badge
  and that typing does nothing. Upload a `.md`, then a `.pdf` to see the error.
  Repeated after the library upgrade. I also went through these flows myself
  locally before deploying.
- **Narrow screen** at 375px.
- **Live deployment:** health endpoint returns 200 and the documents API
  returns 401 without a session.

**Not verified:** concurrent editing (known last-write-wins) and the frontend
has no automated tests of its own. Both are listed as next steps in
`ARCHITECTURE.md`.
