-- Lawyer profile / firm details, keyed on auth.uid(). Powers the editable
-- Settings page and (later) client-update email personalization + the client
-- portal. RLS: a lawyer can only see and write their own row.

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  firm_name text,
  phone text,
  bar_enrolment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Keyed on auth.uid() = id (id IS the auth uuid PK) rather than a lawyer_id
-- column — the standard Supabase 1:1-with-auth pattern. No DELETE policy: rows
-- are removed transitively via the on-delete-cascade FK to auth.users.
-- drop-if-exists keeps the migration safe to re-apply (CI reset / rollback).
drop policy if exists "profiles_select_own" on profiles;
create policy "profiles_select_own"
  on profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on profiles;
create policy "profiles_insert_own"
  on profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
