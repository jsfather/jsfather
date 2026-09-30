import Link from 'next/link';
import { Brand } from '@/components/navigation';
import { googleLogin } from '@/actions';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
export const metadata = { title: 'Welcome back' };
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if ((await auth())?.user) redirect('/dashboard');
  const { error } = await searchParams;
  return (
    <main className="login-shell">
      <div className="login-card">
        <Brand />
        <h1>Your campus awaits.</h1>
        <p>
          Sign in to your personal university.
          <br />
          One account. A lifetime of learning.
        </p>
        {error && (
          <div className="alert error" role="alert">
            {error === 'Configuration'
              ? 'Google sign-in is not configured yet. The administrator needs to add the OAuth credentials.'
              : error === 'OAuthAccountNotLinked'
                ? 'Please use the Google account you originally signed up with.'
                : 'Sign-in could not be completed. Please try again.'}
          </div>
        )}
        <form action={googleLogin}>
          <button className="button primary">
            <span className="google-mark">G</span>Continue with Google
          </button>
        </form>
        <small>
          We use Google to sign you in securely.
          <br />
          Your courses and notes are private by default.
        </small>
        <Link href="/" className="login-back">
          Back to home
        </Link>
      </div>
    </main>
  );
}
