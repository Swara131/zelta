-- Create public.templates if this project never ran the original catalog migration,
-- then extend it for the 50-template marketplace.
-- Does not replace the existing agent builder, workflows, or decision agents.

CREATE TABLE IF NOT EXISTS public.templates (
  id TEXT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  icon VARCHAR(16) NOT NULL,
  category VARCHAR(64) NOT NULL,
  default_description TEXT NOT NULL,
  tools JSONB NOT NULL DEFAULT '[]'::jsonb,
  trigger_type TEXT NOT NULL DEFAULT 'webhook',
  supports_threshold BOOLEAN NOT NULL DEFAULT false,
  default_threshold INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT templates_trigger_type_valid CHECK (trigger_type IN ('email', 'webhook', 'schedule')),
  CONSTRAINT templates_default_threshold_positive CHECK (
    default_threshold IS NULL OR default_threshold > 0
  )
);

CREATE INDEX IF NOT EXISTS idx_templates_category ON public.templates (category);

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read templates" ON public.templates;
CREATE POLICY "Authenticated users can read templates"
  ON public.templates FOR SELECT TO authenticated
  USING (true);

GRANT SELECT ON public.templates TO authenticated;

ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS short_description TEXT,
  ADD COLUMN IF NOT EXISTS long_description TEXT,
  ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS risk_level TEXT NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS estimated_setup_minutes INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS suggested_tools JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS default_instructions TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS example_tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS default_trigger TEXT NOT NULL DEFAULT 'webhook',
  ADD COLUMN IF NOT EXISTS default_safety_preset TEXT NOT NULL DEFAULT 'safe',
  ADD COLUMN IF NOT EXISTS default_tool_permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS default_approval_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS default_execution_limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS default_data_protection JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.templates
SET slug = id
WHERE slug IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS templates_slug_unique ON public.templates (slug);

ALTER TABLE public.templates
  DROP CONSTRAINT IF EXISTS templates_risk_level_valid;
ALTER TABLE public.templates
  ADD CONSTRAINT templates_risk_level_valid
  CHECK (risk_level IN ('low', 'medium', 'high'));

UPDATE public.templates
SET is_published = false
WHERE id LIKE 'template-%';

COMMENT ON TABLE public.templates IS 'Pre-built agent templates for quick onboarding.';

NOTIFY pgrst, 'reload schema';
