-- Auto-confirm new signups at the DB level (effectively turns off email
-- verification). This is safe for Legal Owl because app access is independently
-- gated by the waitlist `has_access` flag — an unverified email can create an
-- account but cannot enter the app until allowlisted. Drop this trigger to
-- re-enable email verification.
create or replace function public.auto_confirm_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is null then
    new.email_confirmed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists auto_confirm_user_trigger on auth.users;
create trigger auto_confirm_user_trigger
  before insert on auth.users
  for each row
  execute function public.auto_confirm_user();
