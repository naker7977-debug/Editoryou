-- ============================================================
--  0003 — Foto hidup: video di bucket "media" + kolom jenis media
--  Bucket menerima MP4/WebM/MOV (maks 50 MB — batas paket gratis Supabase)
--  di samping gambar. Tabel media mencatat jenis dan poster video.
--  Idempoten: aman dijalankan ulang.
-- ============================================================
update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/svg+xml','video/mp4','video/webm','video/quicktime']
where id = 'media';

alter table public.media add column if not exists kind text not null default 'image' check (kind in ('image','video'));
alter table public.media add column if not exists poster_url text;

select id, file_size_limit, allowed_mime_types from storage.buckets where id = 'media';
