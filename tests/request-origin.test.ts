import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasSameOrigin } from '../src/lib/request-origin';

afterEach(() => vi.unstubAllEnvs());

describe('authenticated push write origins', () => {
  it.each(['POST', 'DELETE'])('accepts public HTTPS %s requests behind an HTTP proxy', (method) => {
    vi.stubEnv('AUTH_URL', 'https://jsfather.ir');
    expect(
      hasSameOrigin(
        new Request('http://localhost:3000/api/push/subscription', {
          method,
          headers: { origin: 'https://jsfather.ir' },
        }),
      ),
    ).toBe(true);
  });

  it.each([undefined, 'https://untrusted.test', 'http://jsfather.ir', 'https://jsfather.ir:8443'])(
    'rejects origin %s even with spoofed proxy headers',
    (origin) => {
      vi.stubEnv('AUTH_URL', 'https://jsfather.ir');
      expect(
        hasSameOrigin(
          new Request('http://localhost:3000/api/push/subscription', {
            method: 'POST',
            headers: {
              ...(origin ? { origin } : {}),
              'x-forwarded-host': 'untrusted.test',
              'x-forwarded-proto': 'https',
            },
          }),
        ),
      ).toBe(false);
    },
  );

  it('uses the app URL when no auth URL is configured', () => {
    vi.stubEnv('AUTH_URL', '');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://jsfather.ir/');
    expect(
      hasSameOrigin(
        new Request('http://localhost:3000/api/push/subscription', {
          headers: { origin: 'https://jsfather.ir' },
        }),
      ),
    ).toBe(true);
  });

  it('uses the request origin for unconfigured local development', () => {
    vi.stubEnv('AUTH_URL', '');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    expect(
      hasSameOrigin(
        new Request('http://localhost:3000/api/push/subscription', {
          headers: { origin: 'http://localhost:3000' },
        }),
      ),
    ).toBe(true);
  });

  it('rejects writes when the configured URL is invalid', () => {
    vi.stubEnv('AUTH_URL', 'invalid');
    expect(
      hasSameOrigin(
        new Request('http://localhost:3000/api/push/subscription', {
          headers: { origin: 'http://localhost:3000' },
        }),
      ),
    ).toBe(false);
  });
});
