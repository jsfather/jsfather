import type { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/u/'],
      disallow: [
        '/dashboard',
        '/courses',
        '/sessions',
        '/calendar',
        '/exams',
        '/certificates',
        '/settings',
        '/profile',
        '/api/',
        '/login',
      ],
    },
    sitemap: (process.env.NEXT_PUBLIC_APP_URL ?? 'https://jsfather.ir') + '/sitemap.xml',
  };
}
