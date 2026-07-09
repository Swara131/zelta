# ApprovalLayer — Supabase Database

## Migrations (run in order)

| File | Purpose |
|------|---------|
| `20260701120000_log_uploads_storage.sql` | Storage bucket `log-uploads` + RLS |
| `20260701130000_risk_analyses.sql` | **Legacy** API tables (`translator_sessions`, `risk_analyses`) |
| `20260701140000_approvalayer_core_schema.sql` | **Production schema** (this document) |

## Apply

**Supabase Dashboard → SQL Editor** — paste and run each migration file in order.

Or with CLI:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

## Entity relationship overview

```
auth.users
    └── users (1:1 profile)
            └── organization_members ──► organizations
                                              ├── uploaded_logs
                                              ├── translations
                                              ├── risk_analysis
                                              ├── approval_requests ──► approval_history
                                              ├── notifications
                                              ├── subscriptions
                                              └── audit_logs
```

## Tables

### `users`
Extends `auth.users`. Auto-created on signup via trigger.

### `organizations`
Multi-tenant root. Creating an org auto-adds creator as `owner` and a `free` subscription.

### `organization_members`
Join table (required for org-scoped RLS). Roles: `owner`, `admin`, `member`, `viewer`.

### `uploaded_logs`
Log files in Supabase Storage. Links to `storage_path`, `filename`, `status`, `risk_score`.

### `translations`
One row per translated log line (Gemini output fields).

### `risk_analysis`
Gemini risk report: scores, `distribution` JSONB, `risks` JSONB.

### `approval_requests`
Human-in-the-loop approvals with SLA, timeline JSONB, severity/priority.

### `approval_history`
Immutable-style action log per approval (who did what, when).

### `audit_logs`
Platform audit trail (entity type/id, action enum, metadata).

### `notifications`
Email/Slack/Teams alerts with delivery status.

### `subscriptions`
Org billing (Stripe IDs, plan, interval, period dates).

## RLS model

- All tenant data is scoped by `organization_id`.
- Users access rows only for orgs they belong to (`user_organization_ids()`).
- Admins/owners can manage members, subscriptions, and destructive ops.
- Notifications are user-private (`user_id = auth.uid()`).
- Audit logs: members can insert; select limited to their orgs.

## After migration

1. Regenerate TypeScript types:
   ```bash
   npx supabase gen types typescript --project-id YOUR_PROJECT_REF > lib/supabase/database.types.ts
   ```
2. Backfill `public.users` for existing auth users:
   ```sql
   INSERT INTO public.users (id, email)
   SELECT id, email FROM auth.users
   ON CONFLICT (id) DO NOTHING;
   ```
3. Create an organization for each user (app flow) or manually for testing.

## Legacy note

Existing API routes use `translator_sessions` and `risk_analyses` from migration `130000`.
The new canonical tables are `translations` and `risk_analysis`.
Migrate application code when ready — frontend unchanged for now.
