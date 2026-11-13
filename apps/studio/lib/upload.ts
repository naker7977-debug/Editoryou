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
  await supabase.storage.from('media').remove([m.path]);
  const { error } = await supabase.from('media').delete().eq('id', m.id);
  if (error) throw new Error(error.message);
}
