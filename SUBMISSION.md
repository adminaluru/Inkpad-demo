# Submission contents

| Item                         | Where                                         |
| ---------------------------- | --------------------------------------------- |
| Source code                  | `server/`, `client/`, root `package.json`     |
| Setup and run instructions   | `README.md`                                   |
| Architecture note            | `ARCHITECTURE.md`                             |
| AI workflow note             | `AI_WORKFLOW.md`                              |
| Walkthrough video link       | `walkthrough-video.txt`                       |
| Deployment config            | `render.yaml`                                 |
| Automated tests              | `server/test/api.test.js` (run `npm test`)    |

## Live product

URL: https://inkpad-x46a.onrender.com

It runs on a free instance, so the first load after a quiet period can take up
to a minute, and data resets to the seeded demo content when the instance
restarts. Everything persists normally within a running session.

## Test accounts

All three use the password `inkpad-demo`. The login page also lists them.

- `alice@inkpad.test` (owns the seeded "Welcome to Inkpad" document)
- `bob@inkpad.test` (has edit access to that document)
- `carol@inkpad.test` (starts with nothing shared)

## Reviewing the sharing flow

1. Sign in as Alice, open "Welcome to Inkpad", click **Share**.
2. Add `carol@inkpad.test` as **View only**.
3. In a private window, sign in as Carol. The document is under "Shared with
   me" with a View only badge and can't be edited.
4. Sign in as Bob. The same document shows "Can edit" and his changes save.

## Running locally

```bash
npm install
npm run build
npm start
```

Then open http://localhost:4000. Requires Node.js 22+. Details are in the README.

## Not included

`node_modules/`, `client/dist/` and the local database are left out; the three
commands above recreate them.
