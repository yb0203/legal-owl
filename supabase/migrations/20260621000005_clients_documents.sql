-- Client → Engagement layer, conflict flags, and documents.
-- Implements docs/specs/app-surface-and-lifecycles.md (Client → Engagement →
-- Matter → Action). RLS: every row scoped to its owning lawyer (auth.uid()).

-- ── Enums ──────────────────────────────────────────────────────────────────
create type client_type      as enum ('individual', 'organisation');
create type client_status    as enum ('lead', 'active', 'inactive');
create type engagement_status as enum ('open', 'on_hold', 'closed');
create type conflict_status  as enum ('open', 'dismissed');
create type document_source  as enum ('court_order', 'judgement', 'lawyer_upload', 'generated');

-- ── Clients ──────────────────────────────────────────────────────────────────
create table clients (
  id           uuid primary key default gen_random_uuid(),
  lawyer_id    uuid not null references auth.users(id) on delete cascade,
  type         client_type not null default 'individual',
  display_name text not null,
  status       client_status not null default 'active',
  email        text,
  phone        text,
  address      text,
  gstin        text,                                   -- org only, plain field
  pan          text,
  notes        text,
  created_at   timestamptz not null default now()
);
create index idx_clients_lawyer on clients(lawyer_id);

-- ── Contacts (thin people attached to a client) ──────────────────────────────
create table contacts (
  id         uuid primary key default gen_random_uuid(),
  lawyer_id  uuid not null references auth.users(id) on delete cascade,
  client_id  uuid not null references clients(id) on delete cascade,
  name       text not null,
  role       text,
  email      text,
  phone      text,
  created_at timestamptz not null default now()
);
create index idx_contacts_client on contacts(client_id);

-- ── Engagements (retainers / briefs; thin in v1) ─────────────────────────────
create table engagements (
  id         uuid primary key default gen_random_uuid(),
  lawyer_id  uuid not null references auth.users(id) on delete cascade,
  client_id  uuid not null references clients(id) on delete cascade,
  name       text not null,                            -- e.g. "General", "FY26 Retainer"
  scope_note text,
  status     engagement_status not null default 'open',
  created_at timestamptz not null default now()
);
create index idx_engagements_client on engagements(client_id);

-- ── Conflict flags (advisory, surfaced at intake) ────────────────────────────
create table conflict_flags (
  id           uuid primary key default gen_random_uuid(),
  lawyer_id    uuid not null references auth.users(id) on delete cascade,
  client_id    uuid not null references clients(id) on delete cascade,
  matched_name text not null,
  matter_id    uuid references matters(id) on delete set null,
  note         text,
  status       conflict_status not null default 'open',
  created_at   timestamptz not null default now()
);
create index idx_conflict_flags_client on conflict_flags(client_id);

-- ── Documents (rows; bytes live in Storage bucket case-documents) ─────────────
create table documents (
  id           uuid primary key default gen_random_uuid(),
  lawyer_id    uuid not null references auth.users(id) on delete cascade,
  matter_id    uuid not null references matters(id) on delete cascade,
  name         text not null,
  storage_path text not null,
  mime_type    text,
  size_bytes   bigint,
  source       document_source not null default 'lawyer_upload',
  uploaded_at  timestamptz not null default now()
);
create index idx_documents_matter on documents(matter_id);

-- ── Matter linkage + lifecycle ───────────────────────────────────────────────
alter table matters add column engagement_id uuid references engagements(id) on delete set null;
alter table matters add column archived_at   timestamptz;
-- client_id already exists (nullable, denormalised); now back it with an FK.
alter table matters add constraint matters_client_fk
  foreign key (client_id) references clients(id) on delete set null;

-- ── Triage snooze (Snooze → day before hearing) ──────────────────────────────
alter table triage_items add column snoozed_until timestamptz;

-- ── Row Level Security (per-lawyer ownership) ────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['clients','contacts','engagements','conflict_flags','documents'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (auth.uid() = lawyer_id)', t||'_sel', t);
    execute format('create policy %I on %I for insert with check (auth.uid() = lawyer_id)', t||'_ins', t);
    execute format('create policy %I on %I for update using (auth.uid() = lawyer_id) with check (auth.uid() = lawyer_id)', t||'_upd', t);
    execute format('create policy %I on %I for delete using (auth.uid() = lawyer_id)', t||'_del', t);
  end loop;
end $$;

-- ── Storage bucket for case documents (private, per-lawyer path prefix) ───────
insert into storage.buckets (id, name, public)
values ('case-documents', 'case-documents', false)
on conflict (id) do nothing;

-- Objects are namespaced ${lawyer_id}/${matter_id}/<file>; the first path
-- segment must equal the caller's uid.
create policy "case_docs_sel" on storage.objects for select
  using (bucket_id = 'case-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "case_docs_ins" on storage.objects for insert
  with check (bucket_id = 'case-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "case_docs_upd" on storage.objects for update
  using (bucket_id = 'case-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "case_docs_del" on storage.objects for delete
  using (bucket_id = 'case-documents' and (storage.foldername(name))[1] = auth.uid()::text);
