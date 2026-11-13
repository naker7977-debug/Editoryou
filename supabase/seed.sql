-- Data awal opsional: dua penerbit contoh + paket langganan per penerbit.
-- Jalankan setelah 0001_init.sql. Anggota redaksi ditambahkan lewat aplikasi admin.
insert into public.publications (slug, name, type, tagline, city, settings)
values
  ('warta-nusantara', 'Warta Nusantara', 'newspaper', 'Suara Daerah — Jujur, Teliti, Bermartabat', 'Lembah Sari',
   '{"accent":"#8b1e1e","tone":"ivory","mastheadStyle":"black","price":"Rp 5.000","motto":"Terbit sejak 1962","frequency":"Harian"}'),
  ('lembar', 'LEMBAR', 'magazine', 'Majalah gaya hidup & budaya daerah', 'Lembah Sari',
   '{"accent":"#111111","tone":"bright","mastheadStyle":"caps","price":"Rp 45.000","motto":"Edisi bulanan","frequency":"Bulanan"}')
on conflict (slug) do nothing;

insert into public.plans (publication_id, name, interval, price_idr)
select v.pid, v.name, v.interval, v.price from (values
  ((select id from public.publications where slug='warta-nusantara'), 'Warta Nusantara — Bulanan', 'month', 25000),
  ((select id from public.publications where slug='lembar'), 'LEMBAR — Tahunan', 'year', 350000)
) v(pid, name, interval, price)
where v.pid is not null and not exists (select 1 from public.plans p where p.name = v.name);
