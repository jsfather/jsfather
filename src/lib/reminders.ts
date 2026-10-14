import { DAILY_GOAL_SECONDS } from './practice';
import { formatInTimeZone } from 'date-fns-tz';
export function reminderDay(now: Date, timezone: string) {
  return {
    day: formatInTimeZone(now, timezone, 'yyyy-MM-dd'),
    eligible: Number(formatInTimeZone(now, timezone, 'H')) >= 9,
  };
}
export function vocabularyReminderBody(learn: number, review: number) {
  const parts = [];
  if (learn) parts.push(`${learn} ${learn === 1 ? 'word' : 'words'} to learn`);
  if (review) parts.push(`${review} ${review === 1 ? 'word' : 'words'} to review`);
  return parts.length ? `Hey, you have ${parts.join(' and ')} today.` : null;
}

export function streakReminder(now: Date, timezone: string, seconds: number) {
  const day = formatInTimeZone(now, timezone, 'yyyy-MM-dd');
  const hour = Number(formatInTimeZone(now, timezone, 'H'));
  const remaining = Math.max(0, DAILY_GOAL_SECONDS - seconds);
  return {
    day,
    eligible: hour >= 21 && remaining > 0,
    body:
      seconds > 0
        ? `${Math.ceil(remaining / 60)} more ${remaining <= 60 ? 'minute' : 'minutes'} of practice completes your daily goal. Any course counts.`
        : 'Make 5 minutes for yourself before midnight. Read, study, review vocabulary, or take an exam to keep your streak going.',
  };
}
