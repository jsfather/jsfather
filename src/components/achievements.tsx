import { AchievementArt, achievementPalettes } from './achievement-art';
import type { CSSProperties } from 'react';
import {
  Trophy,
  Check,
  Flame,
  BookOpen,
  Languages,
  GraduationCap,
  PencilLine,
  Target,
} from 'lucide-react';
import { achievementGroups, type Achievement } from '@/lib/achievements';
import { Progress } from './ui';
const icons = {
  'Learning habit': Flame,
  Courses: GraduationCap,
  Reading: BookOpen,
  Vocabulary: Languages,
  Assessments: Target,
  'Question writing': PencilLine,
};
function BadgeGrid({ list }: { list: Achievement[] }) {
  return (
    <div className="ui-stack section-stack">
      {achievementGroups.map((group) => {
        const entries = list.filter((a) => a.group === group);
        if (!entries.length) return null;
        const Icon = icons[group];
        return (
          <section className="ui-stack achievement-group" key={group} aria-label={group}>
            <h3>
              <Icon size={18} aria-hidden="true" />
              {group}
            </h3>
            <ul className="achievement-grid">
              {entries.map((a) => (
                <li
                  key={a.id}
                  className={`achievement-card ui-stack ${a.earned ? 'earned' : ''}`}
                  data-achievement={a.id}
                  style={
                    {
                      '--badge-color': achievementPalettes[a.id]?.color,
                      '--badge-light': achievementPalettes[a.id]?.light,
                    } as CSSProperties
                  }
                >
                  <div className="achievement-title">
                    <AchievementArt id={a.id} earned={a.earned} />
                    <h4>{a.title}</h4>
                  </div>
                  <p className="field-hint">{a.description}</p>
                  {a.earned ? (
                    <span className="achievement-status">
                      <Check size={14} aria-hidden="true" />
                      Earned
                    </span>
                  ) : (
                    <div className="ui-stack achievement-progress">
                      <span className="field-hint">
                        {Math.floor(a.progress).toLocaleString('en-US')} /{' '}
                        {a.target.toLocaleString('en-US')} {a.unit}
                      </span>
                      <Progress value={a.percentage} label={a.title + ' progress'} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
export function Achievements({
  list,
  publicView = false,
}: {
  list: Achievement[];
  publicView?: boolean;
}) {
  const earned = list.filter((a) => a.earned),
    remaining = list.filter((a) => !a.earned);
  return (
    <section className="panel ui-stack achievements-panel" aria-label="Achievements">
      <div className="section-header">
        <h2>
          <Trophy size={22} aria-hidden="true" />
          Achievements
        </h2>
        <span className="badge">{earned.length} earned</span>
      </div>
      <p className="field-hint">
        {publicView
          ? 'Earned through shared learning activity. Exam achievements follow score visibility settings.'
          : 'Milestones from your saved learning progress. Public visitors see achievements from shared activity only.'}
      </p>
      {earned.length ? (
        <BadgeGrid list={earned} />
      ) : (
        <p className="muted">
          {publicView
            ? 'No achievements from shared activity yet.'
            : 'Your first achievement starts with a saved lesson, reading progress, vocabulary review, or exam.'}
        </p>
      )}
      {!publicView && !!remaining.length && (
        <details className="achievement-next">
          <summary>Explore {remaining.length} achievements to earn</summary>
          <BadgeGrid list={remaining} />
        </details>
      )}
    </section>
  );
}
