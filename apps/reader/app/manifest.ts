import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Kios Koran & Majalah Digital',
    short_name: 'Kios Digital',
    description: 'Baca koran dan majalah daerah dengan pengalaman membalik halaman.',
    start_url: '/',
    display: 'standalone',
    background_color: '#15120f',
    theme_color: '#15120f',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
