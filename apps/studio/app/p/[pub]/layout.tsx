import Link from 'next/link';
import { requirePub } from '@/lib/pub';
import { ROLE_LABEL, canLayout, canManageMembers } from '@press/db';
import { SideNav } from '@/components/SideNav';

export default async function PubLayout({ children, params }: { children: React.ReactNode; params: Promise<{ pub: string }> }) {
  const { pub: slug } = await params;
  const { pub, role } = await requirePub(slug);
  const base = `/p/${pub.slug}`;
  const items = [
    { href: base, label: 'Ringkasan', icon: '◫', exact: true },
    { href: `${base}/naskah`, label: 'Naskah', icon: '✎' },
    ...(canLayout(role === 'superadmin' ? 'chief' : role) ? [{ href: `${base}/edisi`, label: 'Edisi & Tata Letak', icon: '▤' }] : [{ href: `${base}/edisi`, label: 'Edisi', icon: '▤' }]),
    { href: `${base}/media`, label: 'Media', icon: '▣' },
    { href: `${base}/tim`, label: 'Tim Redaksi', icon: '☷' },
    ...(role === 'superadmin' || canManageMembers(role) ? [{ href: `${base}/pengaturan`, label: 'Pengaturan', icon: '⚙' }] : []),
  ];
  const readerUrl = process.env.NEXT_PUBLIC_READER_URL;
  return (
    <div className="min-h-screen grid grid-cols-[230px_1fr]">
      <aside className="border-r border-[var(--line)] bg-[var(--panel)] flex flex-col">
        <div className="p-4 border-b border-[var(--line)]">
          <Link href="/" className="text-[10px] tracking-[.25em] uppercase text-[var(--muted)] hover:text-[var(--text)]">‹ Studio Redaksi</Link>
          <div className={(pub.type === 'magazine' ? 'font-display tracking-[.12em] uppercase text-lg' : 'font-black text-2xl') + ' mt-2 leading-tight'}>{pub.name}</div>
          <div className="text-xs text-[var(--muted)] mt-1">{pub.type === 'magazine' ? 'Majalah' : 'Koran'} · <span className="text-[var(--gold)]">{role === 'superadmin' ? 'Superadmin' : ROLE_LABEL[role]}</span></div>
        </div>
        <SideNav items={items} />
        <div className="mt-auto p-4 border-t border-[var(--line)] text-xs text-[var(--muted)] space-y-2">
          {readerUrl && <a className="block hover:text-[var(--text)]" href={`${readerUrl}/${pub.slug}`} target="_blank" rel="noreferrer">Buka di aplikasi pembaca ↗</a>}
          <form action="/keluar" method="post"><button className="hover:text-[var(--text)]">Keluar</button></form>
        </div>
      </aside>
      <main className="min-w-0 min-h-screen flex flex-col">{children}</main>
    </div>
  );
}
