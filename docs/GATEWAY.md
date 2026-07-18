# ApprovalLayer Gateway — External Agent Integration

This document describes the **existing** pre-execution gateway API for external agents. It is derived from the current codebase (`app/api/v1/actions/*`, `lib/gateway/*`).

There are **three agent-facing HTTP endpoints**. Key management uses the dashboard (session auth), not the agent Bearer token.

---

## Base URL

Set the ApprovalLayer deployment origin as your base URL:

| Environment | Example |
|-------------|---------|
| Local dev | `http://localhost:3000` |
| Production | `https://your-domain.example` |

The TypeScript client (`ApprovalLayerAgentClient`) and demo script strip trailing slashes automatically.

**Related env vars (external agent process only):**

| Variable | Required | Purpose |
|----------|----------|---------|
| `AGENT_API_KEY` | Yes | Plaintext key from `/integrations` (format `al_...`) |
| `APPROVALAYER_API_URL` | No | Base URL; defaults to `http://localhost:3000` in `scripts/demo-agent.ts` |
| `AGENT_ID` | No | Default agent id in demo script; **must match** the `agentId` in propose requests and the key binding |

The ApprovalLayer **server** requires its own Supabase/Groq configuration (see `.env.example`). External agents do not send those secrets.

---

## Authentication

All `/api/v1/*` agent routes authenticate with a **Bearer agent API key**:

```http
Authorization: Bearer al_<prefix>_<secret>
Content-Type: application/json
```

- Keys are generated with brand prefix `al` (`lib/gateway/keys/constants.ts`).
- Only a **hash** of the key is stored server-side; the plaintext is shown **once** at creation.
- The authenticated key binds requests to an `agentId` and organization. The `agentId` in `POST /propose` **must match** the key's bound agent id or the API returns **403** (`code: "agent_mismatch"`).
- `/api/v1/*` routes skip dashboard session auth (`lib/security/routes.ts`) but still enforce Bearer validation inside each route handler.

### Agent auth error codes (API `code` field)

| `code` | HTTP | Meaning |
|--------|------|---------|
| `missing_token` | 401 | No `Authorization: Bearer` header |
| `invalid_token` | 401 | Malformed or unknown key |
| `revoked_token` | 403 | Key revoked |
| `expired_token` | 403 | Key past `expiresAt` |

---

## Creating and revoking keys (`/integrations`)

Agent keys are managed in the **dashboard**, not via the agent Bearer token.

### Create a key

1. Sign in to ApprovalLayer.
2. Open **`/integrations`** (nav: **Integrate**).
3. Enter **Agent ID** (e.g. `demo-refund-agent`) and **Key name**.
4. Click **Create API key** (organization **admin** required).
5. Copy the plaintext key from the reveal banner immediately — it is **not shown again**.

**Dashboard API (session cookie auth, admin only):**

```http
POST /api/gateway/keys
Content-Type: application/json

{
  "agentId": "demo-refund-agent",
  "name": "Production refund agent",
  "expiresAt": null
}
```

**201 response** includes `plainKey` (once) and `key` metadata (prefix, id, agent id).

### Revoke a key

In **`/integrations`**, click **Revoke** on the key row.

**Dashboard API:**

```http
DELETE /api/gateway/keys/{keyUuid}
```

Revoked keys fail agent requests with `revoked_token` (**403**).

---

## API endpoints

### 1. `POST /api/v1/actions/propose`

Propose a pre-execution action. Runs deterministic policy evaluation and optional Groq enrichment (advisory only; policy is not overridden).

**Request body** (`proposeActionSchema`):

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `agentId` | string | Yes | Must match API key binding (max 128 chars) |
| `toolName` | string | Yes | Max 256 chars |
| `actionType` | string | Yes | Max 256 chars |
| `payload` | object | No | Defaults to `{}`; keys are normalized for hashing |
| `requestedBy` | string | No | Optional user UUID |
| `idempotencyKey` | string | No | Stored; dedup today is by **action hash**, not idempotency key |

**201 response** (`ProposeActionResponse`):

```json
{
  "proposalId": "uuid",
  "status": "allowed | review_required | blocked | ...",
  "actionHash": "sha256-hex",
  "decision": "ALLOW | REVIEW | BLOCK",
  "matchedPolicies": [
    {
      "policyId": "demo-refund-allow-small",
      "name": "Small INR refund auto-allow",
      "decision": "ALLOW",
      "reason": "..."
    }
  ]
}
```

**Notes:**

- Duplicate active proposals with the same `actionHash` return the existing proposal instead of creating a new row.
- Proposal expiry TTL: **24 hours** (`PROPOSAL_TTL_HOURS` in `lib/gateway/proposals/service.ts`).
- Policy rules are the built-in demo set in `lib/gateway/policy/demo-policies.ts` (not loaded from DB at runtime).

---

### 2. `GET /api/v1/actions/{proposalId}/status`

Poll proposal status and obtain a **one-time execution token** when eligible.

**200 response** (`ProposalStatusResponse`):

```json
{
  "proposalId": "uuid",
  "status": "pending | approved | rejected | blocked | expired",
  "actionHash": "sha256-hex",
  "executionToken": "et_...",
  "executionTokenExpiresAt": "ISO-8601",
  "executionTokenIssued": true
}
```

**External status mapping** (`resolveExternalProposalStatus`):

| Internal DB status | External `status` |
|--------------------|-------------------|
| `review_required`, `pending` | `pending` |
| `allowed`, `approved` | `approved` |
| `rejected` | `rejected` |
| `blocked` | `blocked` |
| `expired` or past `expiresAt` | `expired` |

**Execution token issuance:**

- Issued only when external `status === "approved"` and proposal is execution-eligible.
- Plaintext token (`et_...`) is returned **only on first issuance** for that active token.
- Subsequent polls may return `executionTokenIssued: true` with **no** `executionToken` field.
- Token TTL: **15 minutes** (`EXECUTION_TOKEN_TTL_SECONDS`).
- If an active token already exists, a new plaintext token is **not** re-sent; if the prior token was consumed and the proposal remains eligible, a **new** token may be issued on a later poll.

---

### 3. `POST /api/v1/actions/{proposalId}/verify-execution`

Verify and **atomically consume** an execution token against the exact approved action.

**Request body** (`verifyExecutionSchema`):

| Field | Type | Required |
|-------|------|----------|
| `executionToken` | string | Yes |
| `toolName` | string | Yes | Must match proposed action |
| `actionType` | string | Yes | Must match proposed action |
| `payload` | object | Yes | Must match proposed action (hash binding) |

**200 response** (`VerifyExecutionResult`):

```json
{
  "allowed": true,
  "proposalId": "uuid",
  "actionHash": "sha256-hex",
  "consumedAt": "ISO-8601"
}
```

On success the token status becomes `used`. A second verify with the same token fails with **`replayed`** (**403**).

---

## Policy lifecycles (demo rules)

Built-in demo policies (`lib/gateway/policy/demo-policies.ts`). Refund amounts use **paise** (INR × 100).

| Scenario | toolName | actionType | Payload hint | decision | status after propose |
|----------|----------|------------|--------------|----------|----------------------|
| Small refund | `issue_refund` | `financial.refund` | `amount: 50000` (₹500), `currency: "INR"` | ALLOW | `allowed` |
| Large refund | `issue_refund` | `financial.refund` | `amount: 50000001+` paise (> ₹5000) | REVIEW | `review_required` |
| Delete prod DB | `delete_database` | `database.delete` | `destructiveOperation: true`, `productionTarget: true` | BLOCK | `blocked` |

### ALLOW lifecycle

```
Agent                          Gateway
  |  POST /propose (ALLOW)        |
  |----------------------------->|
  |  201 decision=ALLOW           |
  |  status=allowed               |
  |<-----------------------------|
  |  GET /status                  |
  |----------------------------->|
  |  executionToken (et_...)      |
  |<-----------------------------|
  |  POST /verify-execution       |
  |  (token + exact action)       |
  |----------------------------->|
  |  allowed=true, consumedAt     |
  |<-----------------------------|
  |  (agent executes tool locally)|
```

1. `POST /propose` → `decision: "ALLOW"`, `status: "allowed"`.
2. `GET /status` → receive `executionToken`.
3. `POST /verify-execution` with token and **identical** `toolName`, `actionType`, `payload`.
4. Perform the real tool call in your agent **after** verify succeeds.

### REVIEW lifecycle

```
Agent                          Gateway                    Human
  |  POST /propose (REVIEW)       |                          |
  |----------------------------->|                          |
  |  201 decision=REVIEW          |                          |
  |  status=review_required       |                          |
  |<-----------------------------|                          |
  |  GET /status (poll)           |                          |
  |----------------------------->|                          |
  |  status=pending               |                          |
  |<-----------------------------|                          |
  |                               |  Email + /approvals UI   |
  |                               |<-------------------------|
  |                               |  POST /api/approvals/id  |
  |                               |  decision=approved       |
  |  GET /status                  |                          |
  |----------------------------->|                          |
  |  executionToken               |                          |
  |<-----------------------------|                          |
  |  POST /verify-execution       |                          |
  |----------------------------->|                          |
```

1. `POST /propose` → `decision: "REVIEW"`, `status: "review_required"`.
2. Poll `GET /status` → external `status: "pending"` until a human approves in **`/approvals`** (dashboard session; `POST /api/approvals/{proposalId}` with `decision: "approved"`).
3. After approval, poll until `executionToken` is returned.
4. `POST /verify-execution` as in ALLOW.

There is **no agent webhook** for approval completion — polling is required.

### BLOCK lifecycle

```
Agent                          Gateway
  |  POST /propose (BLOCK)        |
  |----------------------------->|
  |  201 decision=BLOCK           |
  |  status=blocked               |
  |<-----------------------------|
  |  (stop — no token, no verify) |
```

Blocked proposals do not receive execution tokens. `GET /status` returns external `status: "blocked"`.

---

## Action hash binding

Each proposal stores an `actionHash` computed from:

- `organizationId`, `agentId`, `toolName`, `actionType`
- **Normalized payload** (deep-sorted keys, stable JSON)

Implementation: `lib/gateway/proposals/canonicalize.ts` (`computeActionHash`).

At verify time the server recomputes the hash from your request fields. Any change to `toolName`, `actionType`, or `payload` after propose causes **`payload_mismatch`**, **`tool_mismatch`**, or **`action_type_mismatch`** (**403**).

---

## One-time execution token behavior

| Property | Value |
|----------|-------|
| Prefix | `et_` |
| TTL | 15 minutes |
| Storage | Hash only server-side |
| Plaintext | Returned once on issuance via `GET /status` |
| Consumption | Atomic on successful `POST /verify-execution` |
| Replay | Second use → `replayed` (**403**) |

---

## Error responses

Failed API calls return JSON:

```json
{
  "error": "Human-readable message",
  "code": "machine_code",
  "details": []
}
```

`details` appears on validation errors (**400**).

### HTTP status summary

| HTTP | Typical cause |
|------|----------------|
| 400 | Validation (`ValidationError`) |
| 401 | Missing/invalid agent key |
| 403 | Revoked/expired key, agent mismatch, verify denial |
| 404 | Unknown proposal or key (dashboard revoke) |
| 429 | Rate limit (`code: "rate_limit_exceeded"`) |
| 500 | Server/storage errors |

Gateway agent routes use a **strict rate limit: 30 requests/minute/IP/route** (`lib/security/rate-limit.ts`).

### Verify-execution API `code` values (`ExecutionTokenError`)

Returned with **403** unless noted:

| `code` | Meaning |
|--------|---------|
| `not_found` | Proposal not found (**404**) |
| `not_eligible` | Proposal not approved for execution |
| `expired` | Token or proposal expired |
| `replayed` | Token already consumed |
| `token_mismatch` | Invalid or unknown token |
| `payload_mismatch` | Payload hash does not match proposal |
| `tool_mismatch` | `toolName` differs from proposal |
| `action_type_mismatch` | `actionType` differs from proposal |
| `organization_mismatch` | Token org mismatch |
| `proposal_mismatch` | Token not for this proposal |
| `concurrent_use` | Atomic consume lost race |

### Propose API `code` values

| `code` | HTTP | Meaning |
|--------|------|---------|
| `agent_mismatch` | 403 | `agentId` ≠ key binding |
| `missing_token`, `invalid_token` | 401 | Auth failure |
| `revoked_token`, `expired_token` | 403 | Key unusable |

### TypeScript client error codes (`GatewayClientError`)

When using `ApprovalLayerAgentClient` (`lib/gateway/client.ts`), errors map to:

| Client `code` | Source |
|---------------|--------|
| `unauthorized` | HTTP 401 |
| `forbidden` | HTTP 403 |
| `validation_error` | HTTP 400 or bad client config |
| `not_found` | HTTP 404 |
| `rate_limit` | HTTP 429 |
| `server_error` | HTTP 5xx |
| `network_error` | Fetch failure |
| `invalid_response` | Non-JSON body |
| `poll_timeout` | `pollUntilResolved` exceeded timeout |
| `proposal_rejected` / `proposal_blocked` / `proposal_expired` | Terminal status while polling |
| `token_unavailable` | Approved but token already consumed |

The API `code` (when present) is exposed as `error.apiCode` on `GatewayClientError`.

---

## TypeScript client example

Uses `ApprovalLayerAgentClient` from `@/lib/gateway/client` (same repo). For external repos, copy the client module or call the HTTP API directly.

```typescript
import {
  ApprovalLayerAgentClient,
  GatewayClientError,
} from "@/lib/gateway/client";

const client = new ApprovalLayerAgentClient({
  baseUrl: process.env.APPROVALAYER_API_URL ?? "http://localhost:3000",
  apiKey: process.env.AGENT_API_KEY!,
  pollIntervalMs: 5_000,
  pollTimeoutMs: 300_000,
});

const action = {
  agentId: "demo-refund-agent",
  toolName: "issue_refund",
  actionType: "financial.refund",
  payload: { customerId: "cus_123", amount: 50_000, currency: "INR" },
};

try {
  const proposal = await client.propose(action);

  if (proposal.decision === "BLOCK") {
    console.log("Blocked by policy:", proposal.matchedPolicies);
    return;
  }

  let token: string;

  if (proposal.decision === "ALLOW") {
    const status = await client.getStatus(proposal.proposalId);
    if (!status.executionToken) {
      throw new Error("Expected execution token for ALLOW proposal");
    }
    token = status.executionToken;
  } else {
    // REVIEW — human must approve at /approvals while polling
    const resolved = await client.pollUntilResolved(proposal.proposalId);
    token = resolved.executionToken;
  }

  const verified = await client.verifyExecution(proposal.proposalId, {
    executionToken: token,
    toolName: action.toolName,
    actionType: action.actionType,
    payload: action.payload,
  });

  console.log("Cleared to execute:", verified.actionHash, verified.consumedAt);
  // Run your tool here — gateway does not execute it for you
} catch (err) {
  if (err instanceof GatewayClientError) {
    console.error(err.code, err.apiCode, err.message);
  }
  throw err;
}
```

---

## curl example (ALLOW — ₹500 refund)

```bash
BASE_URL="http://localhost:3000"
API_KEY="al_your_plaintext_key"
AGENT_ID="demo-refund-agent"

# 1. Propose
PROPOSE=$(curl -sS -X POST "$BASE_URL/api/v1/actions/propose" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"agentId\": \"$AGENT_ID\",
    \"toolName\": \"issue_refund\",
    \"actionType\": \"financial.refund\",
    \"payload\": { \"customerId\": \"cus_demo\", \"amount\": 50000, \"currency\": \"INR\" }
  }")

echo "$PROPOSE"
PROPOSAL_ID=$(echo "$PROPOSE" | jq -r .proposalId)

# 2. Status (execution token)
STATUS=$(curl -sS "$BASE_URL/api/v1/actions/$PROPOSAL_ID/status" \
  -H "Authorization: Bearer $API_KEY")

echo "$STATUS"
TOKEN=$(echo "$STATUS" | jq -r .executionToken)

# 3. Verify
curl -sS -X POST "$BASE_URL/api/v1/actions/$PROPOSAL_ID/verify-execution" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"executionToken\": \"$TOKEN\",
    \"toolName\": \"issue_refund\",
    \"actionType\": \"financial.refund\",
    \"payload\": { \"customerId\": \"cus_demo\", \"amount\": 50000, \"currency\": \"INR\" }
  }"
```

---

## Complete end-to-end example (REVIEW — large refund)

This matches `scripts/demo-agent.ts` `review` scenario and requires a human approver at **`/approvals`** while the agent polls.

**1. Propose ₹500,000 refund** (50,000,000 paise):

```bash
curl -sS -X POST "$BASE_URL/api/v1/actions/propose" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "demo-refund-agent",
    "toolName": "issue_refund",
    "actionType": "financial.refund",
    "payload": {
      "customerId": "cus_demo_review",
      "amount": 50000000,
      "currency": "INR"
    }
  }'
```

Expect: `"decision": "REVIEW"`, `"status": "review_required"`.

**2. Human approval (dashboard):**

- Open `http://localhost:3000/approvals`
- Find the pending gateway proposal
- Click **Approve**

**3. Agent polls for token:**

```bash
curl -sS "$BASE_URL/api/v1/actions/$PROPOSAL_ID/status" \
  -H "Authorization: Bearer $API_KEY"
```

Repeat until `"executionToken": "et_..."` appears (external `"status": "approved"`).

Or use the client:

```typescript
const resolved = await client.pollUntilResolved(proposalId);
```

**4. Verify and execute locally:**

```bash
curl -sS -X POST "$BASE_URL/api/v1/actions/$PROPOSAL_ID/verify-execution" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"executionToken\": \"$TOKEN\",
    \"toolName\": \"issue_refund\",
    \"actionType\": \"financial.refund\",
    \"payload\": {
      \"customerId\": \"cus_demo_review\",
      \"amount\": 50000000,
      \"currency\": \"INR\"
    }
  }"
```

**5. Audit (dashboard only):**

Runtime events appear at **`/audit`** → **Gateway Runtime** tab (session auth, not agent API).

---

## Local demo script

Reference CLI using `ApprovalLayerAgentClient` (same client as integrators):

**Local:**

```bash
# From approvalayer/ with dev server running (npm run dev)
set AGENT_API_KEY=al_your_key
set APPROVALAYER_API_URL=http://localhost:3000
set AGENT_ID=demo-refund-agent
npm run demo:agent -- allow
npm run demo:agent -- review   # approve at /approvals while polling
npm run demo:agent -- block
npm run demo:agent -- all
```

**Hosted gateway:**

```bash
export APPROVALAYER_API_URL=https://your-app.vercel.app
export AGENT_API_KEY=al_...
export AGENT_ID=demo-refund-agent
npm run demo:agent -- review
```

Optional: `DEMO_POLL_INTERVAL_MS` (default 5000), `DEMO_POLL_TIMEOUT_MS` (default 300000).

See `scripts/demo-agent.ts` and `.env.example`.

---

## What the gateway does not do

- **Does not execute tools** — verify only grants permission; your agent runs the side effect.
- **Does not push webhooks** to agents on approval (poll `/status`).
- **Does not expose** audit logs via agent Bearer auth.
- **Does not load** org policy rules from the `policy_rules` table (demo policies only).

---

## Source files

| Area | Path |
|------|------|
| Propose route | `app/api/v1/actions/propose/route.ts` |
| Status route | `app/api/v1/actions/[proposalId]/status/route.ts` |
| Verify route | `app/api/v1/actions/[proposalId]/verify-execution/route.ts` |
| TypeScript client | `lib/gateway/client.ts` |
| Demo policies | `lib/gateway/policy/demo-policies.ts` |
| Action hashing | `lib/gateway/proposals/canonicalize.ts` |
| Token service | `lib/gateway/tokens/service.ts` |
| Integrations UI | `components/integrations/IntegrationsPage.tsx` |
