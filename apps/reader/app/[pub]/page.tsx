import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDate, KIND_LABEL } from '@press/db';
import { coverOf, getPublication, listPublishedEditions } from '@/lib/data';
import { CoverThumb } from '@/components/CoverThumb';

export const dynamic = 'force-dynamic';

export default async function PublicationPage({ params }: { params: Promise<{ pub: string }> }) {
  const { pub: slug } = await params;
  const pub = await getPublication(slug);
  if (!pub) notFound();
  const editions = await listPublishedEditions(pub.id);
  const latest = editions[0];
  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <Link href="/" className="font-garamond italic text-white/50 hover:text-paper">‹ Kios</Link>
      <div className="mt-3 mb-10 grid gap-8 border-b border-white/10 pb-10 md:grid-cols-[260px_1fr]">
        <div className="paper-card max-w-[260px]">
          {latest ? <Link href={`/${pub.slug}/${latest.id}`}><CoverThumb data={coverOf(pub, latest)} label={pub.name} sub={latest.number ?? undefined} /></Link> : <CoverThumb data={null} label={pub.name} />}
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[.2em] text-gold">{KIND_LABEL[pub.type]}{pub.city ? ` · ${pub.city}` : ''}</div>
          <h1 className={pub.type === 'magazine' ? 'font-display text-5xl font-bold uppercase tracking-[.12em] text-paper' : 'font-black text-5xl text-paper'}>{pub.name}</h1>
          {pub.tagline && <p className="mt-2 font-garamond text-xl italic text-white/60">{pub.tagline}</p>}
          {pub.description && <p className="mt-4 max-w-2xl text-white/70">{pub.description}</p>}
          {latest && (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href={`/${pub.slug}/${latest.id}`} className="btn btn-gold">Baca edisi terbaru</Link>
              <span className="font-garamond italic text-white/50">{latest.number} · {formatDate(latest.edition_date)}{latest.access === 'subscribers' ? ' · khusus pelanggan' : ' · gratis'}</span>
            </div>
          )}
        </div>
      </div>
      <h2 className="mb-5 font-display text-2xl font-bold">Arsip Edisi</h2>
      {!editions.length && <p className="text-white/60">Belum ada edisi terbit.</p>}
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
        {editions.map((ed) => (
          <Link key={ed.id} href={`/${pub.slug}/${ed.id}`} className="group block">
            <div className="paper-card overflow-hidden transition group-hover:-translate-y-1"><CoverThumb data={coverOf(pub, ed)} label={pub.name} sub={ed.number ?? undefined} /></div>
            <div className="mt-3 font-display text-sm font-bold leading-tight">{ed.number || ed.title}</div>
            <div className="font-garamond text-sm italic text-white/50">{formatDate(ed.edition_date)}{ed.access === 'free' ? ' · gratis' : ''}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
