-- =============================================================================
-- ApprovalLayer — Core Database Schema
-- =============================================================================
-- Run in Supabase SQL Editor or: supabase db push
--
-- Includes: users, organizations, uploaded_logs, translations, risk_analysis,
--           approval_requests, approval_history, audit_logs, notifications,
--           subscriptions (+ organization_members for multi-tenant RLS)
--
-- Note: Legacy tables from earlier migrations (translator_sessions, risk_analyses)
-- remain untouched so existing API routes keep working until migrated.
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- Enums
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('owner', 'admin', 'member', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.org_member_role AS ENUM ('owner', 'admin', 'member', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.upload_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.translation_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.business_impact AS ENUM ('critical', 'high', 'medium', 'low', 'none');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.risk_severity AS ENUM ('critical', 'high', 'medium', 'low');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.approval_priority AS ENUM ('p1', 'p2', 'p3', 'p4');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.approval_status AS ENUM (
    'pending', 'approved', 'rejected', 'changes_requested', 'escalated'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_channel AS ENUM ('email', 'slack', 'teams');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_read_status AS ENUM ('unread', 'read', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.delivery_status AS ENUM (
    'delivered', 'pending', 'failed', 'bounced', 'retrying'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_plan AS ENUM ('free', 'professional', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM (
    'active', 'trialing', 'past_due', 'canceled', 'incomplete', 'paused'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.billing_interval AS ENUM ('monthly', 'yearly');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.audit_action AS ENUM (
    'create', 'update', 'delete', 'login', 'logout', 'approve', 'reject',
    'escalate', 'upload', 'translate', 'analyze', 'notify', 'subscribe'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- Utility: updated_at trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Auto-create public.users row on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', '')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- =============================================================================
-- users (extends auth.users)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role public.user_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_email_not_empty CHECK (length(trim(email)) > 0)
);

CREATE INDEX IF NOT EXISTS users_email_idx ON public.users (email);

DROP TRIGGER IF EXISTS users_set_updated_at ON public.users;
CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- organizations
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT organizations_name_not_empty CHECK (length(trim(name)) > 0),
  CONSTRAINT organizations_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_unique_idx ON public.organizations (slug);

DROP TRIGGER IF EXISTS organizations_set_updated_at ON public.organizations;
CREATE TRIGGER organizations_set_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- organization_members (required for org-scoped RLS)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role public.org_member_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT organization_members_unique UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS organization_members_user_idx
  ON public.organization_members (user_id);

CREATE INDEX IF NOT EXISTS organization_members_org_idx
  ON public.organization_members (organization_id);

DROP TRIGGER IF EXISTS organization_members_set_updated_at ON public.organization_members;
CREATE TRIGGER organization_members_set_updated_at
  BEFORE UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Returns organization IDs the current user belongs to (for RLS)
CREATE OR REPLACE FUNCTION public.user_organization_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = auth.uid();
$$;

-- =============================================================================
-- uploaded_logs
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.uploaded_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL DEFAULT 0 CHECK (file_size_bytes >= 0),
  mime_type TEXT,
  status public.upload_status NOT NULL DEFAULT 'pending',
  risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uploaded_logs_filename_not_empty CHECK (length(trim(filename)) > 0),
  CONSTRAINT uploaded_logs_storage_path_not_empty CHECK (length(trim(storage_path)) > 0)
);

CREATE INDEX IF NOT EXISTS uploaded_logs_org_created_idx
  ON public.uploaded_logs (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS uploaded_logs_user_created_idx
  ON public.uploaded_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS uploaded_logs_status_idx
  ON public.uploaded_logs (organization_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS uploaded_logs_storage_path_unique_idx
  ON public.uploaded_logs (storage_path);

DROP TRIGGER IF EXISTS uploaded_logs_set_updated_at ON public.uploaded_logs;
CREATE TRIGGER uploaded_logs_set_updated_at
  BEFORE UPDATE ON public.uploaded_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- translations (one row per translated log line / action)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  uploaded_log_id UUID REFERENCES public.uploaded_logs(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  line_number INTEGER NOT NULL CHECK (line_number > 0),
  action TEXT NOT NULL,
  explanation TEXT NOT NULL,
  affected_system TEXT NOT NULL,
  affected_user TEXT NOT NULL,
  event_timestamp TIMESTAMPTZ,
  business_impact public.business_impact NOT NULL DEFAULT 'medium',
  ai_confidence INTEGER NOT NULL DEFAULT 0 CHECK (ai_confidence >= 0 AND ai_confidence <= 100),
  model TEXT,
  status public.translation_status NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS translations_org_created_idx
  ON public.translations (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS translations_uploaded_log_idx
  ON public.translations (uploaded_log_id, line_number);

CREATE INDEX IF NOT EXISTS translations_user_created_idx
  ON public.translations (user_id, created_at DESC);

DROP TRIGGER IF EXISTS translations_set_updated_at ON public.translations;
CREATE TRIGGER translations_set_updated_at
  BEFORE UPDATE ON public.translations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- risk_analysis
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.risk_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  uploaded_log_id UUID REFERENCES public.uploaded_logs(id) ON DELETE SET NULL,
  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  risk_level public.risk_severity NOT NULL,
  total_detected INTEGER NOT NULL DEFAULT 0 CHECK (total_detected >= 0),
  analyzed_logs INTEGER NOT NULL DEFAULT 0 CHECK (analyzed_logs >= 0),
  distribution JSONB NOT NULL DEFAULT '[]'::jsonb,
  risks JSONB NOT NULL DEFAULT '[]'::jsonb,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS risk_analysis_org_created_idx
  ON public.risk_analysis (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS risk_analysis_uploaded_log_idx
  ON public.risk_analysis (uploaded_log_id);

CREATE INDEX IF NOT EXISTS risk_analysis_risk_level_idx
  ON public.risk_analysis (organization_id, risk_level);

DROP TRIGGER IF EXISTS risk_analysis_set_updated_at ON public.risk_analysis;
CREATE TRIGGER risk_analysis_set_updated_at
  BEFORE UPDATE ON public.risk_analysis
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- approval_requests
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  risk_analysis_id UUID REFERENCES public.risk_analysis(id) ON DELETE SET NULL,
  requester_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  assignee_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  risk_severity public.risk_severity NOT NULL,
  priority public.approval_priority NOT NULL DEFAULT 'p3',
  status public.approval_status NOT NULL DEFAULT 'pending',
  ai_explanation TEXT NOT NULL,
  business_justification TEXT NOT NULL,
  affected_systems TEXT[] NOT NULL DEFAULT '{}',
  affected_users TEXT[] NOT NULL DEFAULT '{}',
  compliance_impact TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  confidence_score INTEGER NOT NULL DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
  sla_deadline TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT approval_requests_title_not_empty CHECK (length(trim(title)) > 0)
);

CREATE INDEX IF NOT EXISTS approval_requests_org_status_idx
  ON public.approval_requests (organization_id, status);

CREATE INDEX IF NOT EXISTS approval_requests_org_created_idx
  ON public.approval_requests (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS approval_requests_assignee_idx
  ON public.approval_requests (assignee_id, status)
  WHERE assignee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS approval_requests_sla_idx
  ON public.approval_requests (organization_id, sla_deadline)
  WHERE status = 'pending';

DROP TRIGGER IF EXISTS approval_requests_set_updated_at ON public.approval_requests;
CREATE TRIGGER approval_requests_set_updated_at
  BEFORE UPDATE ON public.approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- approval_history
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.approval_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  approval_request_id UUID NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT approval_history_action_not_empty CHECK (length(trim(action)) > 0)
);

CREATE INDEX IF NOT EXISTS approval_history_request_idx
  ON public.approval_history (approval_request_id, created_at DESC);

CREATE INDEX IF NOT EXISTS approval_history_org_created_idx
  ON public.approval_history (organization_id, created_at DESC);

DROP TRIGGER IF EXISTS approval_history_set_updated_at ON public.approval_history;
CREATE TRIGGER approval_history_set_updated_at
  BEFORE UPDATE ON public.approval_history
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- audit_logs (append-only operational audit trail)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action public.audit_action NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_entity_type_not_empty CHECK (length(trim(entity_type)) > 0)
);

CREATE INDEX IF NOT EXISTS audit_logs_org_created_idx
  ON public.audit_logs (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_user_created_idx
  ON public.audit_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_entity_idx
  ON public.audit_logs (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS audit_logs_action_idx
  ON public.audit_logs (action, created_at DESC);

DROP TRIGGER IF EXISTS audit_logs_set_updated_at ON public.audit_logs;
CREATE TRIGGER audit_logs_set_updated_at
  BEFORE UPDATE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- notifications
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  approval_request_id UUID REFERENCES public.approval_requests(id) ON DELETE SET NULL,
  risk_analysis_id UUID REFERENCES public.risk_analysis(id) ON DELETE SET NULL,
  risk_title TEXT NOT NULL,
  risk_id TEXT,
  severity public.risk_severity NOT NULL DEFAULT 'medium',
  status public.notification_read_status NOT NULL DEFAULT 'unread',
  channel public.notification_channel NOT NULL DEFAULT 'email',
  delivery_status public.delivery_status NOT NULL DEFAULT 'pending',
  recipient TEXT NOT NULL,
  recipient_email TEXT,
  subject TEXT NOT NULL,
  preview TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  max_retries INTEGER NOT NULL DEFAULT 3 CHECK (max_retries >= 0),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_status_idx
  ON public.notifications (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_org_created_idx
  ON public.notifications (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_delivery_idx
  ON public.notifications (organization_id, delivery_status);

DROP TRIGGER IF EXISTS notifications_set_updated_at ON public.notifications;
CREATE TRIGGER notifications_set_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- subscriptions (organization billing)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan public.subscription_plan NOT NULL DEFAULT 'free',
  status public.subscription_status NOT NULL DEFAULT 'active',
  billing_interval public.billing_interval NOT NULL DEFAULT 'monthly',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  canceled_at TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_stripe_subscription_unique UNIQUE (stripe_subscription_id)
);

CREATE INDEX IF NOT EXISTS subscriptions_org_idx
  ON public.subscriptions (organization_id);

CREATE INDEX IF NOT EXISTS subscriptions_status_idx
  ON public.subscriptions (status);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_one_active_per_org_idx
  ON public.subscriptions (organization_id)
  WHERE status IN ('active', 'trialing', 'past_due');

DROP TRIGGER IF EXISTS subscriptions_set_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_set_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploaded_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Helper: is org admin/owner
CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = p_org_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
  );
$$;

-- users
DROP POLICY IF EXISTS "users_select_self" ON public.users;
DROP POLICY IF EXISTS "users_update_self" ON public.users;
DROP POLICY IF EXISTS "users_select_org_peers" ON public.users;

CREATE POLICY "users_select_self"
  ON public.users FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "users_update_self"
  ON public.users FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "users_select_org_peers"
  ON public.users FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT om.user_id
      FROM public.organization_members om
      WHERE om.organization_id IN (SELECT public.user_organization_ids())
    )
  );

-- organizations
DROP POLICY IF EXISTS "organizations_select_member" ON public.organizations;
DROP POLICY IF EXISTS "organizations_update_admin" ON public.organizations;
DROP POLICY IF EXISTS "organizations_insert_authenticated" ON public.organizations;

CREATE POLICY "organizations_select_member"
  ON public.organizations FOR SELECT TO authenticated
  USING (id IN (SELECT public.user_organization_ids()));

CREATE POLICY "organizations_insert_authenticated"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "organizations_update_admin"
  ON public.organizations FOR UPDATE TO authenticated
  USING (public.is_org_admin(id))
  WITH CHECK (public.is_org_admin(id));

-- organization_members
DROP POLICY IF EXISTS "organization_members_select" ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_insert_admin" ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_update_admin" ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_delete_admin" ON public.organization_members;

CREATE POLICY "organization_members_select"
  ON public.organization_members FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY "organization_members_insert_admin"
  ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(organization_id) OR NOT EXISTS (
    SELECT 1 FROM public.organization_members om WHERE om.organization_id = organization_members.organization_id
  ));

CREATE POLICY "organization_members_update_admin"
  ON public.organization_members FOR UPDATE TO authenticated
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));

CREATE POLICY "organization_members_delete_admin"
  ON public.organization_members FOR DELETE TO authenticated
  USING (public.is_org_admin(organization_id));

-- uploaded_logs
DROP POLICY IF EXISTS "uploaded_logs_select" ON public.uploaded_logs;
DROP POLICY IF EXISTS "uploaded_logs_insert" ON public.uploaded_logs;
DROP POLICY IF EXISTS "uploaded_logs_update" ON public.uploaded_logs;
DROP POLICY IF EXISTS "uploaded_logs_delete" ON public.uploaded_logs;

CREATE POLICY "uploaded_logs_select"
  ON public.uploaded_logs FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY "uploaded_logs_insert"
  ON public.uploaded_logs FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND user_id = auth.uid()
  );

CREATE POLICY "uploaded_logs_update"
  ON public.uploaded_logs FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY "uploaded_logs_delete"
  ON public.uploaded_logs FOR DELETE TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND (user_id = auth.uid() OR public.is_org_admin(organization_id))
  );

-- translations
DROP POLICY IF EXISTS "translations_select" ON public.translations;
DROP POLICY IF EXISTS "translations_insert" ON public.translations;
DROP POLICY IF EXISTS "translations_update" ON public.translations;
DROP POLICY IF EXISTS "translations_delete" ON public.translations;

CREATE POLICY "translations_select"
  ON public.translations FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY "translations_insert"
  ON public.translations FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND user_id = auth.uid()
  );

CREATE POLICY "translations_update"
  ON public.translations FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY "translations_delete"
  ON public.translations FOR DELETE TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND (user_id = auth.uid() OR public.is_org_admin(organization_id))
  );

-- risk_analysis
DROP POLICY IF EXISTS "risk_analysis_select" ON public.risk_analysis;
DROP POLICY IF EXISTS "risk_analysis_insert" ON public.risk_analysis;
DROP POLICY IF EXISTS "risk_analysis_update" ON public.risk_analysis;
DROP POLICY IF EXISTS "risk_analysis_delete" ON public.risk_analysis;

CREATE POLICY "risk_analysis_select"
  ON public.risk_analysis FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY "risk_analysis_insert"
  ON public.risk_analysis FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND user_id = auth.uid()
  );

CREATE POLICY "risk_analysis_update"
  ON public.risk_analysis FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY "risk_analysis_delete"
  ON public.risk_analysis FOR DELETE TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.is_org_admin(organization_id)
  );

-- approval_requests
DROP POLICY IF EXISTS "approval_requests_select" ON public.approval_requests;
DROP POLICY IF EXISTS "approval_requests_insert" ON public.approval_requests;
DROP POLICY IF EXISTS "approval_requests_update" ON public.approval_requests;
DROP POLICY IF EXISTS "approval_requests_delete" ON public.approval_requests;

CREATE POLICY "approval_requests_select"
  ON public.approval_requests FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY "approval_requests_insert"
  ON public.approval_requests FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND requester_id = auth.uid()
  );

CREATE POLICY "approval_requests_update"
  ON public.approval_requests FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY "approval_requests_delete"
  ON public.approval_requests FOR DELETE TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND public.is_org_admin(organization_id)
  );

-- approval_history
DROP POLICY IF EXISTS "approval_history_select" ON public.approval_history;
DROP POLICY IF EXISTS "approval_history_insert" ON public.approval_history;

CREATE POLICY "approval_history_select"
  ON public.approval_history FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY "approval_history_insert"
  ON public.approval_history FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND actor_id = auth.uid()
  );

-- audit_logs (insert-only for members; no update/delete from client)
DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;

CREATE POLICY "audit_logs_select"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id IN (SELECT public.user_organization_ids())
  );

CREATE POLICY "audit_logs_insert"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      organization_id IS NULL
      OR organization_id IN (SELECT public.user_organization_ids())
    )
  );

-- notifications
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;

CREATE POLICY "notifications_select"
  ON public.notifications FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND organization_id IN (SELECT public.user_organization_ids())
  );

CREATE POLICY "notifications_insert"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY "notifications_update"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "notifications_delete"
  ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_org_admin(organization_id));

-- subscriptions
DROP POLICY IF EXISTS "subscriptions_select" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_insert" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_update" ON public.subscriptions;

CREATE POLICY "subscriptions_select"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY "subscriptions_insert"
  ON public.subscriptions FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(organization_id));

CREATE POLICY "subscriptions_update"
  ON public.subscriptions FOR UPDATE TO authenticated
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));

-- =============================================================================
-- Bootstrap: create org + membership when user creates organization
-- (Application should call after INSERT into organizations)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.bootstrap_organization_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (NEW.id, auth.uid(), 'owner')
    ON CONFLICT (organization_id, user_id) DO NOTHING;

    INSERT INTO public.subscriptions (organization_id, plan, status)
    SELECT NEW.id, 'free', 'active'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.subscriptions s WHERE s.organization_id = NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizations_bootstrap_owner ON public.organizations;
CREATE TRIGGER organizations_bootstrap_owner
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.bootstrap_organization_owner();

-- =============================================================================
-- Grants
-- =============================================================================

GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
