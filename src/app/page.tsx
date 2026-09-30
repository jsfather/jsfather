import { UniversityName } from '@/components/brand';
import Link from 'next/link';
import { BookOpen, CalendarDays, GraduationCap, ShieldCheck, Award, Code2 } from 'lucide-react';
import { Brand, ThemeToggle } from '@/components/navigation';
import { googleLogin } from '@/actions';
import { Badge, Progress } from '@/components/ui';
export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-header">
        <Brand />
        <nav>
          <a href="#how-it-works">How it works</a>
          <ThemeToggle />
          <Link className="button secondary" href="/dashboard">
            My university
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
            <form action={googleLogin}>
              <button className="button primary">
                <span className="google-mark">G</span>Continue with Google
              </button>
            </form>
            <div className="hero-foot">
              <ShieldCheck size={13} /> Your learning. Your pace. Private by default.
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
        <section className="landing-features" id="how-it-works">
          <div className="eyebrow">STRUCTURE MAKES THE DIFFERENCE</div>
          <h2>
            Less “I should learn that.”
            <br />
            More showing up for class.
          </h2>
          <div className="feature-grid">
            {[
              {
                icon: BookOpen,
                title: 'Write your own syllabus',
                text: 'Create courses for anything you want to learn. Set your level, choose a schedule, and break big goals into focused sessions.',
              },
              {
                icon: CalendarDays,
                title: 'Make time for the work',
                text: 'See today’s classes and your weekly timetable. Study, capture notes, and complete each session as you go.',
              },
              {
                icon: Award,
                title: 'Know how far you’ve come',
                text: 'Test your knowledge with exams, track your progress, and earn a personal certificate for every exam you pass.',
              },
            ].map(({ icon: Icon, title, text }) => (
              <article className="feature-card" key={title}>
                <Icon size={26} />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="landing-final">
          <div className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</div>
          <h2>Give your learning a place to grow.</h2>
          <form action={googleLogin}>
            <button className="button primary">
              <span className="google-mark">G</span>Continue with Google
            </button>
          </form>
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
