-- Runtime agent run + delivery audit event types

ALTER TYPE public.gateway_audit_event_type ADD VALUE IF NOT EXISTS 'runtime_run_started';
ALTER TYPE public.gateway_audit_event_type ADD VALUE IF NOT EXISTS 'runtime_run_finished';
ALTER TYPE public.gateway_audit_event_type ADD VALUE IF NOT EXISTS 'runtime_delivery_started';
ALTER TYPE public.gateway_audit_event_type ADD VALUE IF NOT EXISTS 'runtime_delivery_sent';
ALTER TYPE public.gateway_audit_event_type ADD VALUE IF NOT EXISTS 'runtime_delivery_failed';

NOTIFY pgrst, 'reload schema';
