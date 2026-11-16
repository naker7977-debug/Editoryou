'use client';
import { createClient } from '@press/db/browser';
import type { Media } from '@press/db';

/** Kompres gambar di peramban (maks sisi `max` px, JPEG) sebelum diunggah. */
export function compressImage(file: File, max = 1800, q = 0.84): Promise<{ blob: Blob; w: number; h: number }> {
  return new Promise((res, rej) => {
    if (file.type === 'image/svg+xml' || file.type === 'image/gif') { res({ blob: file, w: 0, h: 0 }); return; }
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      c.toBlob(b => b ? res({ blob: b, w: c.width, h: c.height }) : rej(new Error('Gagal mengompres')), 'image/jpeg', q);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Berkas bukan gambar yang valid')); };
    img.src = url;
  });
}

/** Unggah ke bucket "media" di folder <publication_id>/ dan catat di tabel media. */
export async function uploadMedia(file: File, publicationId: string, caption = ''): Promise<Media> {
  const supabase = createClient();
  const { blob, w, h } = await compressImage(file);
  const ext = blob.type === 'image/svg+xml' ? 'svg' : blob.type === 'image/gif' ? 'gif' : 'jpg';
  const path = `${publicationId}/${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from('media').upload(path, blob, { contentType: blob.type, upsert: false, cacheControl: '31536000' });
  if (upErr) throw new Error(upErr.message);
  const { data: pub } = supabase.storage.from('media').getPublicUrl(path);
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('media').insert({ publication_id: publicationId, uploader_id: user?.id ?? null, path, url: pub.publicUrl, caption: caption || file.name.replace(/\.[^.]+$/, ''), width: w || null, height: h || null, size_bytes: blob.size }).select('*').single();
  if (error) throw new Error(error.message);
  return data as Media;
}

export async function deleteMedia(m: Media) {
  const supabase = createClient();
  const poster = m.poster_url?.split('/storage/v1/object/public/media/')[1];
  await supabase.storage.from('media').remove(poster ? [m.path, decodeURIComponent(poster)] : [m.path]);
  const { error } = await supabase.from('media').delete().eq('id', m.id);
  if (error) throw new Error(error.message);
}

/* ---------- Foto hidup: unggah video + poster otomatis ---------- */
export const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
export const VIDEO_MAX_MB = 50;
export const isVideoMedia = (m: Pick<Media, 'kind' | 'path'>) => m.kind === 'video' || /\.(mp4|webm|mov)$/i.test(m.path);

/** Ambil satu bingkai video (≈0,5 dtk) sebagai JPEG untuk poster/gambar diam. */
export function videoPoster(file: Blob, max = 1280): Promise<{ blob: Blob; w: number; h: number; duration: number }> {
  return new Promise((res, rej) => {
    const v = document.createElement('video'); const url = URL.createObjectURL(file);
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
    const fail = () => { URL.revokeObjectURL(url); rej(new Error('Video tidak bisa dibaca peramban ini. Coba format MP4 (H.264).')); };
    v.onerror = fail;
    v.onloadedmetadata = () => { v.currentTime = Math.min(0.5, (v.duration || 1) / 3); };
    v.onseeked = () => {
      const s = Math.min(1, max / Math.max(v.videoWidth || 1, v.videoHeight || 1));
      const c = document.createElement('canvas'); c.width = Math.round((v.videoWidth || 640) * s); c.height = Math.round((v.videoHeight || 360) * s);
      c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
      const duration = v.duration || 0; URL.revokeObjectURL(url);
      c.toBlob(b => b ? res({ blob: b, w: c.width, h: c.height, duration }) : rej(new Error('Gagal membuat poster')), 'image/jpeg', 0.82);
    };
    setTimeout(() => { if (!v.videoWidth) fail(); }, 15000);
  });
}

/** Unggah klip video ke storage + posternya, catat sebagai media berjenis video. */
export async function uploadVideo(file: File, publicationId: string, caption = ''): Promise<Media> {
  if (!VIDEO_TYPES.includes(file.type)) throw new Error('Format video harus MP4, WebM, atau MOV.');
  if (file.size > VIDEO_MAX_MB * 1024 * 1024) throw new Error(`Video terlalu besar (maks ${VIDEO_MAX_MB} MB). Potong jadi klip pendek 3–15 detik.`);
  const supabase = createClient();
  const poster = await videoPoster(file);
  const base = `${publicationId}/${new Date().getFullYear()}/${crypto.randomUUID()}`;
  const ext = file.type === 'video/webm' ? 'webm' : file.type === 'video/quicktime' ? 'mov' : 'mp4';
  const [vUp, pUp] = await Promise.all([
    supabase.storage.from('media').upload(`${base}.${ext}`, file, { contentType: file.type, upsert: false, cacheControl: '31536000' }),
    supabase.storage.from('media').upload(`${base}-poster.jpg`, poster.blob, { contentType: 'image/jpeg', upsert: false, cacheControl: '31536000' }),
  ]);
  if (vUp.error) throw new Error(/mime|type/i.test(vUp.error.message) ? 'Penyimpanan belum menerima video — jalankan migrasi 0003 di Supabase.' : vUp.error.message);
  if (pUp.error) throw new Error(pUp.error.message);
  const vUrl = supabase.storage.from('media').getPublicUrl(`${base}.${ext}`).data.publicUrl;
  const pUrl = supabase.storage.from('media').getPublicUrl(`${base}-poster.jpg`).data.publicUrl;
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('media').insert({
    publication_id: publicationId, uploader_id: user?.id ?? null, path: `${base}.${ext}`, url: vUrl, poster_url: pUrl, kind: 'video',
    caption: caption || file.name.replace(/\.[^.]+$/, ''), width: poster.w || null, height: poster.h || null, size_bytes: file.size,
  }).select('*').single();
  if (error) throw new Error(error.message);
  return data as Media;
}
