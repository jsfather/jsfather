import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  seconds: 0,
  available: true,
  claimedElsewhere: false,
  subscription: {
    id: 'device',
    userId: 'learner',
    endpoint: 'https://fcm.googleapis.com/test',
    p256dh: 'key',
    auth: 'auth',
    lastSentDay: '2026-10-14',
    lastStreakDay: null as string | null,
  },
  send: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('@/lib/push', () => ({
  pushConfigured: () => true,
  pushClient: () => ({ sendNotification: state.send }),
}));
vi.mock('@/lib/vocabulary-data', () => ({
  vocabularyDueSummary: async () => ({ learn: 0, review: 0 }),
}));
vi.mock('@/db', async () => {
  const { getTableName } = await import('drizzle-orm');
  return {
    db: {
      select: () => ({
        from: (table: Parameters<typeof getTableName>[0]) => {
          const name = getTableName(table);
          return {
            innerJoin: async () => [{ subscription: { ...state.subscription }, timezone: 'UTC' }],
            where: () =>
              name === 'practice_days'
                ? Promise.resolve([{ seconds: state.seconds }])
                : { limit: async () => (state.available ? [{ id: 'course' }] : []) },
          };
        },
      }),
      update: () => ({
        set: (patch: Partial<typeof state.subscription>) => ({
          where: () => ({
            returning: async () => {
              if (
                state.claimedElsewhere ||
                state.subscription.lastStreakDay === patch.lastStreakDay
              )
                return [];
              Object.assign(state.subscription, patch);
              return [{ id: 'device' }];
            },
            then: (resolve: (value: undefined) => void) => {
              Object.assign(state.subscription, patch);
              resolve(undefined);
            },
          }),
        }),
      }),
      delete: () => ({
        where: async () => {
          state.remove();
        },
      }),
    },
  };
});
import { POST } from '../src/app/api/cron/vocabulary-reminders/route';
const request = () =>
  new Request('http://localhost/api/cron/vocabulary-reminders', {
    method: 'POST',
    headers: { authorization: 'Bearer test-cron-secret' },
  });
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-14T21:00:00Z'));
  vi.stubEnv('CRON_SECRET', 'test-cron-secret');
  state.seconds = 0;
  state.available = true;
  state.claimedElsewhere = false;
  state.subscription.lastStreakDay = null;
  state.subscription.lastSentDay = '2026-10-14';
  state.send.mockReset().mockResolvedValue({});
  state.remove.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
describe('end-of-day reminder delivery', () => {
  it('sends one reminder per device/day and directs it to the daily goal', async () => {
    expect((await POST(request())).status).toBe(200);
    expect(state.send).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(state.send.mock.calls[0][1]);
    expect(payload).toMatchObject({ tag: 'practice-streak', url: '/dashboard' });
    expect(payload.body).toContain('5 minutes');
    await POST(request());
    expect(state.send).toHaveBeenCalledTimes(1);
  });
  it('stays quiet after the goal is met or when there is no active course', async () => {
    state.seconds = 300;
    await POST(request());
    expect(state.send).not.toHaveBeenCalled();
    state.seconds = 0;
    state.available = false;
    await POST(request());
    expect(state.send).not.toHaveBeenCalled();
  });
  it('skips a reminder claimed by another scheduler and retries transient failures', async () => {
    state.claimedElsewhere = true;
    await POST(request());
    expect(state.send).not.toHaveBeenCalled();
    state.claimedElsewhere = false;
    state.send.mockRejectedValueOnce(new Error('temporary failure'));
    expect((await POST(request())).status).toBe(503);
    expect(state.subscription.lastStreakDay).toBeNull();
    expect((await POST(request())).status).toBe(200);
    expect(state.send).toHaveBeenCalledTimes(2);
  });
  it('removes expired subscriptions and authenticates scheduler requests', async () => {
    expect(
      (
        await POST(
          new Request('http://localhost/api/cron/vocabulary-reminders', { method: 'POST' }),
        )
      ).status,
    ).toBe(401);
    state.send.mockRejectedValueOnce({ statusCode: 410 });
    await POST(request());
    expect(state.remove).toHaveBeenCalledTimes(1);
  });
});
