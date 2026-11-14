'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadMedia } from '@/lib/upload';
import { Toast, useToast } from './Toast';

/** Kotak seret-lepas foto di dashboard; foto langsung masuk Galeri. */
export function AssetDrop({ pubId }: { pubId: string }) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(0);
  const inp = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const toast = useToast();

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files).filter(f => f.type.startsWith('image/'));
    setBusy(list.length);
    let ok = 0;
    for (const f of list) {
      try { await uploadMedia(f, pubId); ok++; }
      catch (e) { toast.show(`${f.name}: ${(e as Error).message}`, true); }
      finally { setBusy(n => n - 1); }
    }
    if (ok) { toast.show(`${ok} foto masuk galeri ✨`); router.refresh(); }
  }

  return (
    <>
      <button
        type="button"
        className={'t-drop h-full w-full' + (over ? ' over' : '')}
        onClick={() => inp.current?.click()}
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); onFiles(e.dataTransfer.files); }}
        disabled={busy > 0}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><rect x="3" y="3" width="13" height="13" rx="3" /><path d="M8 21h10a3 3 0 0 0 3-3V8" /><path d="M9.5 9.5v-3m0 0L8 8m1.5-1.5L11 8" /></svg>
        {busy ? `Mengunggah ${busy}…` : <>Seret foto ke sini<br /><span className="opacity-70 font-medium">atau klik untuk pilih</span></>}
      </button>
      <input ref={inp} type="file" accept="image/*" multiple className="hidden" onChange={e => { onFiles(e.target.files); e.target.value = ''; }} />
      <Toast t={toast} />
    </>
  );
}
