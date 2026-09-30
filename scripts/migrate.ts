import { config } from 'dotenv';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
config({ path: '.env.local' });
config();
async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  const client = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    await client`select pg_advisory_lock(hashtext('jsfather-schema-migrations'))`;
    await migrate(drizzle(client), { migrationsFolder: './drizzle' });
    console.log('Database migrations applied.');
  } finally {
    await client.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
