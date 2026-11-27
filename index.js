import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.dirname(fileURLToPath(import.meta.url));
const applicationRoot = path.join(repositoryRoot, 'GuruTech');

// The bot resolves its session, database and other runtime files relative to GuruTech.
process.chdir(applicationRoot);
await import(new URL('./GuruTech/index.js', import.meta.url));
