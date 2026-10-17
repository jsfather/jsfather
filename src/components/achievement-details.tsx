'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, LockKeyhole } from 'lucide-react';
import type { Achievement } from '@/lib/achievements';
import { achievementDetails, achievementRequirementProgress } from '@/lib/achievement-details';
import { AchievementArt } from './achievement-art';

export function AchievementDetails({
  achievement: a,
  children,
  compact = false,
  publicView = false,
}: {
  achievement: Achievement;
  children?: ReactNode;
  compact?: boolean;
  publicView?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={compact ? 'achievement-compact-trigger' : 'text-link achievement-detail-trigger'}
        aria-label={`View ${a.title} achievement`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {children ?? 'View details'}
      </button>
      {open &&
        createPortal(
          <DetailModal
            achievement={a}
            publicView={publicView}
            close={() => {
              setOpen(false);
              trigger.current?.focus();
            }}
          />,
          document.body,
        )}
    </>
  );
}
function DetailModal({
  achievement: a,
  publicView,
  close,
}: {
  achievement: Achievement;
  publicView: boolean;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    title = useId(),
    description = useId();
  const details = achievementDetails[a.id];
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.showModal();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="achievement-dialog"
      aria-labelledby={title}
      aria-describedby={description}
      onClose={close}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const r = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < r.left ||
          event.clientX > r.right ||
          event.clientY < r.top ||
          event.clientY > r.bottom
        )
          event.currentTarget.close();
      }}
    >
      <div className="ui-stack section-stack">
        <div className="achievement-dialog-heading">
          <span className="eyebrow">{a.group}</span>
          <button
            type="button"
            className="icon-button"
            aria-label="Close achievement details"
            onClick={() => dialog.current?.close()}
            autoFocus
          >
            <X size={20} />
          </button>
        </div>
        <div className="achievement-dialog-hero ui-stack">
          <AchievementArt id={a.id} earned={a.earned} instance="detail" />
          <h2 id={title}>{a.title}</h2>
          <span className={`badge ${a.earned ? 'badge-teal' : ''}`}>
            {a.earned ? (
              <Check size={14} aria-hidden="true" />
            ) : (
              <LockKeyhole size={14} aria-hidden="true" />
            )}
            {a.earned ? 'Earned' : 'In progress'}
          </span>
          <p id={description} className="field-hint">
            {details.meaning}
          </p>
        </div>
        <section className="ui-stack">
          <h3>How to earn it</h3>
          <p className="field-hint">{details.requirement}</p>
        </section>
        <section className="ui-stack">
          <h3>What counts</h3>
          <p className="field-hint">{details.counting}</p>
        </section>
        <section className="ui-stack achievement-dialog-progress">
          <h3>{a.earned ? 'Requirement met' : 'Progress toward this badge'}</h3>
          <p className="field-hint">
            {achievementRequirementProgress(a)}
            {a.earned ? ' required' : ''}
          </p>
          <div
            className="progress"
            role="progressbar"
            aria-label={a.title + ' progress'}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={a.percentage}
          >
            <div style={{ width: a.percentage + '%' }} />
          </div>
        </section>
        <p className="field-hint achievement-visibility-note">
          {publicView
            ? 'This badge is supported by shared activity only. Private activity and hidden exam results are excluded.'
            : 'Progress is calculated from saved learning records. On a public profile, only shared activity contributes and exam badges follow score visibility settings.'}
        </p>
        <div className="panel-actions">
          <button
            type="button"
            className="button secondary"
            onClick={() => dialog.current?.close()}
          >
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
}
