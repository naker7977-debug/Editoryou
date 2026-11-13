import Link from 'next/link';
import { requirePub } from '@/lib/pub';
import { createClient } from '@press/db/server';
import { ARTICLE_STATUS_LABEL, formatDate, type Article, type ArticleStatus } from '@press/db';
import { createArticle } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default async function Articles({ params, searchParams }: { params: Promise<{ pub: string }>; searchParams: Promise<{ status?: string; q?: string }> }) {
  const { pub: slug } = await params;
  const { status, q } = await searchParams;
  const { pub } = await requirePub(slug);
  const supabase = await createClient();
  let query = supabase.from('articles').select('id,title,kicker,status,byline,updated_at,author_id,profiles(full_name)').eq('publication_id', pub.id).order('updated_at', { ascending: false }).limit(200);
  if (status) query = query.eq('status', status);
  if (q) query = query.ilike('title', `%${q}%`);
  const { data } = await query;
  const arts = (data ?? []) as unknown as Article[];
  const base = `/p/${pub.slug}/naskah`;
  const tabs: Array<[string, string]> = [['', 'Semua'], ['draft', 'Draf'], ['review', 'Menunggu Redaktur'], ['ready', 'Siap Tayang'], ['published', 'Terbit']];
  return (
    <div className="p-8 max-w-6xl w-full">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div><div className="text-[10px] tracking-[.3em] uppercase text-[var(--gold)] font-semibold">Naskah</div><h1 className="font-display text-3xl mt-1">Semua tulisan</h1></div>
        <form action={createArticle.bind(null, pub.id, pub.slug)}><button className="btn gold">✎ Naskah baru</button></form>
      </div>
      <div className="flex items-center gap-2 flex-wrap mb-4">
        {tabs.map(([v, l]) => <Link key={v} href={v ? `${base}?status=${v}` : base} className={'btn sm' + ((status ?? '') === v ? ' gold' : '')}>{l}</Link>)}
        <form className="ml-auto" method="get"><input className="input" style={{ width: 240 }} name="q" placeholder="Cari judul…" defaultValue={q ?? ''} /></form>
      </div>
      <div className="card overflow-hidden">
        <table className="tbl">
          <thead><tr><th>Judul</th><th>Penulis</th><th>Status</th><th>Diperbarui</th></tr></thead>
          <tbody>
            {arts.map(a => (
              <tr key={a.id}>
                <td><Link href={`${base}/${a.id}`} className="font-medium hover:text-[var(--gold)]">{a.title || '(tanpa judul)'}</Link>{a.kicker && <div className="text-[10px] tracking-[.15em] uppercase text-[var(--gold)]">{a.kicker}</div>}</td>
                <td className="text-[var(--muted)]">{a.profiles?.full_name || a.byline || '—'}</td>
                <td><span className={'badge ' + (['ready', 'published'].includes(a.status) ? 'green' : '')}>{ARTICLE_STATUS_LABEL[a.status as ArticleStatus]}</span></td>
                <td className="text-[var(--muted)] whitespace-nowrap">{formatDate(a.updated_at, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
              </tr>
            ))}
            {arts.length === 0 && <tr><td colSpan={4} className="text-[var(--muted)] py-8 text-center">Tidak ada naskah.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
