'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@press/db/browser';
import { ARTICLE_STATUS_LABEL, type Article, type Edition, type EditionAccess, type EditionStatus, type Publication } from '@press/db';
import {
  BLOCK_TYPES, PAGE_PRESETS, PageView, markOverflow, newBlock, newPage, normalizeEdition, freezeEdition, words, uid, imgSrc,
  type ArticleMap, type Block, type BlockType, type EditionData, type Page,
} from '@press/ui';
import { MediaPicker } from './MediaPicker';
import { Toast, useToast } from './Toast';
import { deleteEdition } from '@/lib/actions';

type Sel = { page: number; block: number | null };
const clampN = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function LayoutEditor({ edition, pub, articles, canPublish }: { edition: Edition; pub: Publication; articles: Article[]; canPublish: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<EditionData>(() => normalizeEdition(edition.data, pub.type));
  const [status, setStatus] = useState<EditionStatus>(edition.status);
  const [access, setAccess] = useState<EditionAccess>(edition.access);
  const [sel, setSel] = useState<Sel>({ page: 0, block: null });
  const [overflow, setOverflow] = useState<number[]>([]);
  const [saveState, setSaveState] = useState<'ok' | 'dirty' | 'saving' | 'err'>('ok');
  const [picker, setPicker] = useState<null | ((m: { url: string; path?: string | null }) => void)>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const pgWrapRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  const articleMap: ArticleMap = useMemo(() => Object.fromEntries(articles.map(a => [a.id, a])), [articles]);
  const mag = pub.type === 'magazine';

  const page = data.pages[clampN(sel.page, 0, data.pages.length - 1)];
  const block = sel.block != null ? page?.blocks[sel.block] ?? null : null;

  /* ---------- mutasi ---------- */
  const update = useCallback((fn: (d: EditionData) => void) => {
    setData(prev => { const d: EditionData = JSON.parse(JSON.stringify(prev)); fn(d); return d; });
    setSaveState('dirty');
  }, []);
  const updatePage = (fn: (p: Page) => void) => update(d => { const p = d.pages[sel.page]; if (p) fn(p); });
  const updateBlock = (fn: (b: Block) => void) => update(d => { const b = d.pages[sel.page]?.blocks[sel.block ?? -1]; if (b) fn(b); });
  const setB = <K extends keyof Block>(k: K, v: Block[K]) => updateBlock(b => { b[k] = v; });

  /* ---------- autosave ---------- */
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const t = setTimeout(async () => {
      setSaveState('saving');
      try {
        if (edition.id.startsWith('demo-')) { setSaveState('ok'); return; }
        const { error } = await createClient().from('editions').update({ data, title: data.masthead.name, number: data.masthead.number, edition_date: data.masthead.date }).eq('id', edition.id);
        setSaveState(error ? 'err' : 'ok');
        if (error) toast.show('Gagal menyimpan: ' + error.message, true);
      } catch (e) { setSaveState('err'); toast.show('Gagal menyimpan: ' + (e as Error).message, true); }
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (saveState !== 'ok') { e.preventDefault(); } };
    window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h);
  }, [saveState]);

  /* ---------- skala kanvas & deteksi luapan ---------- */
  const fit = useCallback(() => {
    const c = canvasRef.current, w = pgWrapRef.current; if (!c || !w) return;
    const r = c.getBoundingClientRect();
    const s = clampN(Math.min((r.width - 56) / 560, (r.height - 56) / 784), .3, 1.6);
    w.style.width = 560 * s + 'px'; w.style.height = 784 * s + 'px';
    const pg = w.querySelector<HTMLElement>('.pg'); if (pg) pg.style.transform = `scale(${s})`;
  }, []);
  useLayoutEffect(() => {
    fit();
    const pg = pgWrapRef.current?.querySelector<HTMLElement>('.pg');
    if (pg) { const ov = markOverflow(pg); setOverflow(prev => prev.join(',') === ov.join(',') ? prev : ov); }
  });
  useEffect(() => { window.addEventListener('resize', fit); const f = (document as Document & { fonts?: FontFaceSet }).fonts; f?.ready.then(() => { const pg = pgWrapRef.current?.querySelector<HTMLElement>('.pg'); if (pg) setOverflow(markOverflow(pg)); }).catch(() => {}); return () => window.removeEventListener('resize', fit); }, [fit]);

  /* ---------- aksi halaman & blok ---------- */
  const addPage = (presetId: string) => { const pr = PAGE_PRESETS.find(p => p.id === presetId); const np = pr ? pr.make() : newPage(); update(d => { d.pages.splice(sel.page + 1, 0, np); }); setSel({ page: sel.page + 1, block: null }); };
  const movePage = (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= data.pages.length) return; update(d => { [d.pages[i], d.pages[j]] = [d.pages[j], d.pages[i]]; }); setSel({ page: j, block: null }); };
  const removePage = (i: number) => { if (data.pages.length <= 1) { toast.show('Minimal satu halaman', true); return; } if (!confirm(`Hapus halaman "${data.pages[i].section}" (${data.pages[i].blocks.length} blok)?`)) return; update(d => { d.pages.splice(i, 1); }); setSel({ page: clampN(i, 0, data.pages.length - 2), block: null }); };
  const addBlock = (t: BlockType) => { const b = newBlock(t); updatePage(p => p.blocks.push(b)); setSel({ page: sel.page, block: page.blocks.length }); };
  const moveBlock = (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= page.blocks.length) return; updatePage(p => { [p.blocks[i], p.blocks[j]] = [p.blocks[j], p.blocks[i]]; }); setSel({ page: sel.page, block: j }); };
  const reorderBlock = (from: number, to: number) => { if (from === to) return; updatePage(p => { const [m] = p.blocks.splice(from, 1); p.blocks.splice(to, 0, m); }); setSel({ page: sel.page, block: to }); };
  const removeBlock = () => { if (sel.block == null) return; updatePage(p => { p.blocks.splice(sel.block!, 1); }); setSel({ page: sel.page, block: null }); };
  const duplicateBlock = () => { if (!block) return; const c = { ...JSON.parse(JSON.stringify(block)), id: uid() } as Block; updatePage(p => { p.blocks.splice(sel.block! + 1, 0, c); }); setSel({ page: sel.page, block: sel.block! + 1 }); };
  const moveBlockToPage = (to: number) => { if (!block) return; const b = block; update(d => { d.pages[sel.page].blocks.splice(sel.block!, 1); d.pages[to].blocks.push(b); }); setSel({ page: to, block: data.pages[to].blocks.length }); };
  const linkArticle = (id: string) => { const a = articleMap[id]; if (!a) return; updateBlock(b => { b.articleId = id; }); toast.show(`Ditautkan: ${a.title}`); };
  const unlinkArticle = () => { if (!block?.articleId) return; const a = articleMap[block.articleId]; updateBlock(b => { if (a) { b.kicker = a.kicker ?? ''; b.title = a.title; b.deck = a.deck ?? ''; b.byline = a.byline ?? ''; b.body = a.body; if (a.cover_url) b.img = { url: a.cover_url }; b.cap = a.cover_caption ?? b.cap; } b.articleId = null; }); };

  /* ---------- terbitkan ---------- */
  async function publish() {
    setBusy(true);
    try {
      const supabase = createClient();
      const frozen = freezeEdition(data, articleMap);
      const cover: EditionData = { ...frozen, pages: frozen.pages.slice(0, 1) };
      const now = new Date().toISOString();
      const { error: e1 } = await supabase.from('editions').update({ data, title: data.masthead.name, number: data.masthead.number, edition_date: data.masthead.date, status: 'published', access, published_at: now, cover_data: cover }).eq('id', edition.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('edition_snapshots').upsert({ edition_id: edition.id, data: frozen, published_at: now });
      if (e2) throw e2;
      const ids = Array.from(new Set(frozen.pages.flatMap(p => p.blocks.map(b => b.sourceArticleId).filter(Boolean)))) as string[];
      if (ids.length) await supabase.from('articles').update({ status: 'published' }).in('id', ids);
      setStatus('published'); setPublishOpen(false); setSaveState('ok');
      toast.show('Edisi diterbitkan ✓ Pembaca kini dapat membukanya.');
      router.refresh();
    } catch (e) { toast.show('Gagal menerbitkan: ' + ((e as Error).message ?? e), true); }
    finally { setBusy(false); }
  }
  async function unpublish() {
    if (!confirm('Tarik edisi dari publikasi? Pembaca tidak dapat membukanya sampai diterbitkan ulang.')) return;
    const { error } = await createClient().from('editions').update({ status: 'draft' }).eq('id', edition.id);
    if (error) toast.show(error.message, true); else { setStatus('draft'); toast.show('Edisi ditarik.'); router.refresh(); }
  }
  function exportJson() {
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${pub.slug}-${data.masthead.date}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function importJson(file: File) {
    file.text().then(t => { const d = normalizeEdition(JSON.parse(t), pub.type); update(x => { x.pages = d.pages; x.masthead = d.masthead; x.theme = d.theme; }); setSel({ page: 0, block: null }); toast.show('Tata letak diimpor.'); }).catch(() => toast.show('Berkas tidak valid', true));
  }

  const cells = page.blocks.reduce((a, b) => a + b.w * b.h, 0);
  const readyArticles = articles.filter(a => a.status !== 'draft');
  const base = `/p/${pub.slug}`;
  const blockTypes = (Object.keys(BLOCK_TYPES) as BlockType[]).filter(t => BLOCK_TYPES[t].kinds.includes(pub.type));
  const presets = PAGE_PRESETS.filter(p => p.kinds.includes(pub.type));

  return (
    <div className="h-screen flex flex-col">
      {/* ---------- bilah atas ---------- */}
      <header className="h-12 flex items-center gap-2 px-4 border-b border-[var(--line)] bg-[linear-gradient(#1d1915,#17130f)] shrink-0 z-20">
        <Link href={`${base}/edisi`} className="text-sm text-[var(--muted)] hover:text-[var(--text)]">‹ Edisi</Link>
        <span className="text-[var(--muted)]">/</span>
        <span className="font-display truncate">{data.masthead.number || 'Edisi'}</span>
        <span className={'badge ' + (status === 'published' ? 'green' : '')}>{status === 'published' ? 'Terbit' : status}</span>
        <span className="ml-auto text-xs text-[var(--muted)]">{saveState === 'ok' ? 'Tersimpan' : saveState === 'saving' ? 'Menyimpan…' : saveState === 'err' ? 'Gagal menyimpan' : 'Belum tersimpan'}</span>
        <label className="btn sm cursor-pointer">⇡ Impor<input type="file" accept="application/json" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ''; }} /></label>
        <button className="btn sm" onClick={exportJson}>⇣ Ekspor</button>
        <Link href={`${base}/edisi/${edition.id}/pratinjau`} className="btn sm">👁 Pratinjau</Link>
        {canPublish && status === 'published' && <button className="btn sm" onClick={unpublish}>Tarik</button>}
        {canPublish && <button className="btn sm gold" onClick={() => setPublishOpen(true)}>⬆ {status === 'published' ? 'Terbitkan ulang' : 'Terbitkan'}</button>}
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-[280px_1fr_330px]">
        {/* ---------- kiri ---------- */}
        <aside className="overflow-auto bg-[var(--panel)] border-r border-[var(--line)]">
          <section className="sect">
            <h4>Edisi</h4>
            <div className="field"><label>Nama {mag ? 'majalah' : 'koran'}</label><input type="text" value={data.masthead.name} onChange={e => update(d => { d.masthead.name = e.target.value; })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="field"><label>Nomor edisi</label><input type="text" value={data.masthead.number ?? ''} onChange={e => update(d => { d.masthead.number = e.target.value; })} /></div>
              <div className="field"><label>Tanggal</label><input type="date" value={data.masthead.date} onChange={e => update(d => { d.masthead.date = e.target.value; })} /></div>
            </div>
            <div className="field"><label>Semboyan</label><input type="text" value={data.masthead.tagline ?? ''} onChange={e => update(d => { d.masthead.tagline = e.target.value; })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="field"><label>Kota</label><input type="text" value={data.masthead.city ?? ''} onChange={e => update(d => { d.masthead.city = e.target.value; })} /></div>
              <div className="field"><label>Harga</label><input type="text" value={data.masthead.price ?? ''} onChange={e => update(d => { d.masthead.price = e.target.value; })} /></div>
            </div>
            {!mag && <div className="field"><label>Keterangan kop</label><input type="text" value={data.masthead.motto ?? ''} onChange={e => update(d => { d.masthead.motto = e.target.value; })} placeholder="Terbit sejak 1962" /></div>}
            {mag && <div className="field"><label>Teaser sampul (satu per baris)</label><textarea style={{ minHeight: 70, fontFamily: 'inherit' }} value={(data.masthead.coverLines ?? []).join('\n')} onChange={e => update(d => { d.masthead.coverLines = e.target.value.split('\n').map(s => s.trim()).filter(Boolean); })} /></div>}
            <div className="grid grid-cols-2 gap-2">
              <div className="field"><label>Gaya kop</label><select value={data.theme.mastheadStyle} onChange={e => update(d => { d.theme.mastheadStyle = e.target.value as EditionData['theme']['mastheadStyle']; })}><option value="black">Gotik klasik</option><option value="serif">Serif tebal</option><option value="caps">Kapital berjarak</option></select></div>
              <div className="field"><label>Kertas</label><select value={data.theme.tone} onChange={e => update(d => { d.theme.tone = e.target.value as EditionData['theme']['tone']; })}><option value="ivory">Gading hangat</option><option value="aged">Kertas tua</option><option value="sepia">Sepia</option><option value="bright">Putih tulang</option></select></div>
            </div>
            <div className="field"><label>Warna aksen</label>
              <div className="flex gap-1.5 flex-wrap items-center">
                {['#8b1e1e', '#1f3a5f', '#2f5a30', '#6b4a1f', '#1a1612', '#7a2a6b', '#b8641e', '#c0472b', '#111111'].map(c => <button key={c} className={'swatch' + (data.theme.accent === c ? ' on' : '')} style={{ background: c }} onClick={() => update(d => { d.theme.accent = c; })} />)}
                <input type="color" value={data.theme.accent} onChange={e => update(d => { d.theme.accent = e.target.value; })} className="w-5 h-5 bg-transparent border-0 p-0" />
              </div>
            </div>
          </section>

          <section className="sect">
            <h4><span className="whitespace-nowrap">Halaman ({data.pages.length})</span>
              <select className="input" style={{ width: 'auto', maxWidth: 120, padding: '.2rem .4rem', fontSize: '.7rem', textTransform: 'none', letterSpacing: 0, flexShrink: 0 }} value="" onChange={e => { if (e.target.value) addPage(e.target.value); }}>
                <option value="">+ Tambah…</option>
                {presets.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </h4>
            <div className="space-y-1">
              {data.pages.map((p, i) => (
                <div key={p.id} className={'item' + (i === sel.page ? ' on' : '')} onClick={() => setSel({ page: i, block: null })}>
                  <span className="tag">{i + 1}</span><span className="t">{p.section || '—'}</span>
                  <span className="mini">
                    <button title="Naik" onClick={e => { e.stopPropagation(); movePage(i, -1); }}>↑</button>
                    <button title="Turun" onClick={e => { e.stopPropagation(); movePage(i, 1); }}>↓</button>
                    <button title="Hapus" onClick={e => { e.stopPropagation(); removePage(i); }}>✕</button>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="sect">
            <h4>Blok — {page.section}</h4>
            <div className="field"><label>Nama rubrik halaman</label><input type="text" value={page.section} onChange={e => updatePage(p => { p.section = e.target.value; })} /></div>
            {mag && <label className="flex items-center gap-2 text-xs mb-2"><input type="checkbox" checked={!!page.dark} onChange={e => updatePage(p => { p.dark = e.target.checked; })} className="accent-[var(--gold)]" /> Halaman gelap</label>}
            <div className="grid grid-cols-3 gap-1 mb-3">
              {blockTypes.map(t => <button key={t} className="btn sm" title={BLOCK_TYPES[t].hint} onClick={() => addBlock(t)}>+ {BLOCK_TYPES[t].label}</button>)}
            </div>
            <BlockList page={page} sel={sel.block} overflow={overflow} articles={articleMap} onSelect={i => setSel({ page: sel.page, block: i })} onMove={moveBlock} onReorder={reorderBlock} />
            <div className="flex gap-3 text-[11px] text-[var(--muted)] mt-2"><span>{page.blocks.length} blok</span><span>Isi grid {cells}/144</span><span>{words(page.blocks.map(b => (b.articleId ? articleMap[b.articleId]?.body : b.body) ?? '').join(' '))} kata</span></div>
            {cells > 144 && <div className="warnbox">Total ukuran blok melebihi kapasitas halaman (12×12). Blok yang tidak muat akan terpotong.</div>}
          </section>
        </aside>

        {/* ---------- kanvas ---------- */}
        <div ref={canvasRef} className="relative overflow-auto flex items-start justify-center p-7 bg-[radial-gradient(ellipse_at_50%_0%,#2b2520_0%,#15120f_70%)]">
          <div ref={pgWrapRef} className="relative shrink-0 shadow-[0_20px_60px_rgba(0,0,0,.55)]" style={{ transformOrigin: '0 0' }}>
            <div style={{ transformOrigin: '0 0' }}>
              <PageView edition={data} index={sel.page} articles={articleMap} edit selected={sel.block} onBlockClick={bi => setSel({ page: sel.page, block: bi })} className="[transform-origin:0_0]" />
            </div>
          </div>
          <div className="absolute left-4 bottom-3 text-[11px] text-[var(--muted)] bg-[rgba(20,16,13,.7)] px-2 py-1 rounded">Halaman {sel.page + 1} / {data.pages.length} · {page.section}{overflow.length ? ` · ${overflow.length} blok teks meluap` : ''}</div>
        </div>

        {/* ---------- inspektur ---------- */}
        <aside className="overflow-auto bg-[var(--panel)] border-l border-[var(--line)]">
          {!block ? (
            <div className="p-6 text-center text-sm text-[var(--muted)] leading-relaxed"><div className="font-display text-lg text-[var(--text)] mb-2">Inspektur blok</div>Pilih blok pada halaman atau pada daftar di kiri untuk menyunting isi, ukuran, dan gambar.</div>
          ) : (
            <Inspector block={block} sel={sel} data={data} pub={pub} overflow={overflow.includes(sel.block!)} readyArticles={readyArticles} articleMap={articleMap}
              setB={setB} onDelete={removeBlock} onDuplicate={duplicateBlock} onMoveToPage={moveBlockToPage} onLink={linkArticle} onUnlink={unlinkArticle}
              pickImage={cb => setPicker(() => cb)} />
          )}
        </aside>
      </div>

      {picker && <MediaPicker pub={pub} onClose={() => setPicker(null)} onPick={m => { picker(m); setPicker(null); }} />}
      {publishOpen && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setPublishOpen(false); }}>
          <div className="modal" style={{ width: 'min(520px,100%)' }}>
            <header className="px-5 py-3 border-b border-[var(--line)]"><h3 className="font-display text-lg">{status === 'published' ? 'Terbitkan ulang edisi' : 'Terbitkan edisi'}</h3></header>
            <div className="p-5 text-sm space-y-4">
              <p className="text-[var(--muted)]">{data.masthead.number} · {data.pages.length} halaman · {data.pages.reduce((a, p) => a + p.blocks.filter(b => b.articleId).length, 0)} blok tertaut ke naskah. Isi naskah akan dibekukan ke dalam edisi; naskah yang tertaut otomatis berstatus “Terbit”.</p>
              <div>
                <div className="text-[10px] tracking-[.2em] uppercase text-[var(--muted)] mb-2">Akses pembaca</div>
                <label className="flex items-start gap-2 mb-2"><input type="radio" name="acc" checked={access === 'free'} onChange={() => setAccess('free')} className="mt-1 accent-[var(--gold)]" /><span><b>Gratis</b> — siapa pun dapat membuka edisi ini.</span></label>
                <label className="flex items-start gap-2"><input type="radio" name="acc" checked={access === 'subscribers'} onChange={() => setAccess('subscribers')} className="mt-1 accent-[var(--gold)]" /><span><b>Pelanggan</b> — sampul & daftar terlihat publik, isinya hanya untuk pelanggan aktif.</span></label>
              </div>
              {overflowTotal(data, articleMap) > 0 && <div className="warnbox">Ada blok yang teksnya meluap pada halaman saat ini. Pembaca tetap bisa membaca utuh lewat Mode Baca — tetapi periksa kembali tata letaknya.</div>}
            </div>
            <footer className="flex gap-2 justify-end px-5 py-3 border-t border-[var(--line)]">
              <button className="btn" onClick={() => setPublishOpen(false)}>Batal</button>
              <button className="btn gold" disabled={busy} onClick={publish}>{busy ? 'Menerbitkan…' : 'Ya, terbitkan'}</button>
            </footer>
          </div>
        </div>
      )}
      <Toast t={toast} />
      <form action={deleteEdition.bind(null, edition.id, pub.slug)} id="del-edition" className="hidden" />
    </div>
  );

  function overflowTotal(_d: EditionData, _m: ArticleMap) { return overflow.length; }
}

/* ============================================================ */
function BlockList({ page, sel, overflow, articles, onSelect, onMove, onReorder }: { page: Page; sel: number | null; overflow: number[]; articles: ArticleMap; onSelect: (i: number) => void; onMove: (i: number, d: -1 | 1) => void; onReorder: (from: number, to: number) => void }) {
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  return (
    <div className="space-y-1">
      {page.blocks.map((b, i) => {
        const a = b.articleId ? articles[b.articleId] : null;
        const label = a?.title || b.title || b.body || b.cap || '(kosong)';
        return (
          <div key={b.id} className={'item' + (i === sel ? ' on' : '') + (drag === i ? ' dragging' : '') + (over === i ? ' dropover' : '')} draggable
            onClick={() => onSelect(i)}
            onDragStart={e => { setDrag(i); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => { setDrag(null); setOver(null); }}
            onDragOver={e => { e.preventDefault(); setOver(i); }} onDragLeave={() => setOver(null)}
            onDrop={e => { e.preventDefault(); if (drag != null) onReorder(drag, i); setDrag(null); setOver(null); }}>
            <span className="text-[#5c534b] cursor-grab">⋮⋮</span>
            <span className="tag">{BLOCK_TYPES[b.type].label.split(' ')[0]}</span>
            <span className="t" title={label}>{a ? '⟲ ' : ''}{label}</span>
            <span className="tag">{b.w}×{b.h}</span>
            {overflow.includes(i) && <span className="tag warn" title="Teks tidak muat">!</span>}
            <span className="mini"><button onClick={e => { e.stopPropagation(); onMove(i, -1); }}>↑</button><button onClick={e => { e.stopPropagation(); onMove(i, 1); }}>↓</button></span>
          </div>
        );
      })}
      {page.blocks.length === 0 && <div className="text-xs text-[var(--muted)] py-2">Belum ada blok — tambahkan dari tombol di atas.</div>}
    </div>
  );
}

/* ============================================================ */
interface InspectorProps {
  block: Block; sel: Sel; data: EditionData; pub: Publication; overflow: boolean; readyArticles: Article[]; articleMap: ArticleMap;
  setB: <K extends keyof Block>(k: K, v: Block[K]) => void; onDelete: () => void; onDuplicate: () => void; onMoveToPage: (to: number) => void;
  onLink: (id: string) => void; onUnlink: () => void; pickImage: (cb: (m: { url: string; path?: string | null }) => void) => void;
}
function Inspector({ block: b, sel, data, pub, overflow, readyArticles, articleMap, setB, onDelete, onDuplicate, onMoveToPage, onLink, onUnlink, pickImage }: InspectorProps) {
  const [q, setQ] = useState('');
  const linked = b.articleId ? articleMap[b.articleId] : null;
  const textual = ['lead', 'article', 'brief', 'text', 'feature', 'cover'].includes(b.type);
  const linkable = ['lead', 'article', 'brief', 'text', 'feature'].includes(b.type);
  const hasImage = ['lead', 'article', 'brief', 'text', 'image', 'ad', 'cover', 'feature'].includes(b.type);
  const mag = pub.type === 'magazine';
  const blockTypes = (Object.keys(BLOCK_TYPES) as BlockType[]).filter(t => BLOCK_TYPES[t].kinds.includes(pub.type));
  const list = readyArticles.filter(a => !q || a.title.toLowerCase().includes(q.toLowerCase()) || (a.byline ?? '').toLowerCase().includes(q.toLowerCase())).slice(0, 40);
  const Range = ({ k, min, max }: { k: 'w' | 'h'; min: number; max: number }) => (
    <div className="flex items-center gap-2"><input type="range" min={min} max={max} value={b[k]} onChange={e => setB(k, Number(e.target.value))} className="flex-1 accent-[var(--gold)]" /><span className="w-5 text-right text-xs text-[var(--muted)]">{b[k]}</span></div>
  );
  const ro = !!linked;

  return (
    <>
      <section className="sect">
        <h4>{BLOCK_TYPES[b.type].label}
          <span className="mini">
            <button title="Gandakan" onClick={onDuplicate}>⧉</button>
            <select title="Pindah ke halaman" className="bg-transparent text-[var(--muted)] text-xs" value="" onChange={e => { if (e.target.value !== '') onMoveToPage(Number(e.target.value)); }}>
              <option value="">⇢</option>{data.pages.map((p, i) => i !== sel.page && <option key={p.id} value={i}>Hal. {i + 1} · {p.section}</option>)}
            </select>
            <button title="Hapus blok" onClick={onDelete}>✕</button>
          </span>
        </h4>
        <div className="field"><label>Jenis blok</label><select value={b.type} onChange={e => setB('type', e.target.value as BlockType)}>{blockTypes.map(t => <option key={t} value={t}>{BLOCK_TYPES[t].label}</option>)}</select></div>
        <div className="grid grid-cols-2 gap-2"><div className="field"><label>Lebar (kolom)</label><Range k="w" min={1} max={12} /></div><div className="field"><label>Tinggi (baris)</label><Range k="h" min={1} max={12} /></div></div>
        {textual && b.type !== 'cover' && b.type !== 'feature' && <div className="grid grid-cols-2 gap-2">
          <div className="field"><label>Ukuran huruf</label><select value={b.scale ?? 'm'} onChange={e => setB('scale', e.target.value as Block['scale'])}><option value="s">Kecil</option><option value="m">Normal</option><option value="l">Besar</option></select></div>
          <div className="field"><label>Kolom teks</label><select value={b.cols ?? 1} onChange={e => setB('cols', Number(e.target.value))}>{[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} kolom</option>)}</select></div>
        </div>}
        {overflow && <div className="warnbox">Teks tidak muat dalam blok ini. Perbesar blok, tambah kolom teks, kecilkan huruf, atau persingkat naskah. Pembaca tetap bisa membaca utuh lewat Mode Baca.</div>}
      </section>

      {linkable && (
        <section className="sect">
          <h4>Naskah tertaut</h4>
          {linked ? (
            <div className="text-xs">
              <div className="font-medium text-sm">{linked.title}</div>
              <div className="text-[var(--muted)] mt-0.5">{linked.byline || '—'} · {words(linked.body)} kata · <span className="badge">{ARTICLE_STATUS_LABEL[(linked as Article).status ?? 'draft']}</span></div>
              <div className="flex gap-2 mt-2"><Link href={`/p/${pub.slug}/naskah/${linked.id}`} className="btn sm">Buka naskah</Link><button className="btn sm" onClick={onUnlink}>Lepas tautan</button></div>
              <div className="text-[var(--muted)] mt-2">Isi blok mengikuti naskah ini. Suntingan dilakukan di halaman naskah; blok hanya mengatur tata letak.</div>
            </div>
          ) : (
            <>
              <input className="input mb-2" placeholder="Cari naskah (judul / byline)…" value={q} onChange={e => setQ(e.target.value)} />
              <div className="max-h-48 overflow-auto space-y-1">
                {list.map(a => <button key={a.id} className="item w-full text-left" onClick={() => onLink(a.id)}><span className="t">{a.title}</span><span className="tag">{ARTICLE_STATUS_LABEL[a.status].split(' ')[0]}</span></button>)}
                {list.length === 0 && <div className="text-xs text-[var(--muted)] py-2">Tidak ada naskah berstatus Menunggu/Siap/Terbit. Isi blok bisa diketik langsung di bawah.</div>}
              </div>
            </>
          )}
        </section>
      )}

      {textual && (
        <section className="sect">
          <h4>Isi {ro && <span className="normal-case tracking-normal text-[var(--muted)]">(dari naskah)</span>}</h4>
          <div className="field"><label>Rubrik / kicker</label><input type="text" value={(ro ? linked?.kicker : b.kicker) ?? ''} readOnly={ro} onChange={e => setB('kicker', e.target.value)} /></div>
          <div className="field"><label>Judul</label><textarea style={{ minHeight: 56, fontFamily: 'Playfair Display, serif', fontWeight: 700, fontSize: '.95rem' }} value={(ro ? linked?.title : b.title) ?? ''} readOnly={ro} onChange={e => setB('title', e.target.value)} /></div>
          {b.type !== 'brief' && <div className="field"><label>Sub-judul (deck)</label><textarea style={{ minHeight: 48, fontStyle: 'italic' }} value={(ro ? linked?.deck : b.deck) ?? ''} readOnly={ro} onChange={e => setB('deck', e.target.value)} /></div>}
          {b.type !== 'cover' && <div className="field"><label>Byline</label><input type="text" value={(ro ? linked?.byline : b.byline) ?? ''} readOnly={ro} onChange={e => setB('byline', e.target.value)} /></div>}
          {b.type !== 'cover' && b.type !== 'feature' && <div className="field"><label>Isi <span className="normal-case tracking-normal text-[var(--muted)]">— {words(ro ? linked?.body : b.body)} kata</span></label><textarea style={{ minHeight: 200 }} value={(ro ? linked?.body : b.body) ?? ''} readOnly={ro} onChange={e => setB('body', e.target.value)} /></div>}
          {b.type !== 'cover' && b.type !== 'feature' && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!b.dropcap} onChange={e => setB('dropcap', e.target.checked)} className="accent-[var(--gold)]" /> Huruf awal besar (drop cap)</label>}
          {(b.type === 'cover' || b.type === 'feature') && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!b.invert} onChange={e => setB('invert', e.target.checked)} className="accent-[var(--gold)]" /> Teks putih di atas foto (foto gelap)</label>}
        </section>
      )}

      {b.type === 'quote' && (
        <section className="sect"><h4>Kutipan</h4>
          <div className="field"><label>Teks kutipan</label><textarea style={{ minHeight: 80, fontStyle: 'italic' }} value={b.body ?? ''} onChange={e => setB('body', e.target.value)} /></div>
          <div className="field"><label>Sumber</label><input type="text" value={b.byline ?? ''} onChange={e => setB('byline', e.target.value)} placeholder="Nama, jabatan" /></div>
        </section>
      )}
      {b.type === 'ad' && (
        <section className="sect"><h4>Materi iklan</h4>
          <div className="field"><label>Nama pengiklan / judul</label><input type="text" value={b.title ?? ''} onChange={e => setB('title', e.target.value)} /></div>
          <div className="field"><label>Teks iklan</label><textarea style={{ minHeight: 70 }} value={b.body ?? ''} onChange={e => setB('body', e.target.value)} /></div>
          <div className="field"><label>Kontak / alamat</label><input type="text" value={b.byline ?? ''} onChange={e => setB('byline', e.target.value)} /></div>
        </section>
      )}
      {b.type === 'toc' && <section className="sect"><h4>Daftar isi</h4><div className="field"><label>Judul</label><input type="text" value={b.title ?? ''} onChange={e => setB('title', e.target.value)} placeholder="Isi" /></div><div className="text-xs text-[var(--muted)]">Daftar dibuat otomatis dari judul blok pertama tiap halaman.</div></section>}
      {b.type === 'image' && <section className="sect"><h4>Keterangan</h4><div className="field"><label>Judul foto</label><input type="text" value={b.title ?? ''} onChange={e => setB('title', e.target.value)} /></div></section>}

      {hasImage && (
        <section className="sect">
          <h4>{b.type === 'cover' || b.type === 'feature' ? 'Foto latar' : 'Gambar'}</h4>
          {(ro && linked?.cover_url) ? (
            <div className="text-xs text-[var(--muted)]"><img src={imgSrc(linked.cover_url, mag) ?? undefined} alt="" className="w-full rounded mb-2" />Foto mengikuti naskah tertaut.</div>
          ) : (
            <>
              {b.img?.url ? <img src={imgSrc(b.img.url, mag) ?? undefined} alt="" className="w-full rounded border border-[var(--line)] mb-2" /> : <div className="rounded border border-dashed border-[var(--line)] h-20 flex items-center justify-center text-xs text-[var(--muted)] mb-2">Belum ada gambar</div>}
              <div className="flex gap-2 mb-2"><button className="btn sm" onClick={() => pickImage(m => setB('img', { url: m.url, path: m.path ?? null }))}>Pilih / unggah</button>{b.img && <button className="btn sm" onClick={() => setB('img', null)}>Lepas</button>}</div>
            </>
          )}
          {!['ad', 'cover', 'feature'].includes(b.type) && <div className="field"><label>Keterangan foto</label><textarea style={{ minHeight: 44, fontFamily: 'inherit' }} value={(ro ? linked?.cover_caption : b.cap) ?? ''} readOnly={ro} onChange={e => setB('cap', e.target.value)} /></div>}
          {['lead', 'article', 'brief', 'text'].includes(b.type) && <div className="field"><label>Tinggi foto</label><select value={b.imgH ?? 'm'} onChange={e => setB('imgH', e.target.value as Block['imgH'])}><option value="s">Kecil</option><option value="m">Sedang</option><option value="l">Besar</option></select></div>}
        </section>
      )}

      {b.type === 'gallery' && (
        <section className="sect"><h4>Galeri (maks 4)</h4>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {(b.images ?? []).map((im, i) => (
              <div key={i} className="relative group"><img src={imgSrc(im.url, mag) ?? undefined} alt="" className="w-full aspect-[4/3] object-cover rounded border border-[var(--line)]" /><button className="btn sm absolute top-1 right-1 opacity-0 group-hover:opacity-100" onClick={() => setB('images', (b.images ?? []).filter((_, j) => j !== i))}>✕</button></div>
            ))}
          </div>
          {(b.images ?? []).length < 4 && <button className="btn sm" onClick={() => pickImage(m => setB('images', [...(b.images ?? []), { url: m.url, path: m.path ?? null }]))}>+ Tambah foto</button>}
          <div className="field mt-2"><label>Keterangan galeri</label><textarea style={{ minHeight: 44, fontFamily: 'inherit' }} value={b.cap ?? ''} onChange={e => setB('cap', e.target.value)} /></div>
        </section>
      )}
      {mag && <section className="sect text-[11px] text-[var(--muted)] leading-relaxed">Tip majalah: gunakan <b>Feature</b> 12×12 sebagai pembuka rubrik, lalu <b>Teks Majalah</b> 7×12 + <b>Foto</b> 5×7 + <b>Kutipan</b> 5×5 untuk halaman isi. Halaman gelap cocok untuk rubrik dapur atau potret.</section>}
    </>
  );
}
