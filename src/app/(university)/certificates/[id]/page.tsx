import { requireUser } from '@/lib/auth';
import { db } from '@/db';
import { certificates } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { PageTitle } from '@/components/ui';
import { Certificate } from '@/components/certificate';
import { PrintButton } from '@/components/print-button';
export const metadata = { title: 'Certificate of Achievement' };
export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const [certificate] = await db
    .select()
    .from(certificates)
    .where(and(eq(certificates.id, (await params).id), eq(certificates.userId, user.id)));
  if (!certificate) notFound();
  return (
    <>
      <PageTitle
        title="Your certificate"
        description="A milestone in your personal learning journey."
      />
      <PrintButton />
      <Certificate certificate={certificate} />
    </>
  );
}
