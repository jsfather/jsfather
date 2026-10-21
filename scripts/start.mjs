import { config } from 'dotenv';
import { cp } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
config({ path: '.env.local', quiet: true });
config({ quiet: true });
await cp('public', '.next/standalone/public', { recursive: true });
await cp('.next/static', '.next/standalone/.next/static', { recursive: true });
const child = spawn(process.execPath, ['.next/standalone/server.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    HOSTNAME: '0.0.0.0',
    // Standalone Next.js changes cwd; resolve storage before starting the child.
    STUDY_NOTES_DIR: resolve(process.env.STUDY_NOTES_DIR || 'study-notes'),
  },
});
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
child.on('exit', (code) => process.exit(code ?? 0));
