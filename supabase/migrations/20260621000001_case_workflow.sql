-- Case Workflow — core schema
-- Implements docs/brainstorms/2026-06-21-case-workflow-requirements.md
-- Aggregate: Matter (internal id key, optional CNR) owns Actions, Hearings,
-- Deadlines, TriageItems. Append-only court_events/remarks feed the timeline.
-- RLS: every row scoped to its owning lawyer (auth.uid() = lawyer_id).

create extension if not exists "pgcrypto";

-- ── Enums ──────────────────────────────────────────────────────────────────
create type forum_type   as enum ('district', 'high_court', 'supreme_court', 'nclt', 'nclat', 'arbitration', 'tribunal', 'other');
create type matter_status as enum ('active', 'on_hold', 'disposed');
create type lifecycle_state as enum ('pending_first_sync', 'active', 'not_found', 'disposed');
create type state_type   as enum ('triage', 'unstarted', 'started', 'blocked', 'completed', 'cancelled');
create type action_source as enum ('manual', 'triage', 'template', 'deadline');
create type action_priority as enum ('none', 'low', 'medium', 'high', 'urgent');
create type triage_state  as enum ('pending', 'accepted', 'dismissed');
create type hearing_state as enum ('scheduled', 'held', 'adjourned');
create type deadline_type as enum ('limitation', 'statutory', 'internal');
create type event_source  as enum ('ecourt', 'lawyer_manual', 'system');
create type relation_kind as enum ('blocks', 'blocked_by', 'related');

-- ── Workflow states ─────────────────────────────────────────────────────────
-- lawyer_id NULL = system default set, readable by all; non-null = a lawyer's custom states.
create table workflow_states (
  id         uuid primary key default gen_random_uuid(),
  lawyer_id  uuid references auth.users(id) on delete cascade,   -- null = system default
  name       text not null,
  type       state_type not null,
  position   int  not null default 0,
  created_at timestamptz not null default now()
);

insert into workflow_states (lawyer_id, name, type, position) values
  (null, 'Triage',          'triage',    0),
  (null, 'To-Do',           'unstarted', 1),
  (null, 'Awaiting Filing', 'started',   2),
  (null, 'Filed',           'started',   3),
  (null, 'Awaiting Hearing','started',   4),
  (null, 'In Progress',     'started',   5),
  (null, 'Blocked',         'blocked',   6),
  (null, 'Done',            'completed', 7),
  (null, 'Cancelled',       'cancelled', 8);

-- ── Matter (aggregate root) ─────────────────────────────────────────────────
create table matters (
  id                    uuid primary key default gen_random_uuid(),
  lawyer_id             uuid not null references auth.users(id) on delete cascade,
  key                   text not null,                       -- human key, e.g. M-123
  cnr                   text,                                -- optional eCourts link
  forum_type            forum_type not null default 'district',
  title                 text not null,
  parties               jsonb not null default '{}'::jsonb,  -- {petitioners:[], respondents:[], advocates:[]}
  court_hierarchy       jsonb,                               -- {state,district,complex,establishment}
  case_type             text,
  court_status          text,                                -- from eCourts, read-only
  matter_status         matter_status not null default 'active',
  lifecycle_state       lifecycle_state not null default 'active',
  next_hearing_date     date,                                -- projection
  client_id             uuid,                                -- link only; client entity owned by Client Notifs
  last_event_at         timestamptz,
  last_successful_sync_at timestamptz,
  created_at            timestamptz not null default now(),
  unique (lawyer_id, key),
  unique (lawyer_id, cnr)                                    -- cnr unique per lawyer when present
);
create index idx_matters_lawyer on matters(lawyer_id);
create index idx_matters_ndoh   on matters(lawyer_id, next_hearing_date);

-- ── Action (the ticket) ─────────────────────────────────────────────────────
create table actions (
  id              uuid primary key default gen_random_uuid(),
  lawyer_id       uuid not null references auth.users(id) on delete cascade,
  matter_id       uuid not null references matters(id) on delete cascade,
  key             text not null,                             -- human key, e.g. ACT-123
  title           text not null,
  description     text,
  state_id        uuid not null references workflow_states(id),
  priority        action_priority not null default 'none',
  due_date        date,
  source          action_source not null default 'manual',
  parent_action_id uuid references actions(id) on delete cascade,
  hearing_id      uuid,                                      -- anchor (FK added below)
  deadline_id     uuid,                                      -- anchor (FK added below)
  created_at      timestamptz not null default now(),
  completed_at    timestamptz,
  unique (lawyer_id, key)
);
create index idx_actions_matter on actions(matter_id);
create index idx_actions_lawyer on actions(lawyer_id);

create table action_relations (
  id          uuid primary key default gen_random_uuid(),
  lawyer_id   uuid not null references auth.users(id) on delete cascade,
  action_id   uuid not null references actions(id) on delete cascade,
  related_id  uuid not null references actions(id) on delete cascade,
  kind        relation_kind not null,
  unique (action_id, related_id, kind)
);

-- ── Hearings ─────────────────────────────────────────────────────────────────
create table hearings (
  id           uuid primary key default gen_random_uuid(),
  lawyer_id    uuid not null references auth.users(id) on delete cascade,
  matter_id    uuid not null references matters(id) on delete cascade,
  hearing_date date not null,
  purpose      text,
  outcome      text,
  source       event_source not null default 'ecourt',
  state        hearing_state not null default 'scheduled',
  ordinal      int not null default 0,                       -- disambiguate same-date hearings
  unique (matter_id, hearing_date, ordinal)
);
create index idx_hearings_matter on hearings(matter_id);

-- ── Deadlines (deterministic) ────────────────────────────────────────────────
create table deadlines (
  id          uuid primary key default gen_random_uuid(),
  lawyer_id   uuid not null references auth.users(id) on delete cascade,
  matter_id   uuid not null references matters(id) on delete cascade,
  type        deadline_type not null,
  due_date    date not null,                                 -- rule-computed, never LLM-generated
  basis       text,                                          -- e.g. Limitation Act article
  anchor_hearing_id uuid references hearings(id) on delete set null,
  computed_at timestamptz not null default now()
);
create index idx_deadlines_matter on deadlines(matter_id);

-- anchors from actions → hearings/deadlines
alter table actions add constraint actions_hearing_fk  foreign key (hearing_id)  references hearings(id)  on delete set null;
alter table actions add constraint actions_deadline_fk foreign key (deadline_id) references deadlines(id) on delete set null;

-- ── Append-only timeline rows ────────────────────────────────────────────────
create table court_events (
  id           uuid primary key default gen_random_uuid(),
  lawyer_id    uuid not null references auth.users(id) on delete cascade,
  matter_id    uuid not null references matters(id) on delete cascade,
  event_type   text not null,
  previous_value text,
  new_value    text,
  occurred_at  timestamptz,
  detected_at  timestamptz not null default now(),
  source_type  event_source not null default 'ecourt',
  content_hash text not null,                                -- natural-key dedup (no provider ids)
  unique (matter_id, content_hash)
);
create index idx_court_events_matter on court_events(matter_id, occurred_at);

create table remarks (
  id         uuid primary key default gen_random_uuid(),
  lawyer_id  uuid not null references auth.users(id) on delete cascade,
  matter_id  uuid not null references matters(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);
create index idx_remarks_matter on remarks(matter_id, created_at);

-- remarks are append-only + immutable (defense in depth alongside revoked grants)
create or replace function forbid_mutation() returns trigger language plpgsql as $$
begin raise exception 'rows in % are immutable', tg_table_name; end; $$;
create trigger remarks_immutable before update or delete on remarks
  for each row execute function forbid_mutation();

-- ── Triage inbox ─────────────────────────────────────────────────────────────
create table triage_items (
  id                uuid primary key default gen_random_uuid(),
  lawyer_id         uuid not null references auth.users(id) on delete cascade,
  matter_id         uuid not null references matters(id) on delete cascade,
  court_event_id    uuid references court_events(id) on delete cascade,
  kind              text not null,
  summary           text not null,
  state             triage_state not null default 'pending',
  resulting_action_id uuid references actions(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index idx_triage_pending on triage_items(lawyer_id, state) where state = 'pending';

-- ── Labels ───────────────────────────────────────────────────────────────────
create table labels (
  id        uuid primary key default gen_random_uuid(),
  lawyer_id uuid not null references auth.users(id) on delete cascade,
  name      text not null,
  color     text,
  unique (lawyer_id, name)
);
create table action_labels (
  action_id uuid not null references actions(id) on delete cascade,
  label_id  uuid not null references labels(id) on delete cascade,
  lawyer_id uuid not null references auth.users(id) on delete cascade,
  primary key (action_id, label_id)
);

-- ── Row Level Security ───────────────────────────────────────────────────────
alter table matters         enable row level security;
alter table actions         enable row level security;
alter table action_relations enable row level security;
alter table hearings        enable row level security;
alter table deadlines       enable row level security;
alter table court_events    enable row level security;
alter table remarks         enable row level security;
alter table triage_items    enable row level security;
alter table labels          enable row level security;
alter table action_labels   enable row level security;
alter table workflow_states enable row level security;

-- Per-lawyer ownership policies for the owned tables.
do $$
declare t text;
begin
  foreach t in array array[
    'matters','actions','action_relations','hearings','deadlines',
    'court_events','remarks','triage_items','labels','action_labels'
  ] loop
    execute format('create policy %I on %I for select using (auth.uid() = lawyer_id)', t||'_sel', t);
    execute format('create policy %I on %I for insert with check (auth.uid() = lawyer_id)', t||'_ins', t);
    execute format('create policy %I on %I for update using (auth.uid() = lawyer_id) with check (auth.uid() = lawyer_id)', t||'_upd', t);
    execute format('create policy %I on %I for delete using (auth.uid() = lawyer_id)', t||'_del', t);
  end loop;
end $$;

-- workflow_states: read system defaults (lawyer_id null) or your own; write only your own.
create policy workflow_states_sel on workflow_states for select using (lawyer_id is null or auth.uid() = lawyer_id);
create policy workflow_states_ins on workflow_states for insert with check (auth.uid() = lawyer_id);
create policy workflow_states_upd on workflow_states for update using (auth.uid() = lawyer_id) with check (auth.uid() = lawyer_id);
create policy workflow_states_del on workflow_states for delete using (auth.uid() = lawyer_id);
