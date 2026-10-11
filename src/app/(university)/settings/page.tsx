import { PwaSettings } from '@/components/pwa';
import { pushConfigured } from '@/lib/push';
import { requireUser } from '@/lib/auth';
import { PageTitle } from '@/components/ui';
import { ProfileForm } from '@/components/forms';
export const metadata = { title: 'Settings' };
export default async function Settings() {
  const user = await requireUser();
  return (
    <>
      <PageTitle
        eyebrow="MAKE IT YOURS"
        title="Settings"
        description="Your profile, your preferences, and what you share."
      />
      <ProfileForm user={user} />
      <PwaSettings configured={pushConfigured()} />
    </>
  );
}
