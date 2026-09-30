import { publicUser, publicCourse } from '@/lib/data';
import { canSeeScores } from '@/lib/learning';
import { db } from '@/db';
import { certificates, courses } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { Certificate } from '@/components/certificate';
export const metadata = { title: 'Certificate of Achievement' };
export default async function PublicCertificate({
  params,
}: {
  params: Promise<{ username: string; id: string }>;
}) {
  const { username, id } = await params;
  const user = await publicUser(username);
  if (!canSeeScores(user)) notFound();
  const [row] = await db
    .select({ certificate: certificates, slug: courses.slug })
    .from(certificates)
    .innerJoin(courses, eq(certificates.courseId, courses.id))
    .where(
      and(eq(certificates.id, id), eq(certificates.userId, user.id), eq(courses.isPublic, true)),
    );
  if (!row) notFound();
  await publicCourse(username, row.slug);
  return <Certificate certificate={row.certificate} />;
}
