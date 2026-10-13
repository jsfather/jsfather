import { UniversityName } from '@/components/brand';
import Link from 'next/link';
import { ArrowRight, GraduationCap, ShieldCheck, Code2 } from 'lucide-react';
import { Brand, ThemeToggle } from '@/components/navigation';
import { googleLogin } from '@/actions';
import { auth } from '@/lib/auth';
import { Badge, Progress } from '@/components/ui';
export default async function Landing() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.id);
  const primaryAction = signedIn ? (
    <Link href="/dashboard" className="button primary">
      Continue learning <ArrowRight size={17} />
    </Link>
  ) : (
    <form action={googleLogin}>
      <button className="button primary">
        <span className="google-mark">G</span>Continue with Google
      </button>
    </form>
  );
  return (
    <div className="landing">
      <header className="landing-header">
        <Brand />
        <nav>
          <Link href="/practice">Explore exams</Link>
          <ThemeToggle />
          <Link className="button secondary" href={signedIn ? '/dashboard' : '/login'}>
            {signedIn ? 'My university' : 'Log in'}
          </Link>
        </nav>
      </header>
      <main>
        <section className="landing-hero">
          <div>
            <div className="hero-pill">
              <GraduationCap size={14} /> A campus built around you
            </div>
            <h1>
              Build your
              <br />
              own <em>university.</em>
            </h1>
            <p>
              Learn like you’re enrolled in one. Turn your ambitions into courses, your time into a
              timetable, and your effort into progress.
            </p>
            {primaryAction}
            <div className="hero-foot">
              <ShieldCheck size={13} />
              {signedIn
                ? 'Your courses, vocabulary, and next steps are waiting.'
                : 'One Google account. Your own campus. Private by default.'}
            </div>
          </div>
          <div className="hero-visual" aria-label="Example of a personal learning schedule">
            <div className="hero-visual-top">
              <span>YOUR PERSONAL CAMPUS</span>
              <Badge color="teal">A new semester, on your terms</Badge>
            </div>
            <h2>Frontend Engineering</h2>
            <p>An example of what your university could look like.</p>
            {[
              {
                title: 'Advanced JavaScript',
                text: '24 sessions · Deepen your foundations',
                color: 'amber',
                label: 'JS',
              },
              {
                title: 'React Architecture',
                text: '18 sessions · Build with confidence',
                color: 'blue',
                label: 'React',
              },
              {
                title: 'Web Performance',
                text: '12 sessions · Make every millisecond count',
                color: 'violet',
                label: 'Web',
              },
            ].map((c) => (
              <div className={`hero-class color-${c.color}`} key={c.title}>
                <div className="course-icon">
                  <Code2 size={18} />
                </div>
                <div>
                  <strong>{c.title}</strong>
                  <span>{c.text}</span>
                </div>
                <Badge color={c.color}>{c.label}</Badge>
              </div>
            ))}
            <div className="hero-visual-bottom">
              <span>A clear path from curious to capable.</span>
              <GraduationCap size={18} />
            </div>
            <div style={{ marginTop: 15 }}>
              <Progress value={65} />
            </div>
          </div>
        </section>
        <section className="landing-final">
          <div className="eyebrow">
            {signedIn ? 'KEEP YOUR MOMENTUM' : 'YOUR NEXT CHAPTER STARTS HERE'}
          </div>
          <h2>{signedIn ? 'Your next step is waiting.' : 'Give your learning a place to grow.'}</h2>
          {primaryAction}
        </section>
      </main>
      <footer className="landing-footer">
        <span>
          © {new Date().getFullYear()} <UniversityName /> Personal University
        </span>
        <span>Built for developers who keep learning.</span>
      </footer>
    </div>
  );
}
