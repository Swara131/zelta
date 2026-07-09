# ApprovalLayer — Production Deployment Checklist

Use this checklist when deploying to **Vercel** with **Supabase**, **Groq**, **Resend**, and **Stripe**.

---

## 1. Pre-deploy (local)

- [ ] Run `npm install` in the project root (`approvalayer/`)
- [ ] Run all Supabase migrations in order (see section 3)
- [ ] Run `npm run build` — must pass with zero TypeScript errors
- [ ] Run `npm run lint` — resolve errors before deploy
- [ ] Confirm `.env.local` works end-to-end (auth, upload, translate, risk, approvals, billing)

---

## 2. Vercel project setup

- [ ] Import the Git repository into Vercel
- [ ] Set **Root Directory** to `approvalayer` if the repo contains multiple folders
- [ ] Framework preset: **Next.js**
- [ ] Node.js version: **20.x** (recommended)
- [ ] Enable **Production** deployments on merge to main

---

## 3. Supabase

### Run migrations (SQL Editor or CLI, in order)

1. `20260701120000_log_uploads_storage.sql`
2. `20260701130000_risk_analyses.sql`
3. `20260701140000_approvalayer_core_schema.sql`
4. `20260701150000_approval_engine.sql`
5. `20260701160000_email_notifications.sql`
6. `20260701170000_audit_logging.sql`
7. `20260701180000_security_hardening.sql`

### Auth redirect URLs

In **Supabase → Authentication → URL Configuration**, add:

- **Site URL:** `https://your-domain.vercel.app`
- **Redirect URLs:**
  - `https://your-domain.vercel.app/**`
  - `http://localhost:3000/**` (for local dev)

### Storage

- [ ] Confirm bucket `log-uploads` exists and RLS policies are applied (migration 1)

---

## 4. Environment variables (Vercel → Settings → Environment Variables)

Set for **Production**, **Preview**, and **Development** as appropriate.

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only; Stripe webhooks & admin ops |
| `NEXT_PUBLIC_APP_URL` | Yes | `https://your-domain.vercel.app` (no trailing slash) |
| `GROQ_API_KEY` | Yes | Groq Console API key (server-only) |
| `RESEND_API_KEY` | Yes | Email delivery |
| `RESEND_FROM_EMAIL` | Yes | Verified sender in Resend (e.g. `ApprovalLayer <noreply@yourdomain.com>`) |
| `STRIPE_SECRET_KEY` | Yes | Live or test secret key |
| `STRIPE_WEBHOOK_SECRET` | Yes | From Stripe webhook endpoint (see section 5) |
| `STRIPE_PRICE_PROFESSIONAL_MONTHLY` | Yes | Stripe Price ID for Pro monthly |
| `STRIPE_PRICE_PROFESSIONAL_YEARLY` | Yes | Stripe Price ID for Pro yearly |
| `NOTIFICATION_RETRY_SECRET` | Recommended | Bearer token for cron retry job |

**Never** expose server secrets with the `NEXT_PUBLIC_` prefix.

---

## 5. Stripe

- [ ] Create products/prices for **Professional** (monthly + yearly)
- [ ] Copy Price IDs into `STRIPE_PRICE_PROFESSIONAL_*` env vars
- [ ] Create webhook endpoint:
  - **URL:** `https://your-domain.vercel.app/api/webhooks/stripe`
  - **Events:** `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- [ ] Copy webhook signing secret → `STRIPE_WEBHOOK_SECRET`
- [ ] Enable Stripe Customer Portal (for plan changes / cancellation)
- [ ] Test checkout flow on Preview deployment before going live

---

## 6. Resend

- [ ] Verify sending domain in Resend dashboard
- [ ] Set `RESEND_FROM_EMAIL` to a verified address on that domain
- [ ] Send a test approval/risk email from staging

---

## 7. Groq (AI Translator + Risk)

- [ ] Create API key at https://console.groq.com/keys
- [ ] Set `GROQ_API_KEY` in Vercel (never `NEXT_PUBLIC_*`)
- [ ] Optional: `GROQ_MODEL` (default `llama-3.3-70b-versatile`)
- [ ] Set usage quotas and billing alerts
- [ ] Restrict API key to server usage (do not embed in client)

---

## 8. Vercel-specific config

The repo includes `vercel.json` with:

- Extended function timeout (60s) for AI routes, Stripe webhook, and notification retry
- Hourly cron: `GET /api/notifications/retry`

### Cron authentication

Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. This app validates against `NOTIFICATION_RETRY_SECRET`.

- [ ] Set `NOTIFICATION_RETRY_SECRET` in Vercel env
- [ ] Optionally align with Vercel’s `CRON_SECRET` if you configure custom cron auth

---

## 9. Post-deploy smoke tests

- [ ] Sign up / sign in (email + OAuth if enabled)
- [ ] Upload a log file → appears in Recent Uploads
- [ ] Run Translator on uploaded log → translations saved
- [ ] Run Risk Analysis → scores and distribution render
- [ ] Generate approvals → Pending Approvals page loads live data
- [ ] Approve/reject an item → audit timeline updates
- [ ] Notifications page loads email delivery status
- [ ] Analytics dashboard loads org-scoped metrics (Pro plan)
- [ ] Billing: checkout → success redirect → subscription reflected
- [ ] Stripe webhook: verify subscription sync in Supabase

---

## 10. Security verification

- [ ] Confirm RLS enabled on all tenant tables (migration 7)
- [ ] Unauthenticated API routes return 401
- [ ] Rate limiting active on `/api/*` (middleware)
- [ ] Security headers present (`X-Frame-Options`, `X-Content-Type-Options`, etc.)
- [ ] File upload rejects invalid types / oversized files
- [ ] Stripe webhook rejects unsigned payloads

---

## 11. Performance & monitoring

- [ ] Enable Vercel Analytics (optional)
- [ ] Set up Supabase query performance monitoring
- [ ] Configure Stripe + Resend dashboard alerts
- [ ] For multi-region scale: consider Upstash Redis for distributed rate limiting

---

## 12. Accessibility (quick audit)

- [ ] Keyboard navigation works on dashboard nav and modals
- [ ] Focus visible on interactive controls
- [ ] Images/icons use `aria-hidden` where decorative
- [ ] Form inputs have associated labels
- [ ] Color contrast meets WCAG AA for primary text

---

## 13. Known limitations

| Area | Status |
|------|--------|
| Integrations page | UI only (Enterprise placeholder) |
| Slack / Teams notifications | Schema supports channels; email is implemented |
| Rate limiting | In-memory per instance (upgrade to Redis for multi-instance) |

---

## 14. Rollback plan

- [ ] Keep previous Vercel deployment promotable from dashboard
- [ ] Database migrations are forward-only — test on staging Supabase first
- [ ] Stripe webhook can be disabled without affecting existing subscriptions

---

**Deploy command (CLI):**

```bash
npx vercel --prod
```

After deploy, update `NEXT_PUBLIC_APP_URL` and Supabase redirect URLs if the production domain changed.
