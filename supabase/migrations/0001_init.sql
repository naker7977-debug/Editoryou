-- ============================================================
--  PLATFORM PENERBITAN DIGITAL — skema awal
--  Jalankan di Supabase: SQL Editor → tempel seluruh berkas → Run
--  (atau: supabase db push bila memakai CLI). Idempoten: aman dijalankan ulang.
-- ============================================================
create extension if not exists "pgcrypto";

-- ---------- Enum ----------
do $$ begin create type publication_kind as enum ('newspaper','magazine'); exception when duplicate_object then null; end $$;
do $$ begin create type member_role as enum ('chief','editor','designer','journalist','writer'); exception when duplicate_object then null; end $$;
do $$ begin create type content_status as enum ('draft','review','ready','published','archived'); exception when duplicate_object then null; end $$;
do $$ begin create type edition_access as enum ('free','subscribers'); exception when duplicate_object then null; end $$;
do $$ begin create type subscription_status as enum ('active','expired','cancelled'); exception when duplicate_object then null; end $$;

-- ---------- Profil pengguna (pembaca, redaksi, admin) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'user' check (role in ('user','superadmin')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- ---------- Penerbit (koran / majalah) ----------
create table if not exists public.publications (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name text not null,
  type publication_kind not null default 'newspaper',
  tagline text,
  city text,
  description text,
  logo_url text,
  settings jsonb not null default '{}'::jsonb,   -- {accent, tone, mastheadStyle, price, motto, frequency}
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Anggota redaksi per penerbit ----------
create table if not exists public.publication_members (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role member_role not null default 'journalist',
  created_at timestamptz not null default now(),
  unique (publication_id, user_id)
);
create index if not exists publication_members_user_idx on public.publication_members(user_id);

-- ---------- Naskah / artikel ----------
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  section text,
  kicker text,
  title text not null default '',
  deck text,
  byline text,
  body text not null default '',
  cover_url text,
  cover_caption text,
  tags text[] not null default '{}',
  status content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists articles_pub_idx on public.articles(publication_id, updated_at desc);

-- ---------- Edisi (tata letak halaman) ----------
create table if not exists public.editions (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  title text not null default '',
  number text,
  edition_date date not null default current_date,
  access edition_access not null default 'subscribers',
  status content_status not null default 'draft',
  cover_url text,
  cover_data jsonb,                                -- edisi beku berisi 1 halaman sampul (publik, untuk thumbnail)
  data jsonb not null default '{"pages":[]}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists editions_pub_idx on public.editions(publication_id, edition_date desc);

-- Snapshot edisi terbit (yang dibaca pembaca; isi naskah sudah dibekukan)
create table if not exists public.edition_snapshots (
  edition_id uuid primary key references public.editions(id) on delete cascade,
  data jsonb not null,
  published_at timestamptz not null default now()
);

-- ---------- Media ----------
create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  path text not null,
  url text not null,
  caption text,
  width int,
  height int,
  size_bytes int,
  uploader_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists media_pub_idx on public.media(publication_id, created_at desc);

-- ---------- Paket & langganan pembaca ----------
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid references public.publications(id) on delete cascade, -- null = berlaku semua penerbit
  name text not null,
  interval text not null default 'month' check (interval in ('month','year')),
  price_idr int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  publication_id uuid references public.publications(id) on delete cascade, -- null = semua penerbit
  plan_id uuid references public.plans(id) on delete set null,
  status subscription_status not null default 'active',
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  activated_by uuid references public.profiles(id) on delete set null,
  payment_ref text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists subscriptions_user_idx on public.subscriptions(user_id, status);

-- ---------- updated_at otomatis ----------
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists articles_touch on public.articles;
create trigger articles_touch before update on public.articles for each row execute procedure public.touch_updated_at();
drop trigger if exists editions_touch on public.editions;
create trigger editions_touch before update on public.editions for each row execute procedure public.touch_updated_at();
drop trigger if exists publications_touch on public.publications;
create trigger publications_touch before update on public.publications for each row execute procedure public.touch_updated_at();

-- ============================================================
--  Fungsi bantu otorisasi
-- ============================================================
create or replace function public.is_superadmin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'superadmin' from public.profiles where id = auth.uid()), false)
$$;
create or replace function public.member_role_of(pub uuid) returns member_role
language sql stable security definer set search_path = public as $$
  select role from public.publication_members where publication_id = pub and user_id = auth.uid()
$$;
create or replace function public.is_member(pub uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_superadmin() or exists (select 1 from public.publication_members where publication_id = pub and user_id = auth.uid())
$$;
-- Menata & menerbitkan edisi: pemimpin redaksi, redaktur, penata letak (dan superadmin)
create or replace function public.can_edit_publication(pub uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_superadmin() or coalesce(public.member_role_of(pub) in ('chief','editor','designer'), false)
$$;
create or replace function public.has_subscription(pub uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = auth.uid() and s.status = 'active'
      and now() between s.starts_at and s.ends_at
      and (s.publication_id is null or s.publication_id = pub))
$$;

-- Cegah pengguna biasa menaikkan dirinya jadi superadmin.
-- Boleh: superadmin, service role (aplikasi admin), SQL Editor (postgres), dan bootstrap claim_first_superadmin.
create or replace function public.guard_profile_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role
     and not public.is_superadmin()
     and coalesce(auth.role(), '') <> 'service_role'
     and session_user not in ('postgres', 'supabase_admin')
     and coalesce(current_setting('app.bootstrap_superadmin', true), '') <> 'on' then
    raise exception 'Tidak diizinkan mengubah peran';
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles for each row execute procedure public.guard_profile_update();

-- Bootstrap: pengguna pertama yang memanggil ini menjadi superadmin bila belum ada superadmin
create or replace function public.claim_first_superadmin() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  if exists (select 1 from public.profiles where role = 'superadmin') then return false; end if;
  -- profil bisa belum ada bila pengguna dibuat sebelum trigger dipasang
  insert into public.profiles (id, email) select id, email from auth.users where id = auth.uid() on conflict (id) do nothing;
  perform set_config('app.bootstrap_superadmin', 'on', true);
  update public.profiles set role = 'superadmin' where id = auth.uid();
  perform set_config('app.bootstrap_superadmin', '', true);
  return true;
end $$;

-- Menerbitkan / menarik edisi hanya untuk pemimpin redaksi & redaktur (penata letak boleh menata, tidak menerbitkan)
create or replace function public.can_publish_publication(pub uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_superadmin() or coalesce(public.member_role_of(pub) in ('chief','editor'), false)
$$;
create or replace function public.guard_edition_status() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;  -- service role / SQL Editor
  if (tg_op = 'INSERT' and new.status = 'published')
     or (tg_op = 'UPDATE' and new.status is distinct from old.status and 'published' in (new.status, old.status)) then
    if not public.can_publish_publication(new.publication_id) then
      raise exception 'Hanya pemimpin redaksi atau redaktur yang dapat menerbitkan / menarik edisi';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists editions_status_guard on public.editions;
create trigger editions_status_guard before insert or update on public.editions for each row execute procedure public.guard_edition_status();

-- Penulis/wartawan tidak boleh menandai naskahnya sendiri "Terbit"/"Arsip"; itu wewenang redaktur
create or replace function public.guard_article_status() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.status in ('published','archived') and (tg_op = 'INSERT' or new.status is distinct from old.status)
     and not public.can_edit_publication(new.publication_id) then
    raise exception 'Status naskah ini hanya dapat diubah oleh redaktur';
  end if;
  return new;
end $$;
drop trigger if exists articles_status_guard on public.articles;
create trigger articles_status_guard before insert or update on public.articles for each row execute procedure public.guard_article_status();

-- Ringkasan untuk dashboard admin (dibaca dengan service role / superadmin)
drop view if exists public.v_admin_stats;
create view public.v_admin_stats with (security_invoker = true) as
select
  (select count(*) from public.publications)                                   as publications,
  (select count(distinct user_id) from public.publication_members)             as members,
  (select count(*) from public.profiles)                                       as users,
  (select count(*) from public.subscriptions where status = 'active' and now() between starts_at and ends_at) as active_subscriptions,
  (select count(*) from public.editions where status = 'published')            as published_editions,
  (select count(*) from public.articles)                                       as articles;

-- ============================================================
--  Row Level Security
-- ============================================================
alter table public.profiles enable row level security;
alter table public.publications enable row level security;
alter table public.publication_members enable row level security;
alter table public.articles enable row level security;
alter table public.editions enable row level security;
alter table public.edition_snapshots enable row level security;
alter table public.media enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;

-- profiles: diri sendiri, superadmin, atau rekan satu penerbit
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (
  id = auth.uid() or public.is_superadmin()
  or exists (select 1 from public.publication_members a join public.publication_members b on a.publication_id = b.publication_id
             where a.user_id = auth.uid() and b.user_id = profiles.id)
);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update using (id = auth.uid() or public.is_superadmin());

-- publications
drop policy if exists publications_select on public.publications;
create policy publications_select on public.publications for select using (is_active or public.is_member(id));
drop policy if exists publications_admin on public.publications;
create policy publications_admin on public.publications for all using (public.is_superadmin()) with check (public.is_superadmin());
drop policy if exists publications_chief_update on public.publications;
create policy publications_chief_update on public.publications for update using (public.member_role_of(id) = 'chief');

-- members
drop policy if exists members_select on public.publication_members;
create policy members_select on public.publication_members for select using (public.is_member(publication_id));
drop policy if exists members_admin on public.publication_members;
create policy members_admin on public.publication_members for all using (public.is_superadmin()) with check (public.is_superadmin());

-- articles
drop policy if exists articles_select on public.articles;
create policy articles_select on public.articles for select using (public.is_member(publication_id));
drop policy if exists articles_insert on public.articles;
create policy articles_insert on public.articles for insert with check (public.is_member(publication_id) and (author_id = auth.uid() or public.can_edit_publication(publication_id)));
drop policy if exists articles_update on public.articles;
create policy articles_update on public.articles for update using (
  public.can_edit_publication(publication_id) or (author_id = auth.uid() and status in ('draft','review','ready'))
);
drop policy if exists articles_delete on public.articles;
create policy articles_delete on public.articles for delete using (
  public.can_edit_publication(publication_id) or (author_id = auth.uid() and status = 'draft')
);

-- editions: meta edisi terbit publik; draf hanya anggota
drop policy if exists editions_select on public.editions;
create policy editions_select on public.editions for select using (status = 'published' or public.is_member(publication_id));
drop policy if exists editions_write on public.editions;
create policy editions_write on public.editions for all using (public.can_edit_publication(publication_id)) with check (public.can_edit_publication(publication_id));

-- snapshots: pembaca hanya bila edisi terbit & (gratis atau berlangganan); redaksi selalu
drop policy if exists snapshots_select on public.edition_snapshots;
create policy snapshots_select on public.edition_snapshots for select using (
  exists (select 1 from public.editions e where e.id = edition_id and (
    public.is_member(e.publication_id)
    or (e.status = 'published' and (e.access = 'free' or public.has_subscription(e.publication_id)))
  ))
);
drop policy if exists snapshots_write on public.edition_snapshots;
create policy snapshots_write on public.edition_snapshots for all using (
  exists (select 1 from public.editions e where e.id = edition_id and public.can_publish_publication(e.publication_id))
) with check (
  exists (select 1 from public.editions e where e.id = edition_id and public.can_publish_publication(e.publication_id))
);

-- media
drop policy if exists media_select on public.media;
create policy media_select on public.media for select using (public.is_member(publication_id));
drop policy if exists media_insert on public.media;
create policy media_insert on public.media for insert with check (public.is_member(publication_id));
drop policy if exists media_update on public.media;
create policy media_update on public.media for update using (public.is_member(publication_id));
drop policy if exists media_delete on public.media;
create policy media_delete on public.media for delete using (uploader_id = auth.uid() or public.can_edit_publication(publication_id));

-- plans
drop policy if exists plans_select on public.plans;
create policy plans_select on public.plans for select using (is_active or public.is_superadmin());
drop policy if exists plans_admin on public.plans;
create policy plans_admin on public.plans for all using (public.is_superadmin()) with check (public.is_superadmin());

-- subscriptions
drop policy if exists subs_select on public.subscriptions;
create policy subs_select on public.subscriptions for select using (user_id = auth.uid() or public.is_superadmin());
drop policy if exists subs_admin on public.subscriptions;
create policy subs_admin on public.subscriptions for all using (public.is_superadmin()) with check (public.is_superadmin());

-- ============================================================
--  Storage: bucket "media" (publik dibaca; redaksi mengunggah ke folder <publication_id>/...)
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media','media', true, 10485760, array['image/jpeg','image/png','image/webp','image/gif','image/svg+xml'])
on conflict (id) do update set public = true;

drop policy if exists "media public read" on storage.objects;
create policy "media public read" on storage.objects for select using (bucket_id = 'media');
drop policy if exists "media member upload" on storage.objects;
create policy "media member upload" on storage.objects for insert to authenticated with check (
  bucket_id = 'media' and public.is_member(((storage.foldername(name))[1])::uuid)
);
drop policy if exists "media member delete" on storage.objects;
create policy "media member delete" on storage.objects for delete to authenticated using (
  bucket_id = 'media' and public.is_member(((storage.foldername(name))[1])::uuid)
);

-- ============================================================
--  Paket bawaan (hanya bila tabel masih kosong)
-- ============================================================
insert into public.plans (name, interval, price_idr)
select * from (values ('Langganan Bulanan — semua penerbit', 'month', 35000), ('Langganan Tahunan — semua penerbit', 'year', 350000)) v(name, interval, price_idr)
where not exists (select 1 from public.plans);
