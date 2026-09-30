'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { Check, GraduationCap, Pencil } from 'lucide-react';

const defaultName = 'jsfather';
const storageKey = 'jsfather-university-name';
const changeEvent = 'jsfather-university-name-change';
const maxLength = 40;
let tabName = defaultName;
let transientName: string | null = null;

function normalizeName(value: string) {
  const name = value
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
  return !name || name.toLowerCase() === defaultName ? defaultName : name;
}

function subscribe(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) callback();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(changeEvent, callback);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(changeEvent, callback);
  };
}

function getName() {
  if (transientName !== null) return transientName;
  try {
    return normalizeName(localStorage.getItem(storageKey) ?? defaultName);
  } catch {
    return tabName;
  }
}

function useUniversityName() {
  return useSyncExternalStore(subscribe, getName, () => defaultName);
}

function saveName(value: string) {
  tabName = normalizeName(value);
  let persisted = true;
  try {
    localStorage.setItem(storageKey, tabName);
    transientName = null;
  } catch {
    persisted = false;
    transientName = tabName;
  }
  window.dispatchEvent(new Event(changeEvent));
  return persisted;
}

export function UniversityName() {
  const name = useUniversityName();
  return <span>{name}</span>;
}

export function UniversityTitle() {
  const name = useUniversityName();
  const sourceTitle = useRef('');
  const appliedTitle = useRef<string | null>(null);

  useEffect(() => {
    function syncTitle() {
      // Keep Next's page title, including titles arriving after client navigation.
      if (document.title !== appliedTitle.current) sourceTitle.current = document.title;
      const canonical = `${defaultName} Personal University`;
      const personal = `${name} Personal University`;
      const title = sourceTitle.current;
      const suffix = ` — ${canonical}`;
      const next = title.endsWith(suffix)
        ? `${title.slice(0, -suffix.length)} — ${personal}`
        : title === canonical || title.startsWith(`${canonical} — `)
          ? personal + title.slice(canonical.length)
          : title;
      appliedTitle.current = next;
      if (document.title !== next) document.title = next;
    }

    syncTitle();
    const observer = new MutationObserver(syncTitle);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [name]);

  return null;
}

export function Brand() {
  const name = useUniversityName();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [feedback, setFeedback] = useState('');
  const cancelled = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const hintId = useId();

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(''), 2500);
    return () => clearTimeout(timer);
  }, [feedback]);

  function finishEditing() {
    setEditing(false);
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const next = normalizeName(draft);
    if (next === name) return;
    const persisted = saveName(next);
    setFeedback(
      persisted
        ? 'Made it yours.'
        : 'Your browser couldn’t save this name. It will reset when you reload.',
    );
  }

  return (
    <div className={`brand editable-brand ${editing ? 'is-editing' : ''}`}>
      <Link href="/" className="brand-icon" aria-label="Home">
        <GraduationCap size={25} />
      </Link>
      <div className="brand-wordmark">
        <div className="brand-name-row">
          <div className="brand-name-field">
            <span className="brand-name-measure" aria-hidden="true" dir="auto">
              {(editing ? draft : name) || ' '}
            </span>
            <input
              ref={input}
              className="brand-name-input"
              aria-label="University name"
              aria-describedby={hintId}
              title="Make it yours — rename your university"
              dir="auto"
              maxLength={maxLength}
              autoComplete="off"
              spellCheck={false}
              value={editing ? draft : name}
              onFocus={(event) => {
                cancelled.current = false;
                setFeedback('');
                setDraft(name);
                setEditing(true);
                const end = event.currentTarget.value.length;
                event.currentTarget.setSelectionRange(end, end);
              }}
              onPointerDown={(event) => {
                // The first click starts editing at the end; later clicks can place the caret.
                if (document.activeElement !== event.currentTarget && event.button === 0) {
                  event.preventDefault();
                  event.currentTarget.focus();
                }
              }}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={finishEditing}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return;
                if (event.key === 'Enter') {
                  event.preventDefault();
                  event.currentTarget.blur();
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  cancelled.current = true;
                  event.currentTarget.blur();
                }
              }}
            />
          </div>
          <span className="brand-dot" aria-hidden="true">
            .
          </span>
          <button
            type="button"
            className="brand-edit-button"
            aria-label="Rename university"
            onClick={() => input.current?.focus()}
          >
            <Pencil className="brand-pencil" size={12} aria-hidden="true" />
          </button>
        </div>
        <small>PERSONAL UNIVERSITY</small>
        <span id={hintId} className="brand-edit-hint">
          <kbd>Enter</kbd> to save <span aria-hidden="true">·</span> <kbd>Esc</kbd> to cancel
        </span>
        {feedback && (
          <span className="brand-feedback" role="status">
            <Check size={12} aria-hidden="true" /> {feedback}
          </span>
        )}
      </div>
    </div>
  );
}
