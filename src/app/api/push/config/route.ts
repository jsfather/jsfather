import { auth } from '@/lib/auth';
import { pushConfigured } from '@/lib/push';
export async function GET() {
  if (!(await auth())?.user?.id) return new Response(null, { status: 401 });
  if (!pushConfigured()) return new Response(null, { status: 503 });
  return Response.json(
    { publicKey: process.env.VAPID_PUBLIC_KEY },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
