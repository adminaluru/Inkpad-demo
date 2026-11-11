# Inkpad

A small document editor: write rich text in the browser, import files as new
documents, and share them with other users as view-only or editable.

**Live URL:** _add after deploying_

## Demo accounts

There is no signup. Three accounts are created the first time the server starts:

| Name        | Email               | Password      |
| ----------- | ------------------- | ------------- |
| Alice Chen  | `alice@inkpad.test` | `inkpad-demo` |
| Bob Martin  | `bob@inkpad.test`   | `inkpad-demo` |
| Carol Diaz  | `carol@inkpad.test` | `inkpad-demo` |

The login page lists them and signs you in with one click. A fresh database
also contains a "Welcome to Inkpad" document owned by Alice and shared with Bob.

To see sharing from both sides, use two browser profiles (or one normal and one
private window) and sign in as a different person in each.

## Run it locally

Requires Node.js 22 or newer.

```bash
npm install
npm run build
npm start
```

Open http://localhost:4000.

For development with hot reload, run `npm run dev` instead and open
http://localhost:5173. That starts the API on port 4000 and Vite on 5173, with
`/api` proxied to the API.

### Tests

```bash
npm test
```

Runs 18 API tests against an in-memory database. They cover login, document
create/rename/edit/reopen, input validation, HTML sanitising, every sharing
rule (private by default, viewer, editor, owner-only actions, revoking), and
file import for all three formats plus the rejection cases.

### Configuration

| Variable   | Default        | Purpose                                         |
| ---------- | -------------- | ----------------------------------------------- |
| `PORT`     | `4000`         | Port the server listens on                      |
| `DATA_DIR` | `server/data`  | Folder that holds the SQLite file `inkpad.db`   |
| `NODE_ENV` | unset          | Set to `production` to mark the cookie `Secure` |

To reset everything, stop the server and delete the `DATA_DIR` folder.

## What it does

**Documents.** Create, rename (click the title), edit, delete. Changes save
automatically about a second after you stop typing, and Ctrl/Cmd+S saves
immediately. The status next to the title shows "Saving…", "All changes saved",
or the error with a Retry link if a save fails.

**Formatting.** Bold, italic, underline, headings 1–3, bulleted and numbered
lists, undo/redo. The usual keyboard shortcuts work.

**File upload.** "Upload file" on the documents page turns a file into a new
document you own.

- Supported types: `.txt`, `.md`, `.docx`
- Maximum size: 2 MB
- `.md` and `.docx` keep headings, bold, italic, underline and lists. Images,
  tables, links and anything else the editor can't represent are dropped (link
  text is kept).

**Sharing.** The owner opens Share on a document, enters another user's email
and picks "Can edit" or "View only". Access can be changed or removed from the
same dialog.

| Action                    | Owner | Editor | Viewer |
| ------------------------- | :---: | :----: | :----: |
| Read                      |  yes  |  yes   |  yes   |
| Edit content, rename      |  yes  |  yes   |   no   |
| Share, change access      |  yes  |   no   |   no   |
| Delete                    |  yes  |   no   |   no   |

The documents page separates "My documents" from "Shared with me", and every
row carries an Owner / Can edit / View only badge.

## Deployment

The app is one Node process that serves both the API and the built frontend,
so it runs anywhere that can run `npm start`.

`render.yaml` is set up for [Render](https://render.com):

1. Push this folder to a GitHub repository.
2. In Render choose **New → Blueprint** and select the repository.
3. Render reads `render.yaml`, builds, and gives you the URL.

The blueprint uses Render's free plan, which has two consequences reviewers
should know about:

- **The first request after a quiet period is slow.** Free instances sleep
  after about 15 minutes without traffic and take up to a minute to wake.
- **Data does not survive a restart.** There is no persistent disk on the free
  plan, so the SQLite file is recreated with the demo accounts and the welcome
  document each time the instance wakes or redeploys. Within a running
  session everything persists normally: refresh, sign out and back in, switch
  users.

To keep data across restarts, change `plan` to `starter`, add a disk, and set
`DATA_DIR` to its mount path:

```yaml
    envVars:
      - key: DATA_DIR
        value: /var/data
    disk:
      name: inkpad-data
      mountPath: /var/data
      sizeGB: 1
```

Running locally has neither limitation; the database is a file in
`server/data`.

## Known limitations

- Two people editing the same document at the same time overwrite each other;
  the last save wins. There is no live collaboration.
- No signup, password reset, or rate limiting on login.
- Any signed-in user can see the names and emails of the other users (used for
  the suggestions in the Share dialog).
- No version history.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the reasoning behind these.

## Project layout

```
server/
  src/
    index.js      entry point: opens the database, seeds, starts listening
    app.js        Express app wiring
    db.js         schema
    auth.js       login, sessions, user list
    documents.js  document, import and sharing routes
    importer.js   .txt / .md / .docx to HTML
    sanitize.js   allowed HTML tags
    validate.js   input validation
    seed.js       demo accounts and welcome document
  test/           API tests
client/
  src/
    pages/        Login, Documents, Editor
    components/   Toolbar, ShareDialog, AppHeader
    hooks/        useAutosave
    api.js        fetch wrapper
```
