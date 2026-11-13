import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { FONT_LINK } from '@press/ui';
import { getProfile } from '@press/db/server';
import { hasSupabaseEnv } from '@press/db';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Kios Koran & Majalah Digital', template: '%s · Kios Digital' },
  description: 'Baca koran dan majalah daerah dengan pengalaman membalik halaman seperti aslinya.',
  manifest: '/manifest.webmanifest',
};
export const viewport: Viewport = { themeColor: '#15120f', width: 'device-width', initialScale: 1, maximumScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const profile = hasSupabaseEnv() ? await getProfile().then((r) => r.profile ?? (r.user ? { full_name: '', email: r.user.email ?? null } : null)).catch(() => null) : null;
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={FONT_LINK} rel="stylesheet" />
      </head>
      <body className="flex min-h-full flex-col">
        <header className="flex h-13 items-center gap-4 border-b border-white/10 bg-gradient-to-b from-[#1d1915] to-[#17130f] px-4">
          <Link href="/" className="font-black text-2xl tracking-wide text-paper">Kios Digital</Link>
          <span className="hidden font-garamond italic text-white/50 sm:inline">koran & majalah daerah, dibaca seperti aslinya</span>
          <nav className="ml-auto flex items-center gap-2 text-sm">
            {profile ? (<>
              <Link href="/akun" className="btn">{profile.full_name || profile.email || 'Akun'}</Link>
              <form action="/keluar" method="post"><button className="btn">Keluar</button></form>
            </>) : (<>
              <Link href="/masuk" className="btn">Masuk</Link>
              <Link href="/daftar" className="btn btn-gold">Daftar</Link>
            </>)}
          </nav>
        </header>
        <main className="flex-1 min-h-0">{children}</main>
      </body>
    </html>
  );
}
