-- Phase 5: agent schedule status for reliable cron execution
ALTER TABLE public.agent_schedules
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'idle';

ALTER TABLE public.agent_schedules
  DROP CONSTRAINT IF EXISTS agent_schedules_status_valid;

ALTER TABLE public.agent_schedules
  ADD CONSTRAINT agent_schedules_status_valid CHECK (
    status IN ('idle', 'scheduled', 'running', 'paused', 'waiting', 'error')
  );

CREATE INDEX IF NOT EXISTS agent_schedules_due_idx
  ON public.agent_schedules (next_run_at ASC)
  WHERE enabled = true
    AND next_run_at IS NOT NULL
    AND status <> 'running';

COMMENT ON COLUMN public.agent_schedules.status IS
  'Scheduler state: idle, scheduled, running, paused, waiting (event-driven), error';
