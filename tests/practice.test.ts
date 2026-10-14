import { describe, it, expect } from 'vitest';
import {
  creditedPracticeSeconds,
  focusTime,
  focusXp,
  splitPracticeTime,
  streakSummary,
} from '../src/lib/practice';
import { streakReminder } from '../src/lib/reminders';
describe('time as XP and daily streaks', () => {
  it('uses actual seconds with one focus minute equaling one XP', () => {
    expect(focusTime(65)).toBe('1m 5s');
    expect(focusTime(3661)).toBe('1h 1m');
    expect(focusXp(300)).toBe('5.0');
    expect(focusXp(30)).toBe('0.5');
  });
  it('keeps yesterday’s streak alive while today is still in progress', () => {
    const days = [
      { day: '2026-10-12', seconds: 300 },
      { day: '2026-10-13', seconds: 400 },
      { day: '2026-10-14', seconds: 299 },
    ];
    expect(streakSummary(days, '2026-10-14')).toMatchObject({
      current: 2,
      best: 2,
      metToday: false,
      todaySeconds: 299,
    });
    expect(
      streakSummary([...days.slice(0, 2), { day: '2026-10-14', seconds: 300 }], '2026-10-14'),
    ).toMatchObject({ current: 3, best: 3, metToday: true });
  });
  it('breaks only after a missed local day and retains the best streak', () => {
    const days = [
      { day: '2026-10-10', seconds: 300 },
      { day: '2026-10-11', seconds: 300 },
      { day: '2026-10-13', seconds: 299 },
    ];
    expect(streakSummary(days, '2026-10-14')).toMatchObject({ current: 0, best: 2 });
    expect(
      streakSummary([...days, { day: '2026-10-14', seconds: 301 }], '2026-10-14'),
    ).toMatchObject({ current: 1, best: 2 });
    expect(streakSummary([], '2026-10-14').current).toBe(0);
  });
  it('handles year boundaries and ignores future days for streaks', () => {
    expect(
      streakSummary(
        [
          { day: '2025-12-31', seconds: 300 },
          { day: '2026-01-01', seconds: 300 },
          { day: '2026-01-02', seconds: 300 },
        ],
        '2026-01-01',
      ),
    ).toMatchObject({ current: 2, best: 2 });
  });
  it('caps heartbeats to real elapsed time and prevents idle catch-up', () => {
    const before = new Date('2026-10-14T10:00:00Z');
    expect(creditedPracticeSeconds(30, before, new Date('2026-10-14T10:00:05Z'))).toBe(5);
    expect(creditedPracticeSeconds(1000, before, new Date('2026-10-14T12:00:00Z'))).toBe(30);
    expect(creditedPracticeSeconds(10, before, new Date('2026-10-14T09:59:59Z'))).toBe(0);
  });
  it('splits practice across the user’s midnight without losing seconds', () => {
    expect(splitPracticeTime(new Date('2026-10-14T20:30:10Z'), 30, 'Asia/Tehran')).toEqual([
      { day: '2026-10-14', seconds: 20 },
      { day: '2026-10-15', seconds: 10 },
    ]);
    expect(
      splitPracticeTime(new Date('2026-10-14T20:30:10.500Z'), 30, 'Asia/Tehran').reduce(
        (sum, row) => sum + row.seconds,
        0,
      ),
    ).toBe(30);
  });
  it('handles DST and half-hour offsets without using a fixed 24-hour day', () => {
    expect(splitPracticeTime(new Date('2026-11-01T04:00:10Z'), 30, 'America/New_York')).toEqual([
      { day: '2026-10-31', seconds: 20 },
      { day: '2026-11-01', seconds: 10 },
    ]);
    expect(splitPracticeTime(new Date('2026-03-08T07:00:10Z'), 30, 'America/New_York')).toEqual([
      { day: '2026-03-08', seconds: 30 },
    ]);
  });
  it('reminds only after 9 PM local time when the five-minute goal is incomplete', () => {
    expect(streakReminder(new Date('2026-10-14T17:29:59Z'), 'Asia/Tehran', 0).eligible).toBe(false);
    expect(streakReminder(new Date('2026-10-14T17:30:00Z'), 'Asia/Tehran', 0).eligible).toBe(true);
    expect(streakReminder(new Date('2026-10-14T17:30:00Z'), 'Asia/Tehran', 300).eligible).toBe(
      false,
    );
    expect(streakReminder(new Date('2026-10-14T17:30:00Z'), 'Asia/Tehran', 270).body).toContain(
      '1 more minute',
    );
  });
});
