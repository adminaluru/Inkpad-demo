import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { openDatabase } from './db.js';
import { seedDemoData } from './seed.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 4000;

const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(here, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = openDatabase(path.join(dataDir, 'inkpad.db'));
seedDemoData(db);

const builtClient = path.join(here, '..', '..', 'client', 'dist');
const clientDir = fs.existsSync(path.join(builtClient, 'index.html')) ? builtClient : null;

const app = createApp(db, { clientDir });
const server = app.listen(port, () => {
  console.log(`Inkpad listening on http://localhost:${port}`);
  if (!clientDir) {
    console.log('No client build found, serving the API only. Run "npm run build" or use "npm run dev".');
  }
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
