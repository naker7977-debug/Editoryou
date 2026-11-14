-- ============================================================
--  0002 — Tata letak terbuka untuk tim kecil
--  Bila publications.settings.openLayout = true (bawaan untuk majalah),
--  SEMUA anggota redaksi boleh membuat & menata edisi.
--  Menerbitkan/menarik (trigger guard_edition_status) dan menghapus edisi
--  tetap khusus pemimpin redaksi & redaktur. Idempoten.
-- ============================================================
create or replace function public.layout_open(pub uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((settings->>'openLayout')::boolean, type = 'magazine') from public.publications where id = pub
$$;

create or replace function public.can_layout_edition(pub uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_edit_publication(pub) or (public.is_member(pub) and coalesce(public.layout_open(pub), false))
$$;

drop policy if exists editions_write on public.editions;
drop policy if exists editions_insert on public.editions;
drop policy if exists editions_update on public.editions;
drop policy if exists editions_delete on public.editions;
create policy editions_insert on public.editions for insert with check (public.can_layout_edition(publication_id));
create policy editions_update on public.editions for update using (public.can_layout_edition(publication_id)) with check (public.can_layout_edition(publication_id));
create policy editions_delete on public.editions for delete using (public.can_edit_publication(publication_id));
