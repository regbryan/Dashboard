-- Run this in your Supabase SQL Editor
-- https://supabase.com/dashboard/project/oqzkwsqrxpqntlojsvzz/sql/new

-- Table that maps a Supabase auth user to one or more brands
create table if not exists public.user_brand_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  role text not null default 'client' check (role in ('client', 'admin')),
  created_at timestamptz not null default now(),
  unique (user_id, brand_id)
);

-- Helpful index for the middleware lookup
create index if not exists idx_user_brand_access_user on public.user_brand_access(user_id);
create index if not exists idx_user_brand_access_brand on public.user_brand_access(brand_id);

-- Row-Level Security
alter table public.user_brand_access enable row level security;

-- A user can read their own access rows
create policy "Users can read their own brand access"
  on public.user_brand_access
  for select
  using (auth.uid() = user_id);

-- Admin can read everything (by service role key or via an admin check)
-- You will assign client accounts in the dashboard UI using the service role.

-- ========================================================
-- AFTER the migration runs, add yourself as admin:
-- ========================================================
-- 1. Sign in to the dashboard at least once so you get an auth.users row
-- 2. Run this to find your user_id:
--       select id, email from auth.users where email = 'reggie@inspiredideationstrategies.com';
-- 3. You can optionally add a row for each brand you own, or just rely on the
--    middleware ADMIN_EMAIL check (already set to your email).

-- ========================================================
-- To give a client access to their brand, run:
-- ========================================================
-- insert into public.user_brand_access (user_id, brand_id)
--   values (
--     (select id from auth.users where email = 'client@example.com'),
--     (select id from public.brands where slug = 'blitz')
--   );
