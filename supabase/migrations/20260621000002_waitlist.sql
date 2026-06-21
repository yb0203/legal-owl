-- Waitlist + access gating.
-- A row per email. `has_access` is flipped to true from the Supabase dashboard
-- to grant a person entry to the app. Until then they see the waitlist screen.

create table waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,          -- always stored lowercased (see join_waitlist)
  full_name  text,
  has_access boolean not null default false,
  created_at timestamptz not null default now()
);

alter table waitlist enable row level security;

-- A signed-in user may read ONLY their own row (to learn their has_access state).
-- No anon select (don't leak the list), no client writes (managed via RPC + dashboard).
create policy waitlist_select_own on waitlist
  for select using (lower(email) = lower(auth.jwt() ->> 'email'));

-- Public, safe way to join the waitlist without exposing the table.
-- SECURITY DEFINER so it can insert past RLS; only ever adds an email (has_access
-- stays false by default). Idempotent on email.
create or replace function join_waitlist(p_email text, p_full_name text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into waitlist (email, full_name)
  values (lower(trim(p_email)), nullif(trim(p_full_name), ''))
  on conflict (email) do nothing;
end;
$$;

revoke all on function join_waitlist(text, text) from public;
grant execute on function join_waitlist(text, text) to anon, authenticated;
