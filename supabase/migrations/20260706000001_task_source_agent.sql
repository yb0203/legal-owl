-- Agent-emitted proposals are parked as Triage-state tasks with source='agent'
-- (see apps/web/lib/agents/orchestrator.ts#emitProposal and lib/agents/proposal.ts).
-- The task-first model's task_source enum didn't include 'agent', so those
-- inserts failed silently. Add the value.
alter type task_source add value if not exists 'agent';
