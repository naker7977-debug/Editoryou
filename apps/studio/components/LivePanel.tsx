'use client';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@press/db/browser';
import type { Media, Publication } from '@press/db';
import { MOTION_FILTER_LABEL, imgSrc, posterOf, youtubeId, type BlockImage, type BlockMotion, type MotionFilter, type MotionPlay } from '@press/ui';
import { VIDEO_MAX_MB, isVideoMedia, uploadVideo } from '@/lib/upload';

/** Ubah media video dari galeri menjadi slot gambar ber-foto-hidup (poster = bingkai videonya). */
export function imageFromVideo(m: Pick<Media, 'url' | 'path' | 'poster_url'>, keep?: BlockImage | null): BlockImage {
  return { url: m.poster_url || keep?.url || '', path: null, motion: { kind: 'file', src: m.url, path: m.path, filter: keep?.motion?.filter ?? null, play: keep?.motion?.play ?? null, sound: keep?.motion?.sound ?? false } };
}

/**
 * Panel "Foto hidup" untuk satu slot gambar (blok, foto galeri, atau latar halaman).
 * Bisa diisi berkas video (diunggah / dari galeri) atau tautan YouTube.
 */
export function MotionPanel({ image, onChange, pub, title = 'Foto hidup', open: openInit = false }: {
  image: BlockImage | null | undefined; onChange: (im: BlockImage | null) => void; pub: Publication; title?: string; open?: boolean;
}) {
  const m = image?.motion ?? null;
  const [open, setOpen] = useState(openInit || !!m);
  const [mode, setMode] = useState<'idle' | 'yt' | 'pick'>('idle');
  const [yt, setYt] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [videos, setVideos] = useState<Media[] | null>(null);
  const inp = useRef<HTMLInputElement>(null);
  const demo = pub.id === 'demo';
  useEffect(() => { if (openInit) setOpen(true); }, [openInit]);

  useEffect(() => {
    if (mode !== 'pick' || videos || demo) return;
    createClient().from('media').select('*').eq('publication_id', pub.id).order('created_at', { ascending: false }).limit(200)
      .then((r: { data: unknown }) => setVideos(((r.data as Media[]) ?? []).filter(isVideoMedia)));
  }, [mode, videos, demo, pub.id]);

  const setM = (patch: Partial<BlockMotion>) => { if (image && m) onChange({ ...image, motion: { ...m, ...patch } }); };

  async function onFile(f: File | undefined) {
    if (!f) return; setErr(null); setBusy(true);
    try { const media = await uploadVideo(f, pub.id); onChange(imageFromVideo(media, image)); setMode('idle'); setVideos(v => v ? [media, ...v] : v); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  function useYoutube() {
    const id = youtubeId(yt);
    if (!id) { setErr('Tautan YouTube tidak dikenali. Contoh: https://youtu.be/abc123XYZ90'); return; }
    setErr(null); onChange({ url: image?.url ?? '', path: image?.path ?? null, motion: { kind: 'youtube', src: id, play: 'tap', sound: true, filter: null } });
    setYt(''); setMode('idle');
  }

  if (!open) {
    return <button className="btn sm w-full justify-center mb-2 live-cta" onClick={() => setOpen(true)}>✦ Jadikan foto hidup</button>;
  }

  return (
    <div className="live-panel">
      <div className="flex items-center justify-between mb-2">
        <b className="text-xs">✦ {title}</b>
        {!m && <button className="text-[11px] text-[var(--muted)]" onClick={() => { setOpen(false); setMode('idle'); }}>Tutup</button>}
      </div>

      {m ? (
        <>
          <div className="text-[11px] text-[var(--muted)] mb-2 flex items-center gap-2">
            {posterOf(image) && <img src={imgSrc(posterOf(image), true) ?? undefined} alt="" className="w-12 h-9 object-cover rounded" />}
            <span className="min-w-0 truncate">{m.kind === 'youtube' ? <>YouTube · <code>{m.src}</code></> : <>Klip video · {m.path?.split('/').pop()}</>}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="field"><label>Putar</label>
              <select value={m.play ?? ''} onChange={e => setM({ play: (e.target.value || null) as MotionPlay | null })}>
                <option value="">Ikut edisi</option><option value="auto">Otomatis berulang</option><option value="tap">Saat diketuk</option>
              </select>
            </div>
            <div className="field"><label>Filter</label>
              <select value={m.filter ?? ''} onChange={e => setM({ filter: (e.target.value || null) as MotionFilter | null })}>
                <option value="">Ikut edisi</option>
                {(Object.keys(MOTION_FILTER_LABEL) as MotionFilter[]).map(f => <option key={f} value={f}>{MOTION_FILTER_LABEL[f]}</option>)}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs mb-2"><input type="checkbox" checked={!!m.sound} onChange={e => setM({ sound: e.target.checked })} className="accent-[var(--gold)]" /> Boleh bersuara saat diketuk pembaca</label>
          {m.kind === 'youtube' && <div className="field"><label>Mulai dari detik</label><input type="number" min={0} value={m.start ?? 0} onChange={e => setM({ start: Math.max(0, Number(e.target.value) || 0) })} /></div>}
          <div className="flex gap-2 flex-wrap">
            <button className="btn sm" onClick={() => setMode(mode === 'idle' ? 'pick' : 'idle')}>Ganti sumber</button>
            <button className="btn sm" onClick={() => image && onChange({ url: image.url, path: image.path ?? null })}>Lepas foto hidup</button>
          </div>
          <p className="text-[10px] text-[var(--muted)] mt-2 leading-relaxed">Gambar diam di atas tetap dipakai untuk cetak/PDF, thumbnail, dan pembaca yang memilih hemat data.</p>
        </>
      ) : (
        <p className="text-[11px] text-[var(--muted)] mb-2 leading-relaxed">Pilih klip pendek (3–15 detik terasa paling “ajaib”) atau tautan YouTube. Klip berulang tanpa suara saat halamannya dibuka.</p>
      )}

      {(!m || mode !== 'idle') && (
        <div className="mt-2 space-y-2">
          <div className="flex gap-2 flex-wrap">
            <button className="btn sm gold" disabled={busy || demo} onClick={() => inp.current?.click()}>{busy ? 'Mengunggah…' : '⬆ Unggah video'}</button>
            <button className={'btn sm' + (mode === 'yt' ? ' gold' : '')} onClick={() => setMode(mode === 'yt' ? 'idle' : 'yt')}>▶ YouTube</button>
            <button className={'btn sm' + (mode === 'pick' ? ' gold' : '')} disabled={demo} onClick={() => setMode(mode === 'pick' ? 'idle' : 'pick')}>Dari galeri</button>
          </div>
          <input ref={inp} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={e => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
          <div className="text-[10px] text-[var(--muted)]">MP4/WebM/MOV, maks {VIDEO_MAX_MB} MB · makin kecil makin hemat kuota pembaca.</div>
          {mode === 'yt' && (
            <div className="flex gap-2"><input className="input flex-1" placeholder="https://youtu.be/…" value={yt} onChange={e => setYt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') useYoutube(); }} /><button className="btn sm gold" onClick={useYoutube}>Pasang</button></div>
          )}
          {mode === 'pick' && (
            <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-auto">
              {videos === null && <div className="col-span-3 text-xs text-[var(--muted)]">Memuat…</div>}
              {videos?.length === 0 && <div className="col-span-3 text-xs text-[var(--muted)]">Belum ada video di galeri.</div>}
              {videos?.map(v => (
                <button key={v.id} className="photo-tile relative" title={v.caption ?? ''} onClick={() => { onChange(imageFromVideo(v, image)); setMode('idle'); }}>
                  {v.poster_url ? <img src={v.poster_url} alt="" /> : <span className="text-[10px]">video</span>}<span className="vbadge">▶</span>
                </button>
              ))}
            </div>
          )}
          {demo && <div className="text-[10px] text-[var(--muted)]">Mode demo: unggah dimatikan, YouTube tetap bisa dicoba.</div>}
        </div>
      )}
      {err && <div className="warnbox mt-2 text-xs">{err}</div>}
    </div>
  );
}
