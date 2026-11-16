'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@press/db/browser';
import { ARTICLE_STATUS_LABEL, type Article, type Edition, type EditionAccess, type EditionStatus, type Publication } from '@press/db';
import {
  BLOCK_TYPES, PAGE_PRESETS, PageView, markOverflow, newBlock, newPage, normalizeEdition, freezeEdition, words, uid, imgSrc, autoPlace, firstFreeSpot, pagePlaced,
  DEFAULT_MOTION, MOTION_FILTER_LABEL, posterOf, type BlockImage, type MotionFilter, type MotionPlay,
  type ArticleMap, type Block, type BlockType, type EditionData, type Page,
} from '@press/ui';
import { BlockPalette, CanvasOverlay, IMAGE_TYPES, PhotoDrawer, StageRail, type Rect } from './LegoParts';
import { MediaPicker } from './MediaPicker';
import { MotionPanel } from './LivePanel';
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
  const [tab, setTab] = useState<'lembar' | 'tambah' | 'foto' | 'edisi'>('lembar');
  const [liveIntent, setLiveIntent] = useState(0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const pgWrapRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  const articleMap: ArticleMap = useMemo(() => Object.fromEntries(articles.map(a => [a.id, a])), [articles]);
  const mag = pub.type === 'magazine';
  const mo = { ...DEFAULT_MOTION, ...(data.motion ?? {}) };

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
  const lastLocked = data.pages.reduce((a, p, i) => (p.locked ? i : a), -1);
  const addPage = (presetId: string) => {
    const pr = PAGE_PRESETS.find(p => p.id === presetId); const np = pr ? pr.make() : newPage();
    np.stage = np.stage ?? 'free'; np.locked = false; np.blocks = autoPlace(np.blocks);
    const at = Math.max(sel.page, lastLocked) + 1;
    update(d => { d.pages.splice(at, 0, np); }); setSel({ page: at, block: null });
  };
  const movePage = (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= data.pages.length) return; if (data.pages[i].locked || data.pages[j].locked) { toast.show('Lembar inti templat tidak bisa dipindah', true); return; } update(d => { [d.pages[i], d.pages[j]] = [d.pages[j], d.pages[i]]; }); setSel({ page: j, block: null }); };
  const removePage = (i: number) => { if (data.pages[i]?.locked) { toast.show('Lembar inti templat tidak bisa dihapus — kosongkan isinya saja bila perlu', true); return; } if (data.pages.length <= 1) { toast.show('Minimal satu halaman', true); return; } if (!confirm(`Hapus halaman "${data.pages[i].section}" (${data.pages[i].blocks.length} blok)?`)) return; update(d => { d.pages.splice(i, 1); }); setSel({ page: clampN(i, 0, data.pages.length - 2), block: null }); };
  const addBlock = (t: BlockType, cell?: { x: number; y: number }, img?: BlockImage) => {
    const b = newBlock(t, pub.type);
    const w = Math.min(b.w, 12), h = Math.min(b.h, 12);
    if (img) b.img = { url: img.url, path: img.path ?? null, ...(img.motion ? { motion: img.motion } : {}) };
    updatePage(p => {
      p.blocks = autoPlace(p.blocks);
      const pos = cell ? { x: clampN(cell.x, 0, 12 - w), y: clampN(cell.y, 0, 12 - h) } : firstFreeSpot(p.blocks, w, h);
      p.blocks.push({ ...b, w, h, ...pos });
    });
    setSel({ page: sel.page, block: page.blocks.length });
  };
  /* ---------- mode Lego (majalah) ---------- */
  const setRect = (bi: number, r: Rect) => updatePage(p => { p.blocks = autoPlace(p.blocks); Object.assign(p.blocks[bi], r); });
  const nudge = (dx: number, dy: number, resize: boolean) => {
    if (sel.block == null) return;
    updatePage(p => {
      p.blocks = autoPlace(p.blocks); const b = p.blocks[sel.block!]; if (!b) return;
      if (resize) { b.w = clampN(b.w + dx, 1, 12 - (b.x ?? 0)); b.h = clampN(b.h + dy, 1, 12 - (b.y ?? 0)); }
      else { b.x = clampN((b.x ?? 0) + dx, 0, 12 - b.w); b.y = clampN((b.y ?? 0) + dy, 0, 12 - b.h); }
    });
  };
  const restack = (front: boolean) => {
    if (sel.block == null) return; const i = sel.block;
    updatePage(p => { p.blocks = autoPlace(p.blocks); const [m] = p.blocks.splice(i, 1); if (front) p.blocks.push(m); else p.blocks.unshift(m); });
    setSel({ page: sel.page, block: front ? page.blocks.length - 1 : 0 });
  };
  const putImage = (bi: number, m: BlockImage) => updatePage(p => {
    const b = p.blocks[bi]; if (!b) return;
    const im: BlockImage = { url: m.url, path: m.path ?? null, ...(m.motion ? { motion: m.motion } : {}) };
    if (b.type === 'gallery') b.images = [...(b.images ?? []), im].slice(-4);
    else b.img = im;
  });
  const dropMedia = (m: BlockImage, cell: { x: number; y: number } | null, target: number | null) => {
    if (target != null && IMAGE_TYPES.includes(page.blocks[target]?.type)) { putImage(target, m); setSel({ page: sel.page, block: target }); toast.show(m.motion ? 'Foto hidup dipasang ✦' : 'Foto dipasang ✨'); return; }
    addBlock('image', cell ?? undefined, m);
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.closest('input, textarea, select, [contenteditable="true"]'))) return;
      if (sel.block == null) return;
      const k = e.key;
      if (k === 'Escape') { setSel({ page: sel.page, block: null }); return; }
      if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); removeBlock(); return; }
      if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'd') { e.preventDefault(); duplicateBlock(); return; }
      const d = k === 'ArrowLeft' ? [-1, 0] : k === 'ArrowRight' ? [1, 0] : k === 'ArrowUp' ? [0, -1] : k === 'ArrowDown' ? [0, 1] : null;
      if (d) { e.preventDefault(); nudge(d[0], d[1], e.shiftKey); }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  });
  const moveBlock = (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= page.blocks.length) return; updatePage(p => { [p.blocks[i], p.blocks[j]] = [p.blocks[j], p.blocks[i]]; }); setSel({ page: sel.page, block: j }); };
  const reorderBlock = (from: number, to: number) => { if (from === to) return; updatePage(p => { const [m] = p.blocks.splice(from, 1); p.blocks.splice(to, 0, m); }); setSel({ page: sel.page, block: to }); };
  const removeBlock = () => { if (sel.block == null) return; updatePage(p => { p.blocks.splice(sel.block!, 1); }); setSel({ page: sel.page, block: null }); };
  const duplicateBlock = () => {
    if (!block) return; const c = { ...JSON.parse(JSON.stringify(block)), id: uid() } as Block;
    { updatePage(p => { p.blocks = autoPlace(p.blocks); const src = p.blocks[sel.block!]; c.x = clampN((src.x ?? 0) + 1, 0, 12 - c.w); c.y = clampN((src.y ?? 0) + 1, 0, 12 - c.h); p.blocks.push(c); }); setSel({ page: sel.page, block: page.blocks.length }); return; }
  };
  const moveBlockToPage = (to: number) => {
    if (!block) return; const b = { ...block };
    update(d => {
      d.pages[sel.page].blocks.splice(sel.block!, 1);
      { const tp = d.pages[to]; tp.blocks = autoPlace(tp.blocks); Object.assign(b, firstFreeSpot(tp.blocks, b.w, b.h)); }
      d.pages[to].blocks.push(b);
    });
    setSel({ page: to, block: data.pages[to].blocks.length });
  };
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
      <header className="ed-head h-12 flex items-center gap-2 px-4 border-b border-[var(--line)] bg-[linear-gradient(#1d1915,#17130f)] shrink-0 z-20">
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
        <aside className="ed-left overflow-hidden bg-[var(--panel)] border-r border-[var(--line)] flex flex-col min-h-0">
            <nav className="ed-tabs" role="tablist">
              {([['lembar', '📄 Lembar'], ['tambah', '🧱 Keping'], ['foto', '🖼 Foto'], ['edisi', '⚙ Edisi']] as const).map(([k, l]) => (
                <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
              ))}
            </nav>
            <div className="flex-1 min-h-0 overflow-auto">
              {tab === 'lembar' && <>
                <StageRail data={data} kind={pub.type} current={sel.page} onSelect={i => setSel({ page: i, block: null })} onMove={movePage} onRemove={removePage} onAdd={addPage} />
                <section className="sect border-t border-[var(--line)]">
                  <h4>Lembar ini</h4>
                  <div className="field"><label>Nama rubrik</label><input type="text" value={page.section} onChange={e => updatePage(p => { p.section = e.target.value; })} /></div>
                  {mag && <label className="flex items-center gap-2 text-xs mb-2"><input type="checkbox" checked={!!page.dark} onChange={e => updatePage(p => { p.dark = e.target.checked; })} className="accent-[var(--gold)]" /> Halaman gelap</label>}
                  {mag && <div className="field"><label>Latar halaman</label>
                    <div className="flex gap-2 mb-2"><button className="btn sm" onClick={() => setPicker(() => (m: { url: string; path?: string | null }) => updatePage(p => { p.bg = { ...(p.bg ?? {}), url: m.url, path: m.path ?? null }; }))}>{page.bg ? 'Ganti foto latar' : 'Pilih foto latar'}</button>{page.bg && <button className="btn sm" onClick={() => updatePage(p => { p.bg = null; })}>Lepas</button>}</div>
                    <MotionPanel pub={pub} title="Latar hidup" image={page.bg} onChange={im => updatePage(p => { p.bg = im; })} />
                  </div>}
                  <div className="flex gap-3 text-[11px] text-[var(--muted)] mt-2"><span>{page.blocks.length} blok</span><span>{words(page.blocks.map(b => (b.articleId ? articleMap[b.articleId]?.body : b.body) ?? '').join(' '))} kata</span></div>
                  {cells > 144 && !pagePlaced(page) && <div className="warnbox mt-2">Total ukuran blok melebihi kapasitas halaman (12×12). Seret blok untuk mengatur ulang.</div>}
                </section>
              </>}
              {tab === 'tambah' && <BlockPalette types={blockTypes} onAdd={t => addBlock(t)} onAddLive={() => { addBlock('image'); setLiveIntent(x => x + 1); }} />}
              {tab === 'foto' && <PhotoDrawer pub={pub} onUse={m => { if (sel.block != null && IMAGE_TYPES.includes(page.blocks[sel.block]?.type)) { putImage(sel.block, m); toast.show(m.motion ? 'Foto hidup dipasang ✦' : 'Foto dipasang ✨'); } else addBlock('image', undefined, m); }} />}
              {tab === 'edisi' && <>
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
                  <div className="field"><label>Gaya kop</label><select value={data.theme.mastheadStyle} onChange={e => update(d => { d.theme.mastheadStyle = e.target.value as EditionData['theme']['mastheadStyle']; })}><option value="black">Gotik klasik</option><option value="serif">Serif tebal</option><option value="caps">Kapital berjarak</option><option value="modern">Modern</option></select></div>
                  <div className="field"><label>Kertas</label><select value={data.theme.tone} onChange={e => update(d => { d.theme.tone = e.target.value as EditionData['theme']['tone']; })}><option value="ivory">Gading hangat</option><option value="aged">Kertas tua</option><option value="sepia">Sepia</option><option value="bright">Putih tulang</option></select></div>
                </div>
                <div className="field"><label>Warna aksen</label>
                  <div className="flex gap-1.5 flex-wrap items-center">
                    {(mag ? ['#ff3ea5', '#7c5cff', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#111111', '#1f3a5f'] : ['#8b1e1e', '#1f3a5f', '#2f5a30', '#6b4a1f', '#1a1612', '#7a2a6b', '#b8641e', '#c0472b', '#111111']).map(c => <button key={c} className={'swatch' + (data.theme.accent === c ? ' on' : '')} style={{ background: c }} onClick={() => update(d => { d.theme.accent = c; })} />)}
                    <input type="color" value={data.theme.accent} onChange={e => update(d => { d.theme.accent = e.target.value; })} className="w-5 h-5 bg-transparent border-0 p-0" />
                  </div>
                </div>
              </section>
                <section className="sect border-t border-[var(--line)]">
                  <h4>✦ Foto hidup edisi ini</h4>
                  <label className="flex items-center gap-2 text-xs mb-2"><input type="checkbox" checked={mo.enabled} onChange={e => update(d => { d.motion = { ...mo, enabled: e.target.checked }; })} className="accent-[var(--gold)]" /> Aktifkan foto hidup di edisi ini</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="field"><label>Putar bawaan</label><select value={mo.play} onChange={e => update(d => { d.motion = { ...mo, play: e.target.value as MotionPlay }; })}><option value="auto">Otomatis berulang</option><option value="tap">Saat diketuk</option></select></div>
                    <div className="field"><label>Filter bawaan</label><select value={mo.filter} onChange={e => update(d => { d.motion = { ...mo, filter: e.target.value as MotionFilter }; })}>{(Object.keys(MOTION_FILTER_LABEL) as MotionFilter[]).map(f => <option key={f} value={f}>{MOTION_FILTER_LABEL[f]}</option>)}</select></div>
                  </div>
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={mo.kiosk} onChange={e => update(d => { d.motion = { ...mo, kiosk: e.target.checked }; })} className="accent-[var(--gold)]" /> Sampul ikut hidup di rak kios</label>
                  <p className="text-[10px] text-[var(--muted)] mt-2 leading-relaxed">Setiap foto bisa dijadikan hidup dari panel kanan (pilih blok → <b>✦ Jadikan foto hidup</b>). Pengaturan per foto mengalahkan bawaan ini.</p>
                </section>
              </>}
            </div>
          </aside>

        {/* ---------- kanvas ---------- */}
        <div ref={canvasRef} className="ed-canvas relative overflow-auto flex items-start justify-center p-7 bg-[radial-gradient(ellipse_at_50%_0%,#2b2520_0%,#15120f_70%)]">
          <div ref={pgWrapRef} className="relative shrink-0 shadow-[0_20px_60px_rgba(0,0,0,.55)]" style={{ transformOrigin: '0 0' }}>
            <div style={{ transformOrigin: '0 0' }}>
              <PageView edition={data} index={sel.page} articles={articleMap} edit live="preview" selected={sel.block} onBlockClick={bi => setSel({ page: sel.page, block: bi })} className="[transform-origin:0_0]" />
            </div>
            {<CanvasOverlay wrapRef={pgWrapRef} page={page} selected={sel.block} version={sel.page}
              onSelect={bi => setSel({ page: sel.page, block: bi })} onChange={setRect}
              onDropBlock={(t, cell) => { if (t === 'live') { addBlock('image', cell); setLiveIntent(x => x + 1); } else addBlock(t, cell); }} onDropMedia={(m, cell, target) => dropMedia(m, cell, target)} />}
          </div>
          <div className="ed-status absolute left-4 bottom-3 text-[11px] text-[var(--muted)] bg-[rgba(20,16,13,.7)] px-2 py-1 rounded">Halaman {sel.page + 1} / {data.pages.length} · {page.section}{overflow.length ? ` · ${overflow.length} blok teks meluap` : ''}</div>
          {<div className="ed-hint absolute right-4 bottom-3 text-[11px]">Seret blok = pindah · tarik sudut = ubah ukuran · ←↑→↓ geser · Shift+panah ukuran · Del hapus · Ctrl+D gandakan</div>}
        </div>

        {/* ---------- inspektur ---------- */}
        <aside className="overflow-auto bg-[var(--panel)] border-l border-[var(--line)]">
          {!block ? (
            <div className="p-6 text-center text-sm text-[var(--muted)] leading-relaxed"><div className="font-display text-lg text-[var(--text)] mb-2">{'Pilih keping'}</div>{'Klik blok di halaman untuk mengedit teks & foto. Seret untuk memindah, tarik sudut kanan-bawah untuk mengubah ukuran. Tambah keping atau foto dari tab di kiri.' }</div>
          ) : (
            <Inspector block={block} sel={sel} data={data} pub={pub} overflow={overflow.includes(sel.block!)} readyArticles={readyArticles} articleMap={articleMap}
              setB={setB} onDelete={removeBlock} onDuplicate={duplicateBlock} onMoveToPage={moveBlockToPage} onLink={linkArticle} onUnlink={unlinkArticle}
              onRestack={restack} liveIntent={liveIntent}
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
  onRestack?: (front: boolean) => void;
  liveIntent?: number;
}
function Inspector({ block: b, sel, data, pub, overflow, readyArticles, articleMap, setB, onDelete, onDuplicate, onMoveToPage, onLink, onUnlink, pickImage, onRestack, liveIntent = 0 }: InspectorProps) {
  const [galIdx, setGalIdx] = useState<number | null>(null);
  const openLive = liveIntent > 0 && b.type === 'image' && !b.img;
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
        {onRestack && <div className="flex gap-2 mb-2"><button className="btn sm flex-1 justify-center" onClick={() => onRestack(true)} title="Taruh di atas keping lain">⬆ Ke depan</button><button className="btn sm flex-1 justify-center" onClick={() => onRestack(false)} title="Taruh di bawah keping lain">⬇ Ke belakang</button></div>}
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
              {posterOf(b.img) ? <img src={imgSrc(posterOf(b.img), mag) ?? undefined} alt="" className="w-full rounded border border-[var(--line)] mb-2" /> : <div className="rounded border border-dashed border-[var(--line)] h-20 flex items-center justify-center text-xs text-[var(--muted)] mb-2">Belum ada gambar</div>}
              <div className="flex gap-2 mb-2"><button className="btn sm" onClick={() => pickImage(m => setB('img', { ...(b.img ?? {}), url: m.url, path: m.path ?? null }))}>{b.img?.motion ? 'Ganti gambar diam' : 'Pilih / unggah'}</button>{b.img && <button className="btn sm" onClick={() => setB('img', null)}>Lepas</button>}</div>
              <MotionPanel key={b.id + ':' + liveIntent} pub={pub} image={b.img} onChange={im => setB('img', im)} open={openLive} />
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
              <div key={i} className={'relative group rounded' + (galIdx === i ? ' ring-2 ring-[var(--gold)]' : '')}><img src={imgSrc(posterOf(im), mag) ?? undefined} alt="" className="w-full aspect-[4/3] object-cover rounded border border-[var(--line)]" />{im.motion && <span className="vbadge">✦</span>}<button className="btn sm absolute top-1 right-1 opacity-0 group-hover:opacity-100" onClick={() => { setB('images', (b.images ?? []).filter((_, j) => j !== i)); setGalIdx(null); }}>✕</button><button className="btn sm absolute bottom-1 right-1 opacity-0 group-hover:opacity-100" title="Foto hidup" onClick={() => setGalIdx(galIdx === i ? null : i)}>✦</button></div>
            ))}
          </div>
          {galIdx != null && (b.images ?? [])[galIdx] && <MotionPanel key={b.id + ':g' + galIdx} pub={pub} title={`Foto ${galIdx + 1} hidup`} open image={(b.images ?? [])[galIdx]} onChange={im => setB('images', (b.images ?? []).map((x, j) => j === galIdx ? (im ?? { url: '' }) : x))} />}
          {(b.images ?? []).length < 4 && <button className="btn sm" onClick={() => pickImage(m => setB('images', [...(b.images ?? []), { url: m.url, path: m.path ?? null }]))}>+ Tambah foto</button>}
          <div className="field mt-2"><label>Keterangan galeri</label><textarea style={{ minHeight: 44, fontFamily: 'inherit' }} value={b.cap ?? ''} onChange={e => setB('cap', e.target.value)} /></div>
        </section>
      )}
      {mag && <section className="sect text-[11px] text-[var(--muted)] leading-relaxed">Tip majalah: gunakan <b>Feature</b> 12×12 sebagai pembuka rubrik, lalu <b>Teks Majalah</b> 7×12 + <b>Foto</b> 5×7 + <b>Kutipan</b> 5×5 untuk halaman isi. Halaman gelap cocok untuk rubrik dapur atau potret.</section>}
    </>
  );
}
