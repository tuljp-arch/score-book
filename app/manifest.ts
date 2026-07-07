import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'The Score Book',
    short_name: 'Score Book',
    description: 'Your skeet record, kept properly.',
    start_url: '/',
    display: 'standalone',
    background_color: '#EDE7D6',
    theme_color: '#262E1E',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
