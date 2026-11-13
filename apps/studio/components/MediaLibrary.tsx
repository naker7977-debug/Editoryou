'use client';
import { useRef, useState } from 'react';
import type { Media, Publication } from '@press/db';
import { deleteMedia, uploadMedia } from '@/lib/upload';
import { createClient } from '@press/db/browser';
import { Toast, useToast } from './Toast';

export function MediaLibrary({ pub, initial }: { pub: Publication; initial: Media[] }) {
  const [items, setItems] = useState<Media[]>(initial);
  const [busy, setBusy] = useState(0);
  const inp = useRef<HTMLInputElement>(null);
  const toast = useToast();

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(files.length);
    for (const f of Array.from(files)) {
      try { const m = await uploadMedia(f, pub.id); setItems(x => [m, ...x]); }
      catch (e) { toast.show(`${f.name}: ${(e as Error).message}`, true); }
      finally { setBusy(n => n - 1); }
    }
  }
  async function rename(m: Media, caption: string) {
    const { error } = await createClient().from('media').update({ caption }).eq('id', m.id);
    if (error) toast.show(error.message, true); else setItems(x => x.map(i => i.id === m.id ? { ...i, caption } : i));
  }
  async function remove(m: Media) {
    if (!confirm('Hapus foto ini? Blok yang memakainya akan kehilangan gambar.')) return;
    try { await deleteMedia(m); setItems(x => x.filter(i => i.id !== m.id)); } catch (e) { toast.show((e as Error).message, true); }
  }
  return (
    <div className="p-8 max-w-6xl w-full" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); onFiles(e.dataTransfer.files); }}>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div><div className="text-[10px] tracking-[.3em] uppercase text-[var(--gold)] font-semibold">Media</div><h1 className="font-display text-3xl mt-1">Pustaka foto</h1><p className="text-sm text-[var(--muted)] mt-1">Seret berkas ke halaman ini atau klik unggah. Foto dikompresi otomatis (maks sisi 1800 px).</p></div>
        <div><button className="btn gold" onClick={() => inp.current?.click()} disabled={busy > 0}>{busy ? `Mengunggah ${busy}…` : '⬆ Unggah foto'}</button><input ref={inp} type="file" accept="image/*" multiple className="hidden" onChange={e => { onFiles(e.target.files); e.target.value = ''; }} /></div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
        {items.map(m => (
          <div key={m.id} className="card overflow-hidden group">
            <div className="aspect-[4/3] bg-[#0f0c0a]"><img src={m.url} alt="" className="w-full h-full object-cover" loading="lazy" /></div>
            <div className="p-2">
              <input className="w-full bg-transparent text-xs outline-none border-b border-transparent focus:border-[var(--gold)]" defaultValue={m.caption ?? ''} onBlur={e => { if (e.target.value !== (m.caption ?? '')) rename(m, e.target.value); }} placeholder="Keterangan…" />
              <div className="flex items-center justify-between mt-1 text-[10px] text-[var(--muted)]"><span>{m.width && m.height ? `${m.width}×${m.height}` : ''} {m.size_bytes ? `· ${Math.round(m.size_bytes / 1024)} KB` : ''}</span>
                <span className="flex gap-2"><button className="hover:text-[var(--text)]" onClick={() => { navigator.clipboard?.writeText(m.url).then(() => toast.show('URL disalin')); }}>Salin URL</button><button className="hover:text-[#f1b1a6]" onClick={() => remove(m)}>Hapus</button></span></div>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="col-span-full text-[var(--muted)] py-10 text-center">Belum ada foto.</div>}
      </div>
      <Toast t={toast} />
    </div>
  );
}
