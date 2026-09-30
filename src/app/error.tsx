'use client';
import Link from 'next/link';
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="error-page">
      <h1>Something interrupted your session.</h1>
      <p className="muted">
        We couldn’t load this page. Try again in a moment. Your saved learning progress is safe.
      </p>
      <div className="actions-row" style={{ justifyContent: 'center' }}>
        <button className="button primary" onClick={reset}>
          Try again
        </button>
        <Link className="button secondary" href="/dashboard">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
