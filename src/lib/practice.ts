import { addDays, format, parseISO } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const DAILY_GOAL_SECONDS = 5 * 60;
export const HEARTBEAT_SECONDS = 15;
export const MAX_HEARTBEAT_SECONDS = 30;
export type PracticeActivity = 'lesson' | 'reading' | 'vocabulary' | 'exam';
export type PracticeDay = { day: string; seconds: number };
export const previousDay = (day: string) => format(addDays(parseISO(day), -1), 'yyyy-MM-dd');
export function focusTime(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  if (whole >= 3600) return `${Math.floor(whole / 3600)}h ${Math.floor((whole % 3600) / 60)}m`;
  return `${Math.floor(whole / 60)}m ${whole % 60}s`;
}
export const focusXp = (seconds: number) => (Math.max(0, seconds) / 60).toFixed(1);
export function streakSummary(days: PracticeDay[], today: string) {
  const qualified = [
    ...new Set(
      days
        .filter((day) => day.day <= today && day.seconds >= DAILY_GOAL_SECONDS)
        .map((day) => day.day),
    ),
  ].sort();
  const completed = new Set(qualified);
  const todaySeconds = days.find((day) => day.day === today)?.seconds ?? 0;
  let anchor = completed.has(today) ? today : previousDay(today);
  let current = 0;
  while (completed.has(anchor)) {
    current++;
    anchor = previousDay(anchor);
  }
  let best = 0,
    run = 0,
    last = '';
  for (const day of qualified) {
    run = last === previousDay(day) ? run + 1 : 1;
    best = Math.max(best, run);
    last = day;
  }
  return {
    current,
    best,
    todaySeconds,
    metToday: todaySeconds >= DAILY_GOAL_SECONDS,
    totalSeconds: days.reduce((sum, day) => sum + day.seconds, 0),
  };
}
// Use calendar midnights, rather than 24-hour arithmetic, across DST transitions.
export function splitPracticeTime(end: Date, seconds: number, timezone: string): PracticeDay[] {
  let cursor = new Date(end.getTime() - seconds * 1000);
  const result: PracticeDay[] = [];
  while (cursor < end) {
    const day = formatInTimeZone(cursor, timezone, 'yyyy-MM-dd');
    const next = fromZonedTime(
      format(addDays(parseISO(day), 1), 'yyyy-MM-dd') + 'T00:00:00',
      timezone,
    );
    const stop = new Date(Math.min(next.getTime(), end.getTime()));
    const amount = (stop.getTime() - cursor.getTime()) / 1000;
    if (amount > 0) result.push({ day, seconds: amount });
    cursor = stop;
  }
  // Whole seconds in the ledger, with any fractional boundary remainder assigned to the last day.
  let remaining = seconds;
  return result
    .map((item, index) => {
      const amount = index === result.length - 1 ? remaining : Math.floor(item.seconds);
      remaining -= amount;
      return { day: item.day, seconds: amount };
    })
    .filter((item) => item.seconds > 0);
}
export function creditedPracticeSeconds(requested: number, previous: Date, end: Date) {
  return Math.max(
    0,
    Math.min(
      requested,
      MAX_HEARTBEAT_SECONDS,
      Math.floor((end.getTime() - previous.getTime()) / 1000),
    ),
  );
}
