import Link from 'next/link';
import { hasSupabaseEnv, formatDate, KIND_LABEL, type Publication } from '@press/db';
import { coverOf, listPublications, listPublishedEditions } from '@/lib/data';
import { CoverThumb } from '@/components/CoverThumb';

export const dynamic = 'force-dynamic';

export default async function Kiosk() {
  const ready = hasSupabaseEnv();
  const pubs = ready ? await listPublications().catch(() => []) : [];
  const editions = ready ? await listPublishedEditions(undefined, 80).catch(() => []) : [];
  const latestByPub = new Map<string, (typeof editions)[number]>();
  for (const e of editions) if (!latestByPub.has(e.publication_id)) latestByPub.set(e.publication_id, e);
  const newspapers = pubs.filter((p) => p.type === 'newspaper');
  const magazines = pubs.filter((p) => p.type === 'magazine');

  const Shelf = ({ title, items }: { title: string; items: Publication[] }) => items.length ? (
    <section className="mb-12">
      <h2 className="mb-5 font-display text-2xl font-bold text-paper">{title}</h2>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((p) => {
          const ed = latestByPub.get(p.id);
          return (
            <Link key={p.id} href={`/${p.slug}`} className="group block">
              <div className="paper-card overflow-hidden transition group-hover:-translate-y-1">
                <CoverThumb data={ed ? coverOf(p, ed) : null} label={p.name} sub={ed?.number ?? undefined} />
              </div>
              <div className="mt-3 font-display text-base font-bold leading-tight text-paper">{p.name}</div>
              <div className="font-garamond text-sm italic text-white/50">{ed ? `${ed.number ?? ''} · ${formatDate(ed.edition_date)}` : 'Belum ada edisi terbit'}</div>
            </Link>
          );
        })}
      </div>
    </section>
  ) : null;

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="mb-10 border-b border-white/10 pb-8">
        <h1 className="font-black text-5xl text-paper">Kios Digital</h1>
        <p className="mt-2 max-w-2xl font-garamond text-lg italic text-white/60">Koran dan majalah daerah dengan pengalaman membaca seperti memegang cetakannya — tanpa iklan pop-up, halaman demi halaman.</p>
      </div>
      {!ready && (
        <div className="mb-8 rounded-lg border border-gold/30 bg-gold/10 p-4 text-sm text-paper">Supabase belum dikonfigurasi (lihat <code>.env.example</code>). Anda tetap bisa melihat edisi contoh di bawah.</div>
      )}
      <Shelf title="Surat Kabar" items={newspapers} />
      <Shelf title="Majalah" items={magazines} />
      {ready && !pubs.length && <p className="mb-10 text-white/60">Belum ada penerbit aktif. Admin dapat menambahkannya dari aplikasi admin.</p>}
      <section>
        <h2 className="mb-5 font-display text-2xl font-bold text-paper">Edisi Contoh</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/contoh/koran" className="btn">📰 Contoh {KIND_LABEL.newspaper}</Link>
          <Link href="/contoh/majalah" className="btn">📖 Contoh {KIND_LABEL.magazine}</Link>
        </div>
      </section>
    </div>
  );
}
