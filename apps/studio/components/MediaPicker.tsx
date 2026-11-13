'use client';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@press/db/browser';
import type { Media, Publication } from '@press/db';
import { svgArt } from '@press/ui';
import { uploadMedia } from '@/lib/upload';

export function MediaPicker({ pub, onPick, onClose, allowArt = true }: { pub: Publication; onPick: (m: { url: string; path?: string | null }) => void; onClose: () => void; allowArt?: boolean }) {
  const [items, setItems] = useState<Media[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const inp = useRef<HTMLInputElement>(null);

  useEffect(() => { (async () => {
    const { data } = await createClient().from('media').select('*').eq('publication_id', pub.id).order('created_at', { ascending: false }).limit(300);
    setItems((data as Media[]) ?? []);
  })(); }, [pub.id]);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return; setBusy(true); setErr(null);
    try {
      const first = await uploadMedia(files[0], pub.id);
      setItems(x => [first, ...x]);
      if (files.length === 1) { onPick({ url: first.url, path: first.path }); return; }
      for (let i = 1; i < files.length; i++) { const m = await uploadMedia(files[i], pub.id); setItems(x => [m, ...x]); }
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }
  const list = q ? items.filter(m => (m.caption ?? '').toLowerCase().includes(q.toLowerCase())) : items;
  const pal = pub.type === 'magazine' ? 'warm' : 'sepia';

  return (
    <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <header className="flex items-center gap-3 px-5 py-3 border-b border-[var(--line)]">
          <h3 className="font-display text-lg mr-auto">Pustaka media</h3>
          <input className="input" style={{ width: 200 }} placeholder="Cari keterangan…" value={q} onChange={e => setQ(e.target.value)} />
          <button className="btn sm gold" onClick={() => inp.current?.click()} disabled={busy}>{busy ? 'Mengunggah…' : '⬆ Unggah'}</button>
          <input ref={inp} type="file" accept="image/*" multiple className="hidden" onChange={e => onFiles(e.target.files)} />
          <button className="btn sm" onClick={onClose}>Tutup</button>
        </header>
        <div className="p-5" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); onFiles(e.dataTransfer.files); }}>
          {err && <div className="warnbox mb-3">{err}</div>}
          {allowArt && (
            <div className="mb-4">
              <div className="text-[10px] tracking-[.2em] uppercase text-[var(--muted)] mb-2">Ilustrasi sementara (tanpa unggah)</div>
              <div className="flex gap-2 flex-wrap">
                {(['hills', 'city', 'market', 'portrait', 'abstract', 'mag'] as const).map(k => (
                  <button key={k} className="w-16 h-20 rounded border border-[var(--line)] overflow-hidden hover:border-[var(--gold)]" title={k} onClick={() => onPick({ url: svgArt(k, Math.floor(Math.random() * 60) + 1, pal) })}>
                    <img src={svgArt(k, 3, pal)} alt={k} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="text-[10px] tracking-[.2em] uppercase text-[var(--muted)] mb-2">Foto penerbit ({list.length}) — seret berkas ke sini untuk mengunggah</div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {list.map(m => (
              <button key={m.id} className="text-left group" onClick={() => onPick({ url: m.url, path: m.path })}>
                <div className="aspect-[4/3] rounded overflow-hidden border border-[var(--line)] group-hover:border-[var(--gold)] bg-[#0f0c0a]"><img src={m.url} alt="" className="w-full h-full object-cover" loading="lazy" /></div>
                <div className="text-[11px] text-[var(--muted)] truncate mt-1">{m.caption}</div>
              </button>
            ))}
            {list.length === 0 && <div className="col-span-full text-sm text-[var(--muted)] py-8 text-center">Belum ada foto. Unggah JPG/PNG — dikompresi otomatis.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
