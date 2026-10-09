# End-to-end test checklist

Complete flow: **Create Agent → Ready → Test → Approvals → Activity**

Use description: `Send refund confirmations via email`  
Use test tool: **send_email** (default payload is fine)

---

## 1. Create agent (`/agents/create`)

| Step | Action | Expected result | Pass |
|------|--------|-----------------|------|
| 1.1 | Open `/agents/create` | Page shows "Create your first agent" with textarea | ☐ |
| 1.2 | Type: `Send refund confirmations via email` | Character count updates; Create enabled at 15+ chars | ☐ |
| 1.3 | Click **Create agent** | Loading: "Creating your agent..." | ☐ |
| 1.4 | Wait for redirect | Lands on `/agents/[id]/ready` | ☐ |
| 1.5 | Verify database (optional) | Row in `builder_agents` / `action_proposals` org scoped | ☐ |
| 1.6 | On API failure | Shows: "Could not create agent. Check your description." or generic retry message | ☐ |

---

## 2. Ready page (`/agents/[id]/ready`)

| Step | Action | Expected result | Pass |
|------|--------|-----------------|------|
| 2.1 | Page loads | "Your agent is ready!" banner with agent name | ☐ |
| 2.2 | Check copy-paste code | Shows propose API snippet with your agent ID + API key | ☐ |
| 2.3 | Click **Test my agent →** | Navigates to `/agents/[id]/test` | ☐ |

---

## 3. Test agent (`/agents/[id]/test`)

| Step | Action | Expected result | Pass |
|------|--------|-----------------|------|
| 3.1 | Tool dropdown | **send_email** selected (or choose it) | ☐ |
| 3.2 | Payload JSON | Default: `customerId`, `subject`, `message` | ☐ |
| 3.3 | Click **Run test** | Loading: "Testing your agent..." | ☐ |
| 3.4 | Timeline animates | 4 steps: propose → policy → risk → decision | ☐ |
| 3.5 | Decision shown | **ALLOW** or **REVIEW** (send_email typically **REVIEW**) | ☐ |
| 3.6 | If **REVIEW** | "View in Approvals →" link appears | ☐ |
| 3.7 | On test failure | Shows: "Could not test agent. Make sure it's configured." | ☐ |

---

## 4. Approvals tab (`/approvals`)

| Step | Action | Expected result | Pass |
|------|--------|-----------------|------|
| 4.1 | Open Approvals (from test link or nav) | Pending card: agent wants to send an email | ☐ |
| 4.2 | Card details | Customer `cus_123`, subject, risk score, Approve/Reject | ☐ |
| 4.3 | Click **Approve** | Loading: "Saving your approval..." | ☐ |
| 4.4 | After approve | "✓ Approved at [time]", buttons disabled, status **Executed** | ☐ |
| 4.5 | Click **Reject** (separate test) | "✗ Rejected at [time]", status **Blocked** | ☐ |
| 4.6 | Email (if configured) | Review email with Approve / Reject buttons | ☐ |
| 4.7 | On API failure | Toast: "Something went wrong. Try again." | ☐ |

---

## 5. Activity log (`/audit` or Activity nav)

| Step | Action | Expected result | Pass |
|------|--------|-----------------|------|
| 5.1 | Open Activity tab | List loads (not demo if agent connected) | ☐ |
| 5.2 | After approve | Entry: "[Agent] sent email to customer" | ☐ |
| 5.3 | Entry details | Status: **✓ Executed**, Decision: **Approved by you**, Risk + Time | ☐ |
| 5.4 | After reject | Status: **Blocked**, Decision: **Rejected by you** | ☐ |

---

## 6. Full happy path (one run)

```
✓ User clicks "Create Agent"
✓ User types: "Send refund confirmations via email"
✓ User clicks "Create" button
✓ Agent is created (check database)
✓ User sees "Ready to use" page
✓ User clicks "Test my agent"
✓ User sends test action (send_email)
✓ Wave scores the risk
✓ Action decision appears: Allow or Approval Required
✓ If approval required, user clicks "Approve"
✓ Approval is saved
✓ Action appears in Activity log
✓ All done! ✓
```

---

## Quick smoke commands

```bash
# Dev server
npm run dev

# Typecheck (optional)
npx tsc --noEmit
```

## Notes

- **send_email** with no matching allow rule → policy defaults to **REVIEW** → full approval path.
- **issue_refund** with amount ≤ ₹5,000 → **ALLOW** (skips Approvals).
- **issue_refund** with amount > ₹5,000 → **REVIEW** → use for approval testing without email agent.
