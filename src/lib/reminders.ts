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
