-- Tighten Row-Level Security for the dashboard.
-- Run in the Supabase SQL editor for project oqzkwsqrxpqntlojsvzz.
-- Safe to run more than once: drops old permissive policies first.

-- ============================================================================
-- Admin detection helper
-- ============================================================================
create or replace function public.is_admin()
  returns boolean
  language sql
  stable
  security definer
as $$
  select coalesce(
    (select email from auth.users where id = auth.uid()) in (
      'reggie@inspiredideationstrategies.com',
      'reggieebryant@gmail.com',
      'courtney@workbyccmarketing.com'
    ),
    false
  );
$$;

-- ============================================================================
-- Brand-access helper: true if current user has access to the given brand
-- ============================================================================
create or replace function public.has_brand_access(brand uuid)
  returns boolean
  language sql
  stable
  security definer
as $$
  select public.is_admin()
      or exists (
        select 1 from public.user_brand_access
         where user_id = auth.uid() and brand_id = brand
      );
$$;

-- ============================================================================
-- brands: admins full access; clients read only their accessible brands
-- ============================================================================
alter table public.brands enable row level security;

drop policy if exists "brands_select_all" on public.brands;
drop policy if exists "brands_insert_all" on public.brands;
drop policy if exists "brands_update_all" on public.brands;
drop policy if exists "brands_delete_all" on public.brands;
drop policy if exists "Enable read access for all users" on public.brands;
drop policy if exists "Enable insert access for all users" on public.brands;
drop policy if exists "Enable update access for all users" on public.brands;

create policy "brands_select" on public.brands for select
  using (public.has_brand_access(id));
create policy "brands_insert_admin" on public.brands for insert
  with check (public.is_admin());
create policy "brands_update_admin" on public.brands for update
  using (public.is_admin()) with check (public.is_admin());
create policy "brands_delete_admin" on public.brands for delete
  using (public.is_admin());

-- ============================================================================
-- posts: filter by brand access
-- ============================================================================
alter table public.posts enable row level security;

drop policy if exists "posts_select_all" on public.posts;
drop policy if exists "posts_insert_all" on public.posts;
drop policy if exists "posts_update_all" on public.posts;
drop policy if exists "posts_delete_all" on public.posts;
drop policy if exists "Enable read access for all users" on public.posts;
drop policy if exists "Enable insert access for all users" on public.posts;
drop policy if exists "Enable update access for all users" on public.posts;

create policy "posts_select" on public.posts for select
  using (public.has_brand_access(brand_id));
create policy "posts_insert_admin" on public.posts for insert
  with check (public.is_admin());
create policy "posts_update" on public.posts for update
  using (public.has_brand_access(brand_id))
  with check (public.has_brand_access(brand_id));
create policy "posts_delete_admin" on public.posts for delete
  using (public.is_admin());

-- ============================================================================
-- approvals: filter via parent post's brand access
-- ============================================================================
alter table public.approvals enable row level security;

drop policy if exists "approvals_select_all" on public.approvals;
drop policy if exists "approvals_insert_all" on public.approvals;
drop policy if exists "approvals_update_all" on public.approvals;
drop policy if exists "approvals_delete_all" on public.approvals;

create policy "approvals_select" on public.approvals for select
  using (
    exists (
      select 1 from public.posts p
       where p.id = approvals.post_id
         and public.has_brand_access(p.brand_id)
    )
  );
create policy "approvals_insert" on public.approvals for insert
  with check (
    exists (
      select 1 from public.posts p
       where p.id = approvals.post_id
         and public.has_brand_access(p.brand_id)
    )
  );
create policy "approvals_update_admin" on public.approvals for update
  using (public.is_admin()) with check (public.is_admin());
create policy "approvals_delete_admin" on public.approvals for delete
  using (public.is_admin());

-- ============================================================================
-- script_runs: admin only (all operations)
-- ============================================================================
alter table public.script_runs enable row level security;

drop policy if exists "script_runs_all" on public.script_runs;

create policy "script_runs_admin_select" on public.script_runs for select
  using (public.is_admin());
create policy "script_runs_admin_insert" on public.script_runs for insert
  with check (public.is_admin());
create policy "script_runs_admin_update" on public.script_runs for update
  using (public.is_admin()) with check (public.is_admin());
create policy "script_runs_admin_delete" on public.script_runs for delete
  using (public.is_admin());

-- ============================================================================
-- brand_kits / brand_kit_assets: filter via brand access
-- ============================================================================
alter table public.brand_kits enable row level security;
drop policy if exists "brand_kits_all" on public.brand_kits;

create policy "brand_kits_select" on public.brand_kits for select
  using (public.has_brand_access(brand_id));
create policy "brand_kits_write_admin" on public.brand_kits for all
  using (public.is_admin()) with check (public.is_admin());

alter table public.brand_kit_assets enable row level security;
drop policy if exists "brand_kit_assets_all" on public.brand_kit_assets;

create policy "brand_kit_assets_select" on public.brand_kit_assets for select
  using (
    exists (
      select 1 from public.brand_kits bk
       where bk.id = brand_kit_assets.brand_kit_id
         and public.has_brand_access(bk.brand_id)
    )
  );
create policy "brand_kit_assets_write_admin" on public.brand_kit_assets for all
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- ig_profile_cache: admin only (no brand linkage)
-- ============================================================================
alter table public.ig_profile_cache enable row level security;
drop policy if exists "ig_profile_cache_all" on public.ig_profile_cache;

create policy "ig_profile_cache_admin" on public.ig_profile_cache for all
  using (public.is_admin()) with check (public.is_admin());
