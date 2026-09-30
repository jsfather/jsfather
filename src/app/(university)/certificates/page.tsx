import Link from 'next/link';
import { Award } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { db } from '@/db';
import { certificates } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { PageTitle, Empty, Badge, Pagination } from '@/components/ui';
import { format } from 'date-fns';
import { pageNumber } from '@/lib/data';
export const metadata = { title: 'Certificates' };
export default async function Certificates({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser();
  const page = pageNumber((await searchParams).page);
  const list = await db
    .select()
    .from(certificates)
    .where(eq(certificates.userId, user.id))
    .orderBy(desc(certificates.issuedAt))
    .limit(20)
    .offset((page - 1) * 20);
  return (
    <>
      <PageTitle
        eyebrow="PROGRESS WORTH RECOGNIZING"
        title="Your achievements"
        description="A record of the knowledge you’ve put to the test."
      />
      {list.length ? (
        <>
          <div className="course-grid full">
            {list.map((c) => (
              <Link key={c.id} href={'/certificates/' + c.id} className="course-card">
                <Award size={32} style={{ color: 'var(--accent)', marginBottom: 22 }} />
                <h3>{c.courseTitle}</h3>
                <p className="muted" style={{ fontSize: 12, margin: '8px 0 18px' }}>
                  Awarded {format(c.issuedAt, 'MMMM d, yyyy')}
                </p>
                <Badge color="teal">Passed · {c.percentage}%</Badge>
                <div className="course-bottom">
                  <span>Certificate of achievement</span>
                  <span>View certificate</span>
                </div>
              </Link>
            ))}
          </div>
          <Pagination page={page} hasMore={list.length === 20} base="/certificates" />
        </>
      ) : (
        <Empty
          title="Your first achievement is ahead."
          description="Pass a course exam to earn a personal achievement certificate. Your effort deserves a record."
          href="/exams"
          label="Explore your exams"
        />
      )}
      <p className="muted" style={{ fontSize: 11, marginTop: 25 }}>
        Personal achievement certificates are not accredited educational qualifications.
      </p>
    </>
  );
}
