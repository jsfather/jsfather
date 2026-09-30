import 'server-only';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
const globalDb = globalThis as unknown as { sqlClient?: ReturnType<typeof postgres> };
// Connection is lazy: builds do not need a running database or runtime secrets.
const client =
  globalDb.sqlClient ??
  postgres(process.env.DATABASE_URL ?? 'postgresql://localhost:5432/jsfather', {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
if (process.env.NODE_ENV !== 'production') globalDb.sqlClient = client;
export const db = drizzle(client, { schema });
