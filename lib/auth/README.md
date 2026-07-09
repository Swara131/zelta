# ApprovalLayer — Supabase Authentication

## Routes

| Route | Purpose |
|-------|---------|
| `/login` | Email + Google sign in |
| `/signup` | Email + Google sign up |
| `/forgot-password` | Password reset email |
| `/auth/callback` | OAuth / email confirmation handler |
| `/auth/reset-password` | Set new password after reset link |

**Dashboard** (protected): `/upload`, `/translator`, `/risk`, `/approvals`, `/analytics`, `/notifications`, `/integrations`, `/billing`, `/pipeline`

Post-login redirect: **`/upload`**

## Supabase Dashboard setup

### Email auth
**Authentication → Providers → Email** — enable Email provider.

For **local development**, turn off **Confirm email** so signup works instantly without sending emails (avoids Supabase email rate limits during testing).

**Authentication → URL Configuration**
- Site URL: `http://localhost:3000`
- Redirect URLs:
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/auth/reset-password`

### Google OAuth
1. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Authorized redirect URI: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
3. **Supabase → Authentication → Providers → Google** — enable and paste Client ID + Secret

Add production URLs when deploying.

## File map

See project `lib/auth/` and `components/auth/` for implementation.
