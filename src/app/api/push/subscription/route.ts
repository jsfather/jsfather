import { auth } from '@/lib/auth';
import { db } from '@/db';
import { pushSubscriptions } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { pushSubscriptionSchema } from '@/lib/push-validation';
import { pushConfigured } from '@/lib/push';

async function userId(request: Request) {
  // Require same-origin writes in addition to the session cookie.
  if (request.method !== 'GET' && request.headers.get('origin') !== new URL(request.url).origin)
    return null;
  return (await auth())?.user?.id;
}
export async function GET(request: Request) {
  const id = await userId(request);
  if (!id) return new Response(null, { status: 401 });
  const rows = await db
    .select({ endpoint: pushSubscriptions.endpoint })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, id));
  return Response.json(
    { endpoints: rows.map((row) => row.endpoint) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
export async function POST(request: Request) {
  const id = await userId(request);
  if (!id) return new Response(null, { status: 401 });
  if (!pushConfigured()) return new Response(null, { status: 503 });
  const parsed = pushSubscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 400 });
  const { endpoint, keys } = parsed.data;
  // A device used by a different account transfers to that account on explicit opt-in.
  await db
    .insert(pushSubscriptions)
    .values({ userId: id, endpoint, ...keys })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId: id, ...keys, lastSentDay: null, updatedAt: new Date() },
    });
  return new Response(null, { status: 204 });
}
export async function DELETE(request: Request) {
  const id = await userId(request);
  if (!id) return new Response(null, { status: 401 });
  const data = await request.json().catch(() => null);
  if (typeof data?.endpoint !== 'string') return new Response(null, { status: 400 });
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, id), eq(pushSubscriptions.endpoint, data.endpoint)));
  return new Response(null, { status: 204 });
}
