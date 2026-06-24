-- Task-first re-model (greenfield; pre-launch destructive migration).
--
-- Collapses the five activity-ish tables into a unified, Linear-inspired model:
--   actions + hearings + deadlines + triage_items  → tasks   (type + jsonb attributes)
--   court_events + remarks                          → activity (immutable audit timeline)
--   action_labels + matter_labels                   → taggings (polymorphic)
--   action_relations                                → task_relations
--   engagements                                     → dropped (unused in the UI)
-- Plus a forward-compatible chat substrate (conversations + messages) aligned
-- with the Vercel Chat SDK / AI SDK UIMessage shape. No chat UI this pass.
--
-- Parity goal: each surviving table maps to a screen; Inbox/Calendar/Tasks/
-- timeline become filters over 1–2 tables instead of five.
-- RLS unchanged in spirit: every owned row scoped to auth.uid() = lawyer_id.

-- ── 1. Drop the collapsed tables (cascade clears their FKs + triggers) ───────
drop table if exists
  triage_items,
  action_relations,
  action_labels,
  matter_labels,
  deadlines,
  hearings,
  court_events,
  remarks,
  actions,
  engagements
  cascade;

-- Enums used only by the dropped tables.
drop type if exists action_source;
drop type if exists triage_state;
drop type if exists hearing_state;
drop type if exists deadline_type;
drop type if exists engagement_status;
-- Reused as-is (do NOT drop): action_priority, relation_kind, event_source.

-- ── 2. Trim matters of dead columns ──────────────────────────────────────────
alter table matters
  drop column if exists engagement_id,
  drop column if exists court_hierarchy,
  drop column if exists last_event_at;

-- ── 3. New enums ─────────────────────────────────────────────────────────────
create type task_type        as enum ('task', 'hearing', 'deadline');
create type task_source      as enum ('manual', 'triage', 'template', 'sync');
create type activity_kind    as enum ('court_event', 'remark', 'system');
create type tagging_target   as enum ('task', 'matter');
create type conversation_kind as enum ('assistant', 'client');
create type message_role     as enum ('system', 'user', 'assistant', 'tool');

-- ── 4. tasks — the unified base entity ───────────────────────────────────────
-- type='task'    → a workflow ticket (carries a state_id + key, e.g. T-12)
-- type='hearing' → a court date; legal fields in attributes
--                  {purpose, outcome, court_state:'scheduled'|'held'|'adjourned', ordinal}
-- type='deadline'→ a computed deadline; attributes {basis, deadline_type}
-- Inbox = type='task' rows parked in the system 'Triage' state; attributes
--                  {triage_kind} drives the KIND chip.
-- state_id is NULLABLE: hearings/deadlines carry null. Every read that feeds a
-- status badge MUST filter type='task'.
create table tasks (
  id           uuid primary key default gen_random_uuid(),
  lawyer_id    uuid not null references auth.users(id) on delete cascade,
  matter_id    uuid not null references matters(id) on delete cascade,
  type         task_type not null default 'task',
  key          text,                                        -- minted for type='task' only
  title        text not null,
  description  text,
  state_id     uuid references workflow_states(id),         -- nullable (hearings/deadlines)
  priority     action_priority not null default 'none',
  due_date     date,                                        -- hearing/deadline date or task due
  completed_at timestamptz,
  source       task_source not null default 'manual',
  parent_id    uuid references tasks(id) on delete cascade,
  snoozed_until timestamptz,                                -- Inbox snooze
  attributes   jsonb not null default '{}'::jsonb,          -- type-specific legal fields
  created_at   timestamptz not null default now(),
  unique (lawyer_id, key)                                   -- NULLs don't collide
);
create index idx_tasks_matter_type on tasks(matter_id, type);
create index idx_tasks_due          on tasks(lawyer_id, type, due_date);
create index idx_tasks_state        on tasks(lawyer_id, state_id);
-- next_hearing_date projection reads scheduled hearings via this partial index.
create index idx_tasks_hearing_state on tasks ((attributes->>'court_state')) where type = 'hearing';

-- ── task_relations (blocks / blocked_by / related) ───────────────────────────
create table task_relations (
  id         uuid primary key default gen_random_uuid(),
  lawyer_id  uuid not null references auth.users(id) on delete cascade,
  task_id    uuid not null references tasks(id) on delete cascade,
  related_id uuid not null references tasks(id) on delete cascade,
  kind       relation_kind not null,
  unique (task_id, related_id, kind)
);
create index idx_task_relations_task on task_relations(task_id);

-- ── 5. activity — immutable audit/timeline (court_events + remarks) ──────────
-- kind='court_event' → synced change (content_hash set for idempotency)
-- kind='remark'      → a lawyer's immutable note (body set, content_hash null)
-- kind='system'      → document add/remove + other system lines
create table activity (
  id             uuid primary key default gen_random_uuid(),
  lawyer_id      uuid not null references auth.users(id) on delete cascade,
  matter_id      uuid not null references matters(id) on delete cascade,
  task_id        uuid references tasks(id) on delete set null,
  kind           activity_kind not null,
  event_type     text,                                      -- e.g. 'status_changed', 'document_added'
  body           text,                                      -- remark text / event description
  previous_value text,
  new_value      text,
  source         event_source not null default 'ecourt',    -- 'ecourt' | 'lawyer_manual' | 'system'
  occurred_at    timestamptz,
  content_hash   text,                                      -- sync dedup key; null for remarks/system
  created_at     timestamptz not null default now(),
  unique (matter_id, content_hash)                          -- NULLs don't collide
);
create index idx_activity_matter on activity(matter_id, occurred_at desc);

-- Remark content is immutable (UPDATE only — DELETE stays open so matter cascade
-- works). forbid_mutation() already exists from the core migration.
create trigger activity_remark_immutable before update on activity
  for each row when (old.kind = 'remark') execute function forbid_mutation();

-- ── 6. taggings — one polymorphic label join (tasks + matters) ──────────────
-- No FK on target_id (polymorphic). The app's ownsRow guard enforces ownership
-- and clearDemo deletes matter taggings explicitly (no cascade reaches them).
create table taggings (
  target_type tagging_target not null,
  target_id   uuid not null,
  label_id    uuid not null references labels(id) on delete cascade,
  lawyer_id   uuid not null references auth.users(id) on delete cascade,
  primary key (target_type, target_id, label_id)
);
create index idx_taggings_target on taggings(target_type, target_id);
create index idx_taggings_label  on taggings(label_id);

-- ── 7. Chat foundation (Vercel Chat SDK / AI SDK UIMessage) ─────────────────
-- Kept separate from `activity` (different lifecycle: messages are mutable as
-- the assistant streams). Foundation only — no reads/writes/UI this pass.
create table conversations (
  id              uuid primary key default gen_random_uuid(),
  lawyer_id       uuid not null references auth.users(id) on delete cascade,
  matter_id       uuid references matters(id) on delete cascade,
  client_id       uuid references clients(id) on delete set null,
  kind            conversation_kind not null default 'assistant',
  title           text,
  visibility      text not null default 'private',
  last_message_at timestamptz,
  created_at      timestamptz not null default now()
);
create index idx_conversations_lawyer on conversations(lawyer_id);
create index idx_conversations_matter on conversations(matter_id);

create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  lawyer_id       uuid not null references auth.users(id) on delete cascade,  -- denormalised for RLS
  role            message_role not null,
  parts           jsonb not null default '[]'::jsonb,        -- UIMessage parts: text/tool/file/reasoning
  metadata        jsonb not null default '{}'::jsonb,        -- citations/model/tokens or channel/delivery
  created_at      timestamptz not null default now()
);
create index idx_messages_conversation on messages(conversation_id, created_at);

-- ── 8. Row Level Security (per-lawyer ownership) ─────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'tasks','task_relations','activity','taggings','conversations','messages'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (auth.uid() = lawyer_id)', t||'_sel', t);
    execute format('create policy %I on %I for insert with check (auth.uid() = lawyer_id)', t||'_ins', t);
    execute format('create policy %I on %I for update using (auth.uid() = lawyer_id) with check (auth.uid() = lawyer_id)', t||'_upd', t);
    execute format('create policy %I on %I for delete using (auth.uid() = lawyer_id)', t||'_del', t);
  end loop;
end $$;
