import type { MetadataRoute } from 'next';
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: process.env.NEXT_PUBLIC_APP_URL ?? 'https://jsfather.ir',
      changeFrequency: 'monthly',
      priority: 1,
    },
  ];
}
