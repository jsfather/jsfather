import { describe, expect, it } from 'vitest';
import { reminderDay, vocabularyReminderBody } from '../src/lib/reminders';
import { pushSubscriptionSchema, validPushEndpoint } from '../src/lib/push-validation';
describe('daily vocabulary reminders', () => {
  it('uses local time including day boundaries', () => {
    const now = new Date('2026-10-11T05:45:00Z');
    expect(reminderDay(now, 'Asia/Tehran')).toEqual({ day: '2026-10-11', eligible: true });
    expect(reminderDay(now, 'America/Los_Angeles')).toEqual({ day: '2026-10-10', eligible: true });
    expect(reminderDay(now, 'UTC').eligible).toBe(false);
  });
  it('separates learning and review and skips empty queues', () => {
    expect(vocabularyReminderBody(3, 1)).toBe(
      'Hey, you have 3 words to learn and 1 word to review today.',
    );
    expect(vocabularyReminderBody(0, 2)).toBe('Hey, you have 2 words to review today.');
    expect(vocabularyReminderBody(0, 0)).toBeNull();
  });
  it('rejects arbitrary server-side destinations and malformed keys', () => {
    for (const url of [
      'http://fcm.googleapis.com/a',
      'https://localhost/a',
      'https://fcm.googleapis.com.evil.test/a',
      'https://user@web.push.apple.com/a',
      'https://web.push.apple.com:8443/a',
    ])
      expect(validPushEndpoint(url)).toBe(false);
    for (const url of [
      'https://fcm.googleapis.com/a',
      'https://updates.push.services.mozilla.com/a',
      'https://web.push.apple.com/a',
      'https://wns2.notify.windows.com/a',
    ])
      expect(validPushEndpoint(url)).toBe(true);
    expect(
      pushSubscriptionSchema.safeParse({
        endpoint: 'https://fcm.googleapis.com/a',
        keys: { p256dh: 'bad', auth: 'bad' },
      }).success,
    ).toBe(false);
  });
});
