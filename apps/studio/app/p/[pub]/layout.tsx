import Link from 'next/link';
import { requirePub } from '@/lib/pub';
import { ROLE_LABEL, canLayout, canManageMembers } from '@press/db';
import { SideNav } from '@/components/SideNav';

export default async function PubLayout({ children, params }: { children: React.ReactNode; params: Promise<{ pub: string }> }) {
  const { pub: slug } = await params;
  const { pub, role } = await requirePub(slug);
  const base = `/p/${pub.slug}`;
  const teen = pub.type === 'magazine';
  const items = [
    { href: base, label: teen ? 'Dashboard' : 'Ringkasan', icon: '◫', exact: true },
    { href: `${base}/naskah`, label: teen ? 'Tulisan' : 'Naskah', icon: '✎', dot: '#ff5cc8' },
    ...(canLayout(role === 'superadmin' ? 'chief' : role) ? [{ href: `${base}/edisi`, label: teen ? 'Edisi & Layout' : 'Edisi & Tata Letak', icon: '▤', dot: '#a3e635' }] : [{ href: `${base}/edisi`, label: 'Edisi', icon: '▤', dot: '#a3e635' }]),
    { href: `${base}/media`, label: teen ? 'Galeri Foto' : 'Media', icon: '▣', dot: '#22d3ee' },
    { href: `${base}/tim`, label: teen ? 'Tim Kita' : 'Tim Redaksi', icon: '☷', dot: '#ffb547' },
    ...(role === 'superadmin' || canManageMembers(role) ? [{ href: `${base}/pengaturan`, label: 'Pengaturan', icon: '⚙' }] : []),
  ];
  const readerUrl = process.env.NEXT_PUBLIC_READER_URL;
  const roleLabel = role === 'superadmin' ? 'Superadmin' : ROLE_LABEL[role];

  if (teen) {
    return (
      <div className="teen min-h-screen grid grid-cols-[250px_1fr]">
        <aside className="teen-aside flex flex-col">
          <div className="p-4 pb-3">
            <Link href="/" className="text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--text)]">‹ Semua redaksi</Link>
            <div className="flex items-center gap-3 mt-3">
              <div className="teen-logo" aria-hidden>{pub.name.trim().charAt(0).toUpperCase()}</div>
              <div className="min-w-0">
                <div className="font-extrabold leading-tight truncate">{pub.name}</div>
                <div className="text-[11px] text-[var(--muted)] truncate">{roleLabel}</div>
              </div>
            </div>
          </div>
          <SideNav items={items} />
          <div className="mt-auto p-4 text-xs text-[var(--muted)] space-y-2">
            {readerUrl && <a className="block font-semibold hover:text-[var(--text)]" href={`${readerUrl}/${pub.slug}`} target="_blank" rel="noreferrer">Lihat majalah ↗</a>}
            <form action="/keluar" method="post"><button className="font-semibold hover:text-[var(--text)]">Keluar</button></form>
          </div>
        </aside>
        <main className="min-w-0 min-h-screen flex flex-col">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid grid-cols-[230px_1fr]">
      <aside className="border-r border-[var(--line)] bg-[var(--panel)] flex flex-col">
        <div className="p-4 border-b border-[var(--line)]">
          <Link href="/" className="text-[10px] tracking-[.25em] uppercase text-[var(--muted)] hover:text-[var(--text)]">‹ Studio Redaksi</Link>
          <div className="font-black text-2xl mt-2 leading-tight">{pub.name}</div>
          <div className="text-xs text-[var(--muted)] mt-1">Koran · <span className="text-[var(--gold)]">{roleLabel}</span></div>
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
