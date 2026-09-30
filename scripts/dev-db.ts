import EmbeddedPostgres from 'embedded-postgres';
import { randomBytes } from 'node:crypto';
import { writeFile, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
async function main() {
  let existing = '';
  try {
    existing = await readFile('.env.local', 'utf8');
  } catch {}
  if (existing.includes('DATABASE_URL='))
    throw new Error(
      '.env.local already contains DATABASE_URL. Use your configured PostgreSQL or move that file before starting a disposable database.',
    );
  const dir = await mkdtemp(join(tmpdir(), 'jsfather-postgres-'));
  const password = randomBytes(24).toString('hex');
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: 'university',
    password,
    port: 55432,
    persistent: false,
    onLog: () => {},
    onError: (m) => console.error(String(m)),
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('jsfather');
  await writeFile(
    '.env.local',
    `DATABASE_URL=postgresql://university:${password}@127.0.0.1:55432/jsfather\nAUTH_SECRET=${randomBytes(32).toString('hex')}\nAUTH_URL=http://localhost:3000\nNEXT_PUBLIC_APP_URL=http://localhost:3000\nAUTH_TRUST_HOST=true\n`,
    { mode: 0o600 },
  );
  console.log(
    'Disposable PostgreSQL is ready on port 55432. Local configuration saved to .env.local. Keep this process running.',
  );
  const close = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
  await new Promise(() => {});
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
