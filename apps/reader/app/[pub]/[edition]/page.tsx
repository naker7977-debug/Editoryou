import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDate, formatIDR, type Plan } from '@press/db';
import { createClient, getSessionUser } from '@press/db/server';
import { coverOf, getEdition, getPublication, getSnapshot } from '@/lib/data';
import { CoverThumb } from '@/components/CoverThumb';
import { ReaderShell } from '@/components/ReaderShell';

export const dynamic = 'force-dynamic';

export default async function EditionPage({ params }: { params: Promise<{ pub: string; edition: string }> }) {
  const { pub: slug, edition: id } = await params;
  const pub = await getPublication(slug);
  const ed = await getEdition(id);
  if (!pub || !ed || ed.publication_id !== pub.id) notFound();
  const snap = ed.status === 'published' ? await getSnapshot(ed.id, pub.type) : null;

  if (snap) return <ReaderShell edition={snap} backHref={`/${pub.slug}`} backLabel={pub.name} />;

  // Terkunci: tampilkan sampul + ajakan masuk / berlangganan
  const user = await getSessionUser();
  const sb = await createClient();
  const { data: plans } = await sb.from('plans').select('*').eq('is_active', true).or(`publication_id.is.null,publication_id.eq.${pub.id}`).order('price_idr');
  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <Link href={`/${pub.slug}`} className="font-garamond italic text-white/50 hover:text-paper">‹ {pub.name}</Link>
      <div className="mt-4 grid gap-10 md:grid-cols-[300px_1fr]">
        <div className="paper-card max-w-[300px]"><CoverThumb data={coverOf(pub, ed)} label={pub.name} sub={ed.number ?? undefined} /></div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[.2em] text-gold">{pub.name} · {ed.number}</div>
          <h1 className="mt-1 font-display text-4xl font-bold">{ed.title || `Edisi ${formatDate(ed.edition_date)}`}</h1>
          <p className="mt-2 font-garamond text-lg italic text-white/60">{formatDate(ed.edition_date)}</p>
          <div className="mt-6 rounded-xl border border-gold/30 bg-gold/10 p-6">
            {ed.status !== 'published' ? (
              <p>Edisi ini belum diterbitkan.</p>
            ) : !user ? (<>
              <h2 className="font-display text-xl font-bold">Edisi ini khusus pelanggan</h2>
              <p className="mt-2 text-white/70">Masuk dengan akun pelanggan Anda, atau daftar lalu aktifkan langganan.</p>
              <div className="mt-4 flex gap-3"><Link href={`/masuk?next=/${pub.slug}/${ed.id}`} className="btn btn-gold">Masuk</Link><Link href="/daftar" className="btn">Daftar</Link></div>
            </>) : (<>
              <h2 className="font-display text-xl font-bold">Langganan Anda belum aktif untuk {pub.name}</h2>
              <p className="mt-2 text-white/70">Pilih paket di bawah, lalu lakukan pembayaran sesuai petunjuk di halaman akun. Admin akan mengaktifkan langganan Anda.</p>
              <ul className="mt-4 space-y-2">
                {(plans as Plan[] | null)?.map((p) => <li key={p.id} className="flex items-center justify-between rounded-md bg-black/30 px-4 py-3"><span>{p.name}</span><b className="text-gold">{formatIDR(p.price_idr)} / {p.interval === 'year' ? 'tahun' : 'bulan'}</b></li>)}
              </ul>
              <div className="mt-4"><Link href="/akun" className="btn btn-gold">Buka halaman akun</Link></div>
            </>)}
          </div>
        </div>
      </div>
    </div>
  );
}
