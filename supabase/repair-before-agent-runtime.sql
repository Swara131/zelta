-- Run this FIRST in Supabase SQL Editor if agent runtime migration fails with:
--   ERROR: 42703: column "updated_at" does not exist
--
-- Then re-run: supabase/migrations/20260915120000_agent_runtime_data_model.sql

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS agents_set_updated_at ON public.agents;
CREATE TRIGGER agents_set_updated_at
  BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- If runtime tables were partially created without updated_at, repair them too.
ALTER TABLE public.agent_runs
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.agent_actions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.tool_executions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.agent_schedules
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
