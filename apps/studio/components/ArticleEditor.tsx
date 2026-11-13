'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@press/db/browser';
import { ARTICLE_STATUS_LABEL, type Article, type ArticleStatus, type Publication } from '@press/db';
import { imgSrc, words } from '@press/ui';
import { MediaPicker } from './MediaPicker';
import { deleteArticle } from '@/lib/actions';
import { Toast, useToast } from './Toast';

export function ArticleEditor({ article, pub, canEdit, isEditor }: { article: Article; pub: Publication; canEdit: boolean; isEditor: boolean }) {
  const [a, setA] = useState<Article>(article);
  const [saved, setSaved] = useState<'ok' | 'saving' | 'dirty' | 'err'>('ok');
  const [pick, setPick] = useState(false);
  const toast = useToast();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = useRef(true);

  function set<K extends keyof Article>(k: K, v: Article[K]) { setA(x => ({ ...x, [k]: v })); setSaved('dirty'); }

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!canEdit) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSaved('saving');
      const { error } = await createClient().from('articles').update({ title: a.title, kicker: a.kicker, deck: a.deck, byline: a.byline, body: a.body, cover_url: a.cover_url, cover_caption: a.cover_caption, status: a.status, tags: a.tags }).eq('id', a.id);
      setSaved(error ? 'err' : 'ok');
      if (error) toast.show('Gagal menyimpan: ' + error.message, true);
    }, 900);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.title, a.kicker, a.deck, a.byline, a.body, a.cover_url, a.cover_caption, a.status, a.tags]);

  const wc = words(a.body);
  const statuses: ArticleStatus[] = isEditor ? ['draft', 'review', 'ready', 'published'] : ['draft', 'review'];
  const base = `/p/${pub.slug}/naskah`;
  const ro = !canEdit;

  return (
    <div className="flex flex-col min-h-screen">
      <header className="h-14 flex items-center gap-3 px-6 border-b border-[var(--line)] bg-[linear-gradient(#1d1915,#17130f)] sticky top-0 z-20">
        <Link href={base} className="text-sm text-[var(--muted)] hover:text-[var(--text)]">‹ Naskah</Link>
        <span className="text-[var(--muted)]">/</span>
        <span className="font-display truncate">{a.title || '(tanpa judul)'}</span>
        <span className="ml-auto text-xs text-[var(--muted)]">{ro ? 'Hanya baca' : saved === 'ok' ? 'Tersimpan' : saved === 'saving' ? 'Menyimpan…' : saved === 'err' ? 'Gagal menyimpan' : 'Belum tersimpan'}</span>
        <select className="input" style={{ width: 'auto' }} value={a.status} disabled={ro} onChange={e => set('status', e.target.value as ArticleStatus)}>
          {statuses.map(s => <option key={s} value={s}>{ARTICLE_STATUS_LABEL[s]}</option>)}
          {!statuses.includes(a.status) && <option value={a.status}>{ARTICLE_STATUS_LABEL[a.status]}</option>}
        </select>
        {canEdit && <form action={deleteArticle.bind(null, a.id, pub.slug)} onSubmit={e => { if (!confirm('Hapus naskah ini?')) e.preventDefault(); }}><button className="btn sm">Hapus</button></form>}
      </header>
      <div className="grid lg:grid-cols-[1fr_320px] gap-0 flex-1">
        <div className="p-8 max-w-3xl w-full">
          <div className="field"><label>Rubrik / kicker</label><input type="text" value={a.kicker ?? ''} readOnly={ro} onChange={e => set('kicker', e.target.value)} placeholder="Laporan Utama" /></div>
          <textarea className="w-full bg-transparent outline-none font-display text-4xl leading-tight font-bold resize-none mb-3 placeholder:text-[#4a403a]" rows={2} value={a.title} readOnly={ro} onChange={e => set('title', e.target.value)} placeholder="Judul tulisan" />
          <textarea className="w-full bg-transparent outline-none font-garamond italic text-xl leading-snug resize-none mb-4 text-[var(--muted)] placeholder:text-[#4a403a]" rows={2} value={a.deck ?? ''} readOnly={ro} onChange={e => set('deck', e.target.value)} placeholder="Sub-judul / deck (opsional)" />
          <div className="field"><label>Byline</label><input type="text" value={a.byline ?? ''} readOnly={ro} onChange={e => set('byline', e.target.value)} placeholder="Nama · Kota" /></div>
          <div className="field">
            <label>Isi tulisan <span className="normal-case tracking-normal text-[var(--muted)]">— pisahkan paragraf dengan baris kosong · {wc} kata · ±{Math.max(1, Math.round(wc / 200))} menit baca</span></label>
            <textarea style={{ minHeight: 520, fontSize: '1rem', lineHeight: 1.7 }} value={a.body} readOnly={ro} onChange={e => set('body', e.target.value)} placeholder="Tulis di sini…" />
          </div>
        </div>
        <aside className="border-l border-[var(--line)] bg-[var(--panel)] p-5 space-y-5">
          <div>
            <div className="text-[10px] tracking-[.2em] uppercase text-[var(--gold)] font-semibold mb-2">Foto utama</div>
            {a.cover_url ? <img src={imgSrc(a.cover_url) ?? undefined} alt="" className="w-full rounded-md border border-[var(--line)]" /> : <div className="aspect-[4/3] rounded-md border border-dashed border-[var(--line)] flex items-center justify-center text-xs text-[var(--muted)]">Belum ada foto</div>}
            {!ro && <div className="flex gap-2 mt-2"><button className="btn sm" onClick={() => setPick(true)}>Pilih / unggah</button>{a.cover_url && <button className="btn sm" onClick={() => set('cover_url', null)}>Lepas</button>}</div>}
            <div className="field mt-3"><label>Keterangan foto</label><input type="text" value={a.cover_caption ?? ''} readOnly={ro} onChange={e => set('cover_caption', e.target.value)} /></div>
          </div>
          <div className="text-xs text-[var(--muted)] leading-relaxed border-t border-[var(--line)] pt-4">
            <div><b className="text-[var(--text)]">Penulis:</b> {a.profiles?.full_name || '—'}</div>
            <div className="mt-2"><b className="text-[var(--text)]">Status:</b> Draf → Menunggu Redaktur → Siap Tayang. Redaktur menautkan naskah “Siap Tayang” ke halaman edisi.</div>
            {!isEditor && <div className="mt-2">Setelah terbit, naskah dikunci; minta redaktur bila perlu perbaikan.</div>}
          </div>
        </aside>
      </div>
      {pick && <MediaPicker pub={pub} onClose={() => setPick(false)} onPick={m => { set('cover_url', m.url); setPick(false); }} />}
      <Toast t={toast} />
    </div>
  );
}
