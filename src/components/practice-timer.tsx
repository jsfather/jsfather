'use client';
import { useEffect, useRef, useState } from 'react';
import { Clock, Play, Pause } from 'lucide-react';
import {
  DAILY_GOAL_SECONDS,
  HEARTBEAT_SECONDS,
  focusTime,
  focusXp,
  type PracticeActivity,
} from '@/lib/practice';
export function PracticeTimer({
  courseId,
  activity,
  automatic,
  attemptId,
  initialTodaySeconds,
  initialCourseSeconds,
}: {
  courseId: string;
  activity: PracticeActivity;
  automatic: boolean;
  attemptId?: string;
  initialTodaySeconds: number;
  initialCourseSeconds: number;
}) {
  const [running, setRunning] = useState(automatic);
  const [elapsed, setElapsed] = useState(0);
  const [today, setToday] = useState(initialTodaySeconds);
  const [courseTotal, setCourseTotal] = useState(initialCourseSeconds);
  const [message, setMessage] = useState('');
  const [paused, setPaused] = useState(false);
  const total = useRef(0);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!running) return;
    let disposed = false,
      sessionId = '',
      buffer = 0,
      sequence = 0,
      busy = false,
      finishRequested = false,
      networkPaused = false;
    let pending: { sequence: number; seconds: number; capturedAt: number } | null = null;
    let serverStartedAt = 0,
      clientStartedAt = performance.now();
    let lastTick = performance.now(),
      lastInput = performance.now();
    const send = (body: object) =>
      fetch('/api/practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
      });
    const flush = async (finish = false) => {
      finishRequested ||= finish;
      if (!sessionId || busy) return;
      if (!pending) {
        const seconds = Math.min(30, Math.floor(buffer));
        buffer -= seconds;
        pending = {
          sequence: sequence + 1,
          seconds,
          capturedAt: Math.floor(serverStartedAt + performance.now() - clientStartedAt),
        };
      }
      busy = true;
      const sentFinish = finishRequested;
      try {
        const response = await send({
          operation: 'heartbeat',
          sessionId,
          ...pending,
          finish: sentFinish,
        });
        const data = await response.json();
        if (response.status === 409 && !finishRequested) {
          // Flush the final portion before yielding to the replacement timer.
          finishRequested = true;
          if (!disposed) {
            setMessage(data.error);
            setRunning(false);
          }
          return;
        }
        if (!response.ok) throw new Error(data.error ?? 'Could not record practice.');
        sequence = data.sequence;
        pending = null;
        networkPaused = false;
        if (mounted.current) {
          setToday(data.todaySeconds);
          setCourseTotal(data.courseSeconds);
          if (data.ended && !sentFinish && !disposed) {
            setMessage('This practice has ended.');
            setRunning(false);
          } else setMessage('');
        }
      } catch (error) {
        networkPaused = true;
        if (!disposed)
          setMessage(
            error instanceof Error
              ? error.message
              : 'Sync interrupted. Your timer is paused until it reconnects.',
          );
      } finally {
        busy = false;
        if (finishRequested && !sentFinish && !networkPaused) void flush(true);
      }
    };
    void send({ operation: 'start', courseId, activity, attemptId })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'Could not start practice.');
        sessionId = data.sessionId;
        serverStartedAt = data.startedAt;
        clientStartedAt = performance.now();
        lastTick = clientStartedAt;
        if (disposed) void flush(true);
      })
      .catch((error) => {
        if (!disposed) {
          setMessage(error instanceof Error ? error.message : 'Could not start practice.');
          setRunning(false);
        }
      });
    const input = () => {
      lastInput = performance.now();
    };
    const tick = () => {
      const now = performance.now();
      const active =
        !!sessionId &&
        !networkPaused &&
        navigator.onLine &&
        document.visibilityState === 'visible' &&
        document.hasFocus() &&
        (!automatic || now - lastInput < 120000);
      if (active) {
        const seconds = Math.min(1.5, (now - lastTick) / 1000);
        buffer += seconds;
        total.current += seconds;
        setElapsed(Math.floor(total.current));
      }
      lastTick = now;
      setPaused(!active);
    };
    const visibility = () => {
      tick();
      if (document.visibilityState !== 'visible' || !document.hasFocus()) void flush();
      else input();
    };
    const timer = window.setInterval(tick, 1000);
    const heartbeat = window.setInterval(() => void flush(), HEARTBEAT_SECONDS * 1000);
    const interactions = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart'] as const;
    for (const event of interactions) window.addEventListener(event, input, { passive: true });
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', visibility);
    window.addEventListener('focus', visibility);
    return () => {
      tick();
      disposed = true;
      window.clearInterval(timer);
      window.clearInterval(heartbeat);
      for (const event of interactions) window.removeEventListener(event, input);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', visibility);
      window.removeEventListener('focus', visibility);
      void flush(true);
    };
  }, [running, courseId, activity, automatic, attemptId]);
  return (
    <section className="practice-timer panel" aria-label="Practice time">
      <div className="practice-timer-heading">
        <Clock size={18} aria-hidden="true" />
        <strong>{activity === 'reading' ? 'Reading time' : 'Practice time'}</strong>
        <span>{running ? (paused ? 'Paused' : 'Focusing') : 'Ready'}</span>
      </div>
      <div className="practice-timer-values">
        <div>
          <strong>{focusTime(elapsed)}</strong>
          <span>This visit</span>
        </div>
        <div>
          <strong>{focusTime(courseTotal)}</strong>
          <span>This course · {focusXp(courseTotal)} XP</span>
        </div>
        <div>
          <strong>{focusTime(today)}</strong>
          <span>Today · {Math.floor(DAILY_GOAL_SECONDS / 60)} min goal</span>
        </div>
      </div>
      <div className="practice-timer-footer">
        <p className="field-hint">
          1 focus minute = 1 XP.{' '}
          {automatic
            ? 'Pauses when hidden, unfocused, or idle for 2 minutes.'
            : 'Keep this tab visible and focused while you study.'}{' '}
          Time saves every 15 seconds.
        </p>
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            setMessage('');
            setRunning((value) => !value);
          }}
        >
          {running ? <Pause size={16} /> : <Play size={16} />}
          {running ? 'Pause timer' : activity === 'reading' ? 'Start reading' : 'Start practice'}
        </button>
      </div>
      {message && (
        <p role="status" className="field-hint">
          {message}
        </p>
      )}
    </section>
  );
}
