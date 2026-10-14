import { describe, expect, it } from 'vitest';
import { claimInstallPrompt } from '../src/lib/install-prompt';

function savedStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}
const day = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 9, 14);

describe('Home Screen prompt frequency', () => {
  it('records the first appearance and suppresses repeats across visits for a month', () => {
    const storage = savedStorage();
    expect(claimInstallPrompt(storage, now)).toBe(true);
    expect(claimInstallPrompt(storage, now)).toBe(false);
    expect(claimInstallPrompt(storage, now + 30 * day)).toBe(false);
    expect(claimInstallPrompt(storage, now + 31 * day)).toBe(true);
    expect(claimInstallPrompt(storage, now + 32 * day)).toBe(false);
  });
  it('does not show repeatedly if the system clock moves backwards', () => {
    const storage = savedStorage();
    expect(claimInstallPrompt(storage, now)).toBe(true);
    expect(claimInstallPrompt(storage, now - day)).toBe(false);
  });
  it('stays quiet when persistent storage is unavailable', () => {
    expect(
      claimInstallPrompt(
        {
          getItem: () => {
            throw new Error('Storage blocked');
          },
          setItem: () => {},
        },
        now,
      ),
    ).toBe(false);
    expect(
      claimInstallPrompt(
        {
          getItem: () => null,
          setItem: () => {
            throw new Error('Storage full');
          },
        },
        now,
      ),
    ).toBe(false);
  });
});
