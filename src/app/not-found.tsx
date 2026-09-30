import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="error-page">
      <div className="eyebrow">404 · OFF THE SYLLABUS</div>
      <h1>This page isn’t available.</h1>
      <p className="muted">It may be private, moved, or no longer exist.</p>
      <Link href="/" className="button primary">
        Back to home
      </Link>
    </main>
  );
}
