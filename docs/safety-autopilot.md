# Wave Safety Autopilot

Per-agent safety configuration at `/agents/[agentId]/safety` (alias: `/dashboard/agents/[agentId]/safety`).

## Safety score calculation

Score starts at **100** and is derived from saved configuration (never hardcoded):

| Factor | Max deduction |
|--------|----------------|
| Automatic / high-impact tool permissions | 35 |
| Disabled data & prompt protections | 25 |
| Disabled approval rules | 20 |
| Missing or loose execution limits | 20 |

Small bonus (+5) when **Safe** mode is active with all protections enabled.

**Status labels:**

- **75–100** → Protected
- **50–74** → Needs Attention
- **0–49** → High Risk

Implementation: `lib/safety/autopilot/evaluate-safety-policy.ts`

## Protection presets

| Preset | Behavior |
|--------|----------|
| **Safe** | Approvals for external actions, read-only tools, low budgets |
| **Balanced** | Default — approval for high-impact actions, limited writes |
| **Autonomous** | Fewer approvals, strict limits, full logging, emergency shutdown |

Switching to a higher-risk preset requires explicit confirmation in the UI.

## Approval workflow

Approval rules are stored per agent. When the runtime requests an action that matches an enabled rule (or exceeds a threshold), Wave returns `REQUIRE_APPROVAL` and surfaces the action in Approvals.

Policy summaries are generated from saved rules, e.g.:

> Wave will ask for approval before sending messages to more than 20 recipients.

## Emergency controls

Available on the Safety page (authorized workspace members only):

- **Pause / Resume agent** — updates agent status and schedule
- **Revoke all permissions** — sets every integration to Disabled (audit logged)
- **Kill active runs** — cancels pending/running/awaiting runs

Each action writes to `audit_logs` and `safety_incidents` (when migrated).

## Data storage

- **Policy config** (mode, permissions, rules, limits, data protection): `agents.safety_settings.autopilot` JSON
- **Normalized tables** (optional sync target): `agent_safety_policies`, `agent_tool_permissions`, `agent_approval_rules`, `agent_execution_limits`
- **Activity timeline**: `safety_incidents` (falls back to labeled sample data if empty)

## Connecting real agent runtime events

1. On each tool call, invoke `checkExecutionLimits()` from `lib/safety/autopilot/enforce-limits.ts`.
2. On limit violation, block the run and call `insertSafetyIncident()` with `isSample: false`.
3. On policy decisions, call existing `recordSafetyDecisionAudit()` in `lib/safety/audit.ts`.
4. Map runtime tool names to autopilot catalog IDs via `lib/safety/autopilot/tools-catalog.ts`.

## Migration

Apply `supabase/migrations/20260926120000_agent_safety_autopilot.sql` in the Supabase SQL Editor or via `supabase db push`.

The feature works without migration (JSON storage + sample timeline); migration enables persistent incident history.
