import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'jsfather Personal University',
    short_name: 'University',
    description: 'Your courses, vocabulary practice, and personal learning schedule.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#0c1015',
    theme_color: '#0c1015',
    lang: 'en',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
