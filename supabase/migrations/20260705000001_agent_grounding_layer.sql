-- Agent grounding layer: facts, acts/checks, citations, layered playbook.
--
-- Adds the substrate an AI agent needs to make a claim a lawyer can trust:
--   facts          — extracted, span-provenanced claims (self-citing; the
--                    ground tier for anything an extractor pulls off a doc)
--   task_steps     — acts (do-steps) + checks (QA gates) fanned out under a
--                    task, optionally sourced from a playbook item
--   citations      — the ledger: every claim (message/fact/activity/task/
--                    task_step) resolves to ≥1 record-ref or span-ref row
--   playbook_items — layered best-practice repo (state | firm | personal),
--                    resolved by slug with personal > firm > state precedence
--
-- Composite FKs (document_id, matter_id) → documents(id, matter_id) enforce
-- CNR/matter isolation for spans at the DB level, not just in app code — a
-- fact or citation can never point at a document from a different matter.
--
-- RLS follows the standing convention: owned rows scoped to
-- auth.uid() = lawyer_id (the 20260624000001_task_first_model.sql four-policy
-- block); playbook_items instead follows the workflow_states pattern (global
-- 'state' rows have lawyer_id null and are world-readable).

-- ── 0. Prerequisite: matter isolation at the DB level ────────────────────────
-- Lets facts/citations use a composite FK so a span can never point across
-- matters.
alter table documents add constraint documents_id_matter_unique unique (id, matter_id);

-- ── 1. New enums ─────────────────────────────────────────────────────────────
create type fact_status            as enum ('proposed', 'verified');
create type step_kind              as enum ('act', 'check');
create type check_result           as enum ('pass', 'fail', 'na');
create type step_source            as enum ('manual', 'playbook', 'assistant');
create type citation_ref_kind      as enum ('record', 'span');
create type citation_record_table  as enum ('fact', 'activity', 'task', 'document', 'matter');
create type citation_subject       as enum ('message', 'fact', 'activity', 'task', 'task_step');
create type playbook_scope         as enum ('state', 'firm', 'personal');
create type playbook_kind          as enum ('rule', 'checklist', 'template');

-- ── 2. facts — extracted, citeable facts with span provenance ───────────────
-- Self-citing: its own (document_id, start_offset, end_offset) span IS the
-- citation for this row (see lib/citations.ts factToSpanRef). Downstream
-- assertions cite a fact via a record-ref instead of re-deriving its span.
create table facts (
  id                uuid primary key default gen_random_uuid(),
  lawyer_id         uuid not null references auth.users(id) on delete cascade,
  matter_id         uuid not null references matters(id) on delete cascade,
  document_id       uuid not null,                            -- span provenance source
  start_offset      integer not null,                         -- inclusive char offset into extracted text
  end_offset        integer not null,                         -- exclusive
  fact_type         text not null,                             -- open vocabulary: party_name, filing_date, ...
  value             jsonb not null,                            -- canonical typed payload (FactValue)
  value_text        text not null,                             -- denormalised, always-renderable display string
  confidence        numeric(4,3) not null,
  status            fact_status not null default 'proposed',
  verified_at       timestamptz,
  source_rank       smallint not null default 100,             -- authority of source doc; lower = more authoritative
  extractor_version text not null,                             -- e.g. 'fact-extractor@2026-07-01'
  created_at        timestamptz not null default now(),

  check (end_offset > start_offset and start_offset >= 0),
  check (confidence >= 0 and confidence <= 1),

  -- Composite FK: a fact's document must belong to the fact's own matter.
  foreign key (document_id, matter_id) references documents (id, matter_id) on delete cascade,
  -- Extractor idempotency: re-running the same extractor over the same span is a no-op.
  unique (document_id, fact_type, start_offset, end_offset)
);
create index idx_facts_matter_type on facts (matter_id, fact_type);
create index idx_facts_document    on facts (document_id);

-- ── 3. playbook_items — layered State | Firm | Personal repo ────────────────
-- One table, three kinds (rule | checklist | template); layering, override
-- precedence and listing UI are identical across kinds, so the payload is a
-- high-variance jsonb `spec`. Created before task_steps because task_steps
-- references it (best-practice source ref for checks).
create table playbook_items (
  id           uuid primary key default gen_random_uuid(),
  scope        playbook_scope not null,
  lawyer_id    uuid references auth.users(id) on delete cascade,  -- null iff scope='state' (global/system rows)
  firm_id      uuid,                                              -- forward slot; no FK yet (no firms table)
  kind         playbook_kind not null,
  slug         text not null,                                     -- stable identity across layers (override key)
  title        text not null,
  description  text,
  forum_type   forum_type,                                        -- applicability filter; null = any forum
  task_type    task_type,                                         -- applicability filter; null = any task type
  spec         jsonb not null default '{}'::jsonb,                -- payload, shape by kind (PlaybookSpec)
  source_ref   text,                                               -- authority citation for state rows
  enabled      boolean not null default true,                     -- disable without delete
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  check ((scope = 'state') = (lawyer_id is null))
);
-- One state row per slug (global namespace); a lawyer may separately hold
-- BOTH a firm and a personal override of the same slug.
create unique index playbook_items_state_slug on playbook_items (slug) where lawyer_id is null;
alter table playbook_items add constraint playbook_items_lawyer_scope_slug_key unique (lawyer_id, scope, slug);
create index idx_playbook_applicability on playbook_items (kind, task_type, forum_type);

-- ── 4. task_steps — Acts + Checks under a task ───────────────────────────────
-- One table for both kinds: acts and checks share lifecycle, ordering, and
-- rendering, and differ by exactly two nullable columns (completed_at vs.
-- result/evaluated_at). Deliberately NOT task rows — steps need none of the
-- task machinery (key, state_id, priority, matter surfacing) and adding two
-- more task types would contaminate every task/Inbox/Calendar read.
create table task_steps (
  id               uuid primary key default gen_random_uuid(),
  lawyer_id        uuid not null references auth.users(id) on delete cascade,
  task_id          uuid not null references tasks(id) on delete cascade,   -- steps die with the task
  kind             step_kind not null,                          -- 'act' = do-step, 'check' = QA gate
  title            text not null,
  description      text,
  position         integer not null default 0,                  -- manual ordering within task+kind
  completed_at     timestamptz,                                 -- acts only: null = open
  result           check_result,                                -- checks only: null = not yet evaluated
  evaluated_at     timestamptz,                                 -- checks: when result was set
  source           step_source not null default 'manual',       -- how the step got here
  playbook_item_id uuid references playbook_items(id) on delete set null,  -- best-practice source ref
  source_note      text,                                        -- free-text authority when no playbook item
  created_at       timestamptz not null default now(),

  -- Acts never carry a result; checks may or may not (before/after evaluation).
  check ((kind = 'act' and result is null) or kind = 'check')
);
create index idx_task_steps_task on task_steps (task_id, kind, position);

-- ── 5. citations — THE ledger ────────────────────────────────────────────────
-- A citation ref is a two-tier discriminated union — record-ref (a row in a
-- citable table) or span-ref (a byte range in a document) — flattened into
-- queryable, check-constrained columns. facts do NOT get citations rows for
-- their own provenance: their span columns ARE the citation.
create table citations (
  id           uuid primary key default gen_random_uuid(),
  lawyer_id    uuid not null references auth.users(id) on delete cascade,
  matter_id    uuid not null references matters(id) on delete cascade,     -- isolation + cleanup
  subject_type citation_subject not null,                                 -- which table holds the claim
  subject_id   uuid not null,                                             -- polymorphic; no FK (taggings pattern)
  claim_id     uuid not null,                                             -- the specific assertion
  position     smallint not null default 0,                               -- order of citations under one claim
  ref_kind     citation_ref_kind not null,                                -- discriminant
  ref_table    citation_record_table,                                     -- record-ref only
  ref_id       uuid,                                                      -- record-ref only; polymorphic, no FK
  document_id  uuid,                                                      -- span-ref only
  start_offset integer,                                                   -- span-ref only
  end_offset   integer,                                                   -- span-ref only
  quote        text,                                                      -- cached excerpt for hover-render
  created_at   timestamptz not null default now(),

  check (
    (ref_kind = 'record' and ref_table is not null and ref_id is not null
       and document_id is null and start_offset is null and end_offset is null)
    or
    (ref_kind = 'span' and document_id is not null
       and start_offset is not null and end_offset is not null and end_offset > start_offset
       and ref_table is null and ref_id is null)
  ),

  -- Span isolation: a span citation's document must belong to the citation's
  -- own matter (NULL document_id on record-refs is skipped by MATCH SIMPLE).
  foreign key (document_id, matter_id) references documents (id, matter_id) on delete cascade,
  unique (claim_id, position)
);
create index idx_citations_claim   on citations (claim_id);
create index idx_citations_subject on citations (subject_type, subject_id);

-- ── 6. Row Level Security ────────────────────────────────────────────────────
-- Standard owned-row block (auth.uid() = lawyer_id) for facts/task_steps/citations.
do $$
declare t text;
begin
  foreach t in array array['facts', 'task_steps', 'citations'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (auth.uid() = lawyer_id)', t||'_sel', t);
    execute format('create policy %I on %I for insert with check (auth.uid() = lawyer_id)', t||'_ins', t);
    execute format('create policy %I on %I for update using (auth.uid() = lawyer_id) with check (auth.uid() = lawyer_id)', t||'_upd', t);
    execute format('create policy %I on %I for delete using (auth.uid() = lawyer_id)', t||'_del', t);
  end loop;
end $$;

-- playbook_items: workflow_states pattern — 'state' rows (lawyer_id null) are
-- world-readable; only their own firm/personal rows are writable per lawyer.
-- 'state' rows are seeded by migrations/service role, which bypasses RLS.
alter table playbook_items enable row level security;
create policy playbook_items_sel on playbook_items for select using (lawyer_id is null or auth.uid() = lawyer_id);
create policy playbook_items_ins on playbook_items for insert with check (auth.uid() = lawyer_id);
create policy playbook_items_upd on playbook_items for update using (auth.uid() = lawyer_id) with check (auth.uid() = lawyer_id);
create policy playbook_items_del on playbook_items for delete using (auth.uid() = lawyer_id);
