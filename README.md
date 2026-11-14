# Editoryou — Platform Penerbitan Koran & Majalah Digital

Monorepo berisi tiga aplikasi Next.js yang berbagi satu basis data Supabase:

| Aplikasi | Folder | Untuk siapa | Port lokal |
|---|---|---|---|
| **Pembaca** (kios + flipbook) | `apps/reader` | Publik & pelanggan | 3000 |
| **Studio Redaksi** (dashboard editor) | `apps/studio` | Wartawan, penulis, redaktur, penata letak | 3001 |
| **Kontrol Admin** | `apps/admin` | Anda (superadmin platform) | 3002 |

Paket bersama:

- `packages/ui` — renderer halaman koran klasik & majalah modern, flipbook 3D (efek lipat halaman), mode baca, preset halaman, model data edisi.
- `packages/db` — klien Supabase (browser/server/service-role), tipe tabel, helper peran.
- `supabase/migrations/0001_init.sql` — skema lengkap + Row Level Security + bucket storage.

## Alur kerja redaksi

1. **Admin** membuat penerbit (koran/majalah), membuat akun redaksi, dan menetapkan peran per penerbit.
2. **Wartawan / penulis** masuk ke Studio → menulis **Naskah** → ubah status ke *Menunggu Redaktur* / *Siap Tayang*.
3. **Redaktur / penata letak** membuat **Edisi** (dari templat), menyusun blok di grid 12×12 per halaman, menautkan naskah ke blok, mengunggah foto, lalu **Pratinjau** flipbook.
4. **Terbitkan** → isi naskah dibekukan menjadi *snapshot*; edisi langsung tampil di aplikasi Pembaca. Edisi berakses *Pelanggan* hanya terbuka bagi pembaca dengan langganan aktif.
5. **Pembaca** mendaftar, memilih paket, membayar; **Admin** mengaktifkan langganan (pembayaran otomatis Midtrans/Xendit menyusul pada tahap berikutnya).

Peran redaksi (ditegakkan di database lewat RLS + trigger, bukan hanya di UI):

| Peran | Naskah | Tata letak edisi | Terbitkan / tarik edisi | Pengaturan penerbit |
|---|---|---|---|---|
| `chief` Pemimpin Redaksi | semua | ✓ | ✓ | ✓ |
| `editor` Redaktur | semua | ✓ | ✓ | – |
| `designer` Penata Letak | semua | ✓ | – | – |
| `journalist` Wartawan / `writer` Penulis | milik sendiri, status Draf → Menunggu Redaktur | – | – | – |

Hanya redaktur ke atas yang dapat menandai naskah *Terbit*/*Arsip*. Peran global `superadmin` hanya dapat diberikan oleh superadmin lain, aplikasi admin (service role), atau sekali lewat `/setup` saat belum ada superadmin sama sekali.

---

## 1. Siapkan Supabase (akun baru Anda)

1. Buat project di <https://supabase.com> (region Singapore paling dekat).
2. Buka **SQL Editor** → *New query* → tempel seluruh isi `supabase/migrations/0001_init.sql` → **Run**, lalu ulangi untuk `0002_open_layout.sql`. (Keduanya aman dijalankan ulang.)
3. Opsional: jalankan `supabase/seed.sql` untuk dua penerbit contoh + paket.
4. **Authentication → Providers → Email**: aktif. Untuk akun redaksi, admin membuat akun langsung (sudah terkonfirmasi). Untuk pembaca yang mendaftar sendiri, atur *Confirm email* sesuai selera; tambahkan URL aplikasi pembaca ke **Authentication → URL Configuration → Redirect URLs** (`https://<reader-domain>/auth/callback`).
5. Catat dari **Project Settings → API Keys** (dan **Data API** untuk URL):
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (`sb_publishable_…`) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Secret key** (`sb_secret_…`) → `SUPABASE_SERVICE_ROLE_KEY` — rahasia, **hanya** untuk aplikasi admin.
   - Project lama yang masih memakai kunci JWT: pakai `anon` dan `service_role` dari tab *Legacy API Keys* — keduanya juga berfungsi.

## 2. Jalankan lokal

```bash
pnpm install
cp .env.example apps/reader/.env.local
cp .env.example apps/studio/.env.local
cp .env.example apps/admin/.env.local      # isi juga SUPABASE_SERVICE_ROLE_KEY di sini
pnpm dev            # ketiga aplikasi sekaligus (turbo), atau: pnpm dev:reader / dev:studio / dev:admin
```

Tanpa Supabase pun Anda bisa melihat demo: `http://localhost:3000/contoh/koran`, `/contoh/majalah`, dan editor demo `http://localhost:3001/demo` (`?jenis=majalah`).

## 3. Deploy ke Vercel (akun baru Anda) — tiga project dari satu repo

Untuk **masing-masing** aplikasi buat satu project Vercel dari repo ini:

| Project | Root Directory | Env wajib |
|---|---|---|
| `editoryou-reader` | `apps/reader` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_STUDIO_URL`, `NEXT_PUBLIC_ADMIN_URL` |
| `editoryou-studio` | `apps/studio` | sama + `NEXT_PUBLIC_READER_URL` |
| `editoryou-admin` | `apps/admin` | sama + **`SUPABASE_SERVICE_ROLE_KEY`** |

Langkah: *Add New → Project → Import* repo → **Root Directory** pilih folder aplikasi → Framework *Next.js* (terdeteksi otomatis; Vercel mengenali workspace pnpm dan menginstal dari akar repo) → isi *Environment Variables* → Deploy. Ulangi untuk dua aplikasi lainnya. Setelah ketiganya punya domain, perbarui `NEXT_PUBLIC_*_URL` agar tautan antar-aplikasi benar, lalu *Redeploy*.

## 4. Penyiapan pertama

1. Buka aplikasi **admin** → `/masuk` dengan akun yang Anda daftarkan lewat aplikasi pembaca (atau buat pengguna di Supabase → Authentication → Users).
2. Anda akan diarahkan ke `/setup`; karena belum ada superadmin, klik **Jadikan saya superadmin**.
3. Buat penerbit → tambah anggota redaksi (email + kata sandi awal + peran) → bagikan URL Studio ke mereka.
4. Di Studio, buat edisi dari templat, atau mulai dari **Muat edisi contoh** untuk melihat semua jenis blok.

## 5. Android

Aplikasi pembaca responsif (satu halaman per lembar di layar sempit) dan menyertakan *web manifest* (bisa "Tambahkan ke layar utama"). Untuk aplikasi Android sungguhan, bungkus URL pembaca dengan **Trusted Web Activity** (Bubblewrap) atau **Capacitor WebView** — setiap edisi yang diterbitkan langsung muncul tanpa memperbarui aplikasi.

## Editor majalah "Lego"

Penerbit bertipe majalah memakai Studio bertema remaja dan editor tata letak bebas:

- **Templat bertahap:** edisi baru berisi 4 lembar inti terkunci — Sampul → Daftar Isi → Salam Redaksi → Liputan Utama — lalu halaman kreatif bebas (tambah lewat *＋ Lembar kreatif*).
- **Keping (blok)** diseret dari tab *Keping* ke halaman, dipindah dengan menyeret, diubah ukurannya dari sudut kanan-bawah, bisa ditumpuk (*Ke depan / Ke belakang*). Papan kunci: panah = geser, Shift+panah = ukuran, Del = hapus, Ctrl+D = gandakan.
- **Foto** diseret dari tab *Foto* ke ruang kosong (blok foto baru) atau ke blok yang ada (ganti gambar).
- **Hak tata letak:** bila *Pengaturan → Semua anggota tim boleh menata halaman* aktif (bawaan untuk majalah), semua anggota bisa membuat & menata edisi. Menerbitkan dan menghapus edisi tetap khusus redaktur ke atas (ditegakkan oleh RLS di `0002_open_layout.sql`).

## Struktur data edisi (ringkas)

```
EditionData { kind, masthead{name,number,date,…}, theme{accent,tone,mastheadStyle}, pages[] }
Page        { section, stage?: cover|toc|editorial|main|free, locked?, dark?, bg?, blocks[] }
Block       { type: lead|article|brief|image|quote|ad|cover|toc|text|feature|gallery, w(1-12), h(1-12), x?/y? (posisi bebas 0-11),
              cols, scale, dropcap, articleId?, kicker, title, deck, byline, body, img, images[], cap, imgH, invert }
```

Saat terbit, blok yang menautkan naskah dibekukan (`sourceArticleId`) ke `edition_snapshots.data`; `editions.cover_data` menyimpan sampul (1 halaman) untuk thumbnail publik.

## Pengujian yang sudah dilakukan

- `next build` ketiga aplikasi + typecheck paket bersama.
- Migrasi dijalankan dua kali (idempoten) + seed, pada Postgres 16 dengan tiruan skema `auth`/`storage` Supabase, terhubung sebagai `authenticator` seperti PostgREST.
- Skenario RLS: penyusup tidak bisa menjadikan dirinya superadmin; klaim superadmin pertama berhasil sekali; penata letak tidak bisa menerbitkan; wartawan tidak bisa menandai naskah Terbit atau membuat edisi; pembaca/anon hanya melihat meta edisi terbit, isi terkunci sampai langganan aktif, dan terkunci lagi saat edisi ditarik; unggahan storage hanya ke folder penerbit sendiri.
- Uji peramban (headless): kios, flipbook koran & majalah (tombol + seret), mode baca, editor tata letak, login admin, tampilan ponsel — tanpa error konsol.

## Peta jalan

- Pembayaran otomatis (Midtrans / Xendit) → kolom `subscriptions.payment_ref` sudah disiapkan.
- Notifikasi edisi baru (push / email), komentar pembaca, statistik baca.
- Ekspor PDF cetak dari tata letak yang sama.
