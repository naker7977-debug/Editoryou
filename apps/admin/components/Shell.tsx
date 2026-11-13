import Link from 'next/link';
import { SideNav } from './SideNav';

export function Shell({ children, who }: { children: React.ReactNode; who: string }) {
  const items = [
    { href: '/', label: 'Ringkasan', icon: '◫', exact: true },
    { href: '/penerbit', label: 'Penerbit', icon: '▤' },
    { href: '/anggota', label: 'Akun Redaksi', icon: '☷' },
    { href: '/pembaca', label: 'Pembaca & Langganan', icon: '✦' },
    { href: '/paket', label: 'Paket Langganan', icon: '◈' },
  ];
  const studio = process.env.NEXT_PUBLIC_STUDIO_URL, reader = process.env.NEXT_PUBLIC_READER_URL;
  return (
    <div className="min-h-screen grid grid-cols-[230px_1fr]">
      <aside className="border-r border-[var(--line)] bg-[var(--panel)] flex flex-col">
        <div className="p-4 border-b border-[var(--line)]">
          <div className="text-[10px] tracking-[.25em] uppercase text-[var(--gold)]">Platform</div>
          <div className="font-display text-xl mt-1">Kontrol Admin</div>
          <div className="text-xs text-[var(--muted)] mt-1 truncate">{who}</div>
        </div>
        <SideNav items={items} />
        <div className="mt-auto p-4 border-t border-[var(--line)] text-xs text-[var(--muted)] space-y-2">
          {studio && <a className="block hover:text-[var(--text)]" href={studio} target="_blank" rel="noreferrer">Studio Redaksi ↗</a>}
          {reader && <a className="block hover:text-[var(--text)]" href={reader} target="_blank" rel="noreferrer">Aplikasi Pembaca ↗</a>}
          <Link href="/setup" className="block hover:text-[var(--text)]">Status penyiapan</Link>
          <form action="/keluar" method="post"><button className="hover:text-[var(--text)]">Keluar</button></form>
        </div>
      </aside>
      <main className="min-w-0 p-8 max-w-6xl w-full">{children}</main>
    </div>
  );
}
export function H1({ kicker, title, right }: { kicker: string; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
      <div><div className="text-[10px] tracking-[.3em] uppercase text-[var(--gold)] font-semibold">{kicker}</div><h1 className="font-display text-3xl mt-1">{title}</h1></div>
      {right}
    </div>
  );
}
