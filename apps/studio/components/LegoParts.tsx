'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createClient } from '@press/db/browser';
import type { Media, Publication } from '@press/db';
import { BLOCK_TYPES, PAGE_PRESETS, PageThumb, STAGE_LABEL, autoPlace, imgSrc, type Block, type BlockType, type EditionData, type Page } from '@press/ui';
import { uploadMedia } from '@/lib/upload';

export const DT_BLOCK = 'application/x-editoryou-block';
export const DT_MEDIA = 'application/x-editoryou-media';
export type Rect = { x: number; y: number; w: number; h: number };
const clampN = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const IMAGE_TYPES: BlockType[] = ['lead', 'article', 'brief', 'text', 'image', 'ad', 'cover', 'feature', 'gallery'];

/* ============================================================
   Overlay kanvas: seret untuk memindah, tarik sudut untuk
   mengubah ukuran, terima blok & foto yang dijatuhkan.
   ============================================================ */
interface Geo { left: number; top: number; cw: number; ch: number; gx: number; gy: number; pw: number; ph: number }
function measure(wrap: HTMLElement): Geo | null {
  const grid = wrap.querySelector<HTMLElement>('.pg .grid');
  if (!grid || !grid.offsetWidth) return null;
  const wr = wrap.getBoundingClientRect(), gr = grid.getBoundingClientRect();
  const scale = gr.width / grid.offsetWidth || 1;
  const cs = getComputedStyle(grid);
  const gx = (parseFloat(cs.columnGap) || 0) * scale, gy = (parseFloat(cs.rowGap) || 0) * scale;
  const cw = (gr.width - 11 * gx) / 12, ch = (gr.height - 11 * gy) / 12;
  return { left: gr.left - wr.left, top: gr.top - wr.top, cw, ch, gx, gy, pw: cw + gx, ph: ch + gy };
}
const boxStyle = (g: Geo, r: Rect) => ({ left: g.left + r.x * g.pw, top: g.top + r.y * g.ph, width: r.w * g.cw + (r.w - 1) * g.gx, height: r.h * g.ch + (r.h - 1) * g.gy });

export function CanvasOverlay({ wrapRef, page, selected, onSelect, onChange, onDropBlock, onDropMedia, version }: {
  wrapRef: React.RefObject<HTMLDivElement | null>; page: Page; selected: number | null; version: unknown;
  onSelect: (bi: number | null) => void; onChange: (bi: number, r: Rect) => void;
  onDropBlock: (type: BlockType, cell: { x: number; y: number }) => void;
  onDropMedia: (m: { url: string; path?: string | null }, cell: { x: number; y: number }, target: number | null) => void;
}) {
  const [geo, setGeo] = useState<Geo | null>(null);
  const [ghost, setGhost] = useState<(Rect & { bi: number }) | null>(null);
  const [dropCell, setDropCell] = useState<{ x: number; y: number } | null>(null);
  const ghostRef = useRef<(Rect & { bi: number }) | null>(null);
  const drag = useRef<{ bi: number; mode: 'move' | 'resize'; sx: number; sy: number; r: Rect; moved: boolean } | null>(null);
  const rects: Rect[] = autoPlace(page.blocks).map(b => ({ x: b.x ?? 0, y: b.y ?? 0, w: clampN(b.w, 1, 12), h: clampN(b.h, 1, 12) }));

  const remeasure = useCallback(() => { const w = wrapRef.current; if (w) setGeo(prev => { const g = measure(w); return g && JSON.stringify(g) !== JSON.stringify(prev) ? g : prev; }); }, [wrapRef]);
  useLayoutEffect(() => { remeasure(); }, [remeasure, version, page]);
  useEffect(() => {
    const w = wrapRef.current; if (!w) return;
    const ro = new ResizeObserver(remeasure); ro.observe(w);
    window.addEventListener('resize', remeasure);
    return () => { ro.disconnect(); window.removeEventListener('resize', remeasure); };
  }, [wrapRef, remeasure]);

  const cellAt = (clientX: number, clientY: number) => {
    const w = wrapRef.current; if (!w || !geo) return null;
    const wr = w.getBoundingClientRect();
    return { x: clampN(Math.floor((clientX - wr.left - geo.left) / geo.pw), 0, 11), y: clampN(Math.floor((clientY - wr.top - geo.top) / geo.ph), 0, 11) };
  };

  useEffect(() => {
    function move(e: PointerEvent) {
      const d = drag.current; if (!d || !geo) return;
      const dx = Math.round((e.clientX - d.sx) / geo.pw), dy = Math.round((e.clientY - d.sy) / geo.ph);
      if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 3) d.moved = true;
      const r = d.mode === 'move'
        ? { ...d.r, x: clampN(d.r.x + dx, 0, 12 - d.r.w), y: clampN(d.r.y + dy, 0, 12 - d.r.h) }
        : { ...d.r, w: clampN(d.r.w + dx, 1, 12 - d.r.x), h: clampN(d.r.h + dy, 1, 12 - d.r.y) };
      ghostRef.current = { ...r, bi: d.bi }; setGhost(ghostRef.current);
    }
    function up() {
      const d = drag.current, g = ghostRef.current; drag.current = null; ghostRef.current = null; setGhost(null);
      if (d && g && d.moved && (g.x !== d.r.x || g.y !== d.r.y || g.w !== d.r.w || g.h !== d.r.h)) onChange(d.bi, { x: g.x, y: g.y, w: g.w, h: g.h });
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [geo, onChange]);

  const start = (e: React.PointerEvent, bi: number, mode: 'move' | 'resize') => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    onSelect(bi);
    drag.current = { bi, mode, sx: e.clientX, sy: e.clientY, r: rects[bi], moved: false };
  };

  const accepts = (e: React.DragEvent) => e.dataTransfer.types.includes(DT_BLOCK) || e.dataTransfer.types.includes(DT_MEDIA);
  const hitBlock = (cell: { x: number; y: number }) => {
    for (let i = rects.length - 1; i >= 0; i--) { const r = rects[i]; if (cell.x >= r.x && cell.x < r.x + r.w && cell.y >= r.y && cell.y < r.y + r.h) return i; }
    return null;
  };
  const hoverTarget = dropCell ? hitBlock(dropCell) : null;

  if (!geo) return null;
  return (
    <div className="lego-ov" onPointerDown={e => { if (e.target === e.currentTarget) onSelect(null); }}
      onDragOver={e => { if (!accepts(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDropCell(cellAt(e.clientX, e.clientY)); }}
      onDragLeave={e => { if (e.target === e.currentTarget) setDropCell(null); }}
      onDrop={e => {
        e.preventDefault(); const cell = cellAt(e.clientX, e.clientY); setDropCell(null); if (!cell) return;
        const t = e.dataTransfer.getData(DT_BLOCK) as BlockType;
        if (t) { onDropBlock(t, cell); return; }
        const m = e.dataTransfer.getData(DT_MEDIA);
        if (m) { try { onDropMedia(JSON.parse(m), cell, hitBlock(cell)); } catch { /* abaikan */ } }
      }}>
      {dropCell && <div className="lego-cell" style={boxStyle(geo, { ...dropCell, w: 1, h: 1 })} />}
      {rects.map((r, bi) => {
        const b = page.blocks[bi]; if (!b) return null;
        const g = ghost?.bi === bi ? ghost : null;
        const on = selected === bi;
        return (
          <div key={b.id} className={'lego-box' + (on ? ' on' : '') + (g ? ' dragging' : '') + (hoverTarget === bi && IMAGE_TYPES.includes(b.type) ? ' droptarget' : '')}
            style={boxStyle(geo, g ?? r)} onPointerDown={e => start(e, bi, 'move')}
            role="button" aria-label={`${BLOCK_TYPES[b.type].label} ${r.w}×${r.h}`}>
            {(on || g) && <span className="lego-chip">{BLOCK_TYPES[b.type].label} · {(g ?? r).w}×{(g ?? r).h}</span>}
            {on && <span className="lego-handle" onPointerDown={e => start(e, bi, 'resize')} title="Tarik untuk ubah ukuran" />}
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
   Jalur lembar: tahapan inti terkunci + halaman kreatif
   ============================================================ */
export function StageRail({ data, current, onSelect, onMove, onRemove, onAdd }: {
  data: EditionData; current: number; onSelect: (i: number) => void; onMove: (i: number, dir: -1 | 1) => void; onRemove: (i: number) => void; onAdd: (presetId: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const presets = PAGE_PRESETS.filter(p => p.kinds.includes('magazine') && !['mg-cover', 'mg-toc', 'mg-editorial', 'mg-main'].includes(p.id));
  const lastLocked = data.pages.reduce((a, p, i) => (p.locked ? i : a), -1);
  return (
    <div className="p-3">
      <ol className="space-y-1.5">
        {data.pages.map((p, i) => (
          <li key={p.id}>
            <div className={'rail-item' + (i === current ? ' on' : '')} onClick={() => onSelect(i)}>
              <div className="rail-thumb"><PageThumb edition={data} index={i} /></div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold text-[var(--muted)] flex items-center gap-1">{i + 1} · {STAGE_LABEL[p.stage ?? 'free']}{p.locked && <span title="Lembar inti templat — tidak bisa dipindah/dihapus">🔒</span>}</div>
                <div className="text-xs font-semibold truncate">{p.section || '—'}</div>
                <div className="text-[10px] text-[var(--muted)]">{p.blocks.length} blok</div>
              </div>
              {!p.locked && (
                <span className="mini">
                  <button title="Naik" disabled={i - 1 <= lastLocked} onClick={e => { e.stopPropagation(); onMove(i, -1); }}>↑</button>
                  <button title="Turun" disabled={i === data.pages.length - 1} onClick={e => { e.stopPropagation(); onMove(i, 1); }}>↓</button>
                  <button title="Hapus lembar" onClick={e => { e.stopPropagation(); onRemove(i); }}>✕</button>
                </span>
              )}
            </div>
            {i === lastLocked && <div className="text-[10px] font-bold text-[var(--gold)] tracking-wider uppercase mt-3 mb-1 px-1">Halaman kreatif ✨</div>}
          </li>
        ))}
      </ol>
      {!adding ? (
        <button className="btn gold w-full justify-center mt-3" onClick={() => setAdding(true)}>＋ Lembar kreatif</button>
      ) : (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-2"><b className="text-xs">Pilih pola lembar</b><button className="text-xs text-[var(--muted)]" onClick={() => setAdding(false)}>Tutup</button></div>
          <div className="grid grid-cols-2 gap-2">
            {presets.map(pr => <button key={pr.id} className="preset-tile" onClick={() => { onAdd(pr.id); setAdding(false); }}>{pr.label}</button>)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Palet blok (keping Lego) — seret ke halaman atau klik
   ============================================================ */
const ICONS: Partial<Record<BlockType, string>> = { text: '¶', article: '☰', brief: '✦', image: '▣', gallery: '▦', quote: '❝', ad: '★', feature: '◩', cover: '◼', toc: '≡', lead: '◧' };
export function BlockPalette({ types, onAdd }: { types: BlockType[]; onAdd: (t: BlockType) => void }) {
  return (
    <div className="p-3">
      <p className="text-[11px] text-[var(--muted)] mb-3 leading-relaxed">Seret keping ke halaman, atau klik untuk menaruhnya di tempat kosong. Keping bisa ditumpuk seperti Lego.</p>
      <div className="grid grid-cols-2 gap-2">
        {types.map(t => (
          <button key={t} className="lego-piece" draggable title={BLOCK_TYPES[t].hint}
            onDragStart={e => { e.dataTransfer.setData(DT_BLOCK, t); e.dataTransfer.effectAllowed = 'copy'; }}
            onClick={() => onAdd(t)}>
            <span className="ic" aria-hidden>{ICONS[t] ?? '■'}</span>
            <span className="min-w-0"><b>{BLOCK_TYPES[t].label}</b><small>{BLOCK_TYPES[t].w}×{BLOCK_TYPES[t].h}</small></span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   Laci foto — seret foto ke halaman atau ke blok
   ============================================================ */
export function PhotoDrawer({ pub, onUse, preload }: { pub: Publication; onUse: (m: { url: string; path?: string | null }) => void; preload?: Media[] }) {
  const [items, setItems] = useState<Media[]>(preload ?? []);
  const [busy, setBusy] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const inp = useRef<HTMLInputElement>(null);
  const demo = pub.id === 'demo';
  useEffect(() => {
    if (demo || preload) return;
    createClient().from('media').select('*').eq('publication_id', pub.id).order('created_at', { ascending: false }).limit(120).then((r: { data: unknown }) => setItems((r.data as Media[]) ?? []));
  }, [pub.id, demo, preload]);
  async function onFiles(files: FileList | null) {
    if (!files?.length || demo) return; setErr(null); setBusy(files.length);
    for (const f of Array.from(files)) {
      try { const m = await uploadMedia(f, pub.id); setItems(x => [m, ...x]); } catch (e) { setErr((e as Error).message); } finally { setBusy(n => n - 1); }
    }
  }
  return (
    <div className="p-3" onDragOver={e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }} onDrop={e => { if (e.dataTransfer.files.length) { e.preventDefault(); onFiles(e.dataTransfer.files); } }}>
      <button className="btn gold w-full justify-center mb-2" disabled={busy > 0 || demo} onClick={() => inp.current?.click()}>{busy ? `Mengunggah ${busy}…` : '⬆ Unggah foto'}</button>
      <input ref={inp} type="file" accept="image/*" multiple className="hidden" onChange={e => { onFiles(e.target.files); e.target.value = ''; }} />
      <p className="text-[11px] text-[var(--muted)] mb-3 leading-relaxed">Seret foto ke <b>ruang kosong</b> untuk membuat blok foto baru, atau ke <b>blok yang sudah ada</b> untuk mengganti gambarnya. Klik foto untuk memasang ke blok terpilih.</p>
      {err && <div className="warnbox mb-2">{err}</div>}
      <div className="grid grid-cols-2 gap-2">
        {items.map(m => (
          <button key={m.id} className="photo-tile" draggable title={m.caption ?? ''}
            onDragStart={e => { e.dataTransfer.setData(DT_MEDIA, JSON.stringify({ url: m.url, path: m.path })); e.dataTransfer.effectAllowed = 'copy'; }}
            onClick={() => onUse({ url: m.url, path: m.path })}>
            <img src={imgSrc(m.url, true) ?? m.url} alt={m.caption ?? ''} draggable={false} loading="lazy" />
          </button>
        ))}
      </div>
      {items.length === 0 && <div className="text-xs text-[var(--muted)] text-center py-6">{demo ? 'Mode demo: unggah dinonaktifkan.' : 'Belum ada foto. Unggah atau seret berkas ke sini.'}</div>}
    </div>
  );
}

export type { Block };
