// Use the configured public origin behind a reverse proxy. Forwarded headers
// are not an authority for accepting authenticated writes.
export function hasSameOrigin(request: Request) {
  const configuredUrl = process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  try {
    const expectedOrigin = new URL(configuredUrl || request.url).origin;
    return request.headers.get('origin') === expectedOrigin;
  } catch {
    return false;
  }
}
