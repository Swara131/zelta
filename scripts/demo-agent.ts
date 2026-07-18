#!/usr/bin/env tsx
/**
 * Safe demo agent for ApprovalLayer gateway integration.
 * Uses ApprovalLayerAgentClient — no raw gateway HTTP calls.
 * Simulates tool execution only; never performs real refunds or destructive actions.
 *
 * Usage:
 *   AGENT_API_KEY=al_... npm run demo:agent -- allow
 *   AGENT_API_KEY=al_... npm run demo:agent -- review
 *   AGENT_API_KEY=al_... npm run demo:agent -- block
 *   AGENT_API_KEY=al_... npm run demo:agent -- all
 *
 * Hosted gateway:
 *   APPROVALAYER_API_URL=https://your-app.example AGENT_API_KEY=al_... npm run demo:agent -- allow
 */

import {
  ApprovalLayerAgentClient,
  GatewayClientError,
} from "@/lib/gateway/client";
import type { ProposeActionInput } from "@/lib/gateway/proposals/types";

const BASE_URL = process.env.APPROVALAYER_API_URL?.trim() ?? "http://localhost:3000";
const API_KEY = process.env.AGENT_API_KEY?.trim();
const AGENT_ID = process.env.AGENT_ID?.trim() ?? "demo-refund-agent";
const POLL_INTERVAL_MS = Number(process.env.DEMO_POLL_INTERVAL_MS ?? "5000");
const POLL_TIMEOUT_MS = Number(process.env.DEMO_POLL_TIMEOUT_MS ?? "300000");

type ScenarioName = "allow" | "review" | "block";

interface DemoAction {
  label: string;
  propose: ProposeActionInput;
  expectedDecision: "ALLOW" | "REVIEW" | "BLOCK";
}

const SCENARIOS: Record<ScenarioName, DemoAction> = {
  allow: {
    label: "Low-risk refund ₹500 (policy: ALLOW)",
    expectedDecision: "ALLOW",
    propose: {
      agentId: AGENT_ID,
      toolName: "issue_refund",
      actionType: "financial.refund",
      payload: {
        customerId: "cus_demo_allow",
        amount: 50_000,
        currency: "INR",
      },
    },
  },
  review: {
    label: "High-risk refund ₹500,000 (policy: REVIEW)",
    expectedDecision: "REVIEW",
    propose: {
      agentId: AGENT_ID,
      toolName: "issue_refund",
      actionType: "financial.refund",
      payload: {
        customerId: "cus_demo_review",
        amount: 50_000_000,
        currency: "INR",
      },
    },
  },
  block: {
    label: "Delete production database (policy: BLOCK)",
    expectedDecision: "BLOCK",
    propose: {
      agentId: AGENT_ID,
      toolName: "delete_database",
      actionType: "database.delete",
      payload: {
        resourceType: "database",
        environment: "production",
        destructiveOperation: true,
        productionTarget: true,
        databaseName: "demo-prod-db",
      },
    },
  },
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function requireApiKey(): void {
  if (!API_KEY) {
    console.error(
      "Missing AGENT_API_KEY. Create a key at /integrations and export it:\n" +
        "  set AGENT_API_KEY=al_...        (Windows PowerShell/cmd)\n" +
        "  export AGENT_API_KEY=al_...     (macOS/Linux)\n\n" +
        "Optional:\n" +
        "  APPROVALAYER_API_URL=http://localhost:3000  (default)\n" +
        "  AGENT_ID=demo-refund-agent                  (must match key binding)"
    );
    process.exit(1);
  }
}

function createClient(): ApprovalLayerAgentClient {
  return new ApprovalLayerAgentClient({
    baseUrl: BASE_URL,
    apiKey: API_KEY!,
    pollIntervalMs: POLL_INTERVAL_MS,
    pollTimeoutMs: POLL_TIMEOUT_MS,
  });
}

function formatError(err: unknown): string {
  if (err instanceof GatewayClientError) {
    const parts = [err.message];
    if (err.apiCode) {
      parts.push(`apiCode=${err.apiCode}`);
    }
    parts.push(`clientCode=${err.code}`);

    if (err.code === "poll_timeout") {
      parts.push(
        `\nTimed out after ${Math.round(POLL_TIMEOUT_MS / 1000)}s.`,
        `Open ${BASE_URL.replace(/\/+$/, "")}/approvals and approve the REVIEW proposal,`,
        "then re-run: npm run demo:agent -- review"
      );
    }

    if (err.code === "network_error") {
      parts.push(
        `\nCould not reach ${BASE_URL}.`,
        "Ensure ApprovalLayer is running (npm run dev) or APPROVALAYER_API_URL points to your deployment."
      );
    }

    return parts.join("\n   ");
  }

  return err instanceof Error ? err.message : String(err);
}

async function pollForReviewApproval(
  client: ApprovalLayerAgentClient,
  proposalId: string
): Promise<string> {
  const approvalsUrl = `${BASE_URL.replace(/\/+$/, "")}/approvals`;

  console.log("\n⏳ Step 2 — Human approval required (REVIEW policy)");
  console.log("   Policy paused execution until a human approves this action.");
  console.log(`   → Open ${approvalsUrl}`);
  console.log("   → Find this proposal and click Approve");
  console.log("   → This agent will poll until a one-time execution token is issued\n");

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let attempt = 0;

  while (Date.now() <= deadline) {
    attempt += 1;
    const status = await client.getStatus(proposalId);
    console.log(`   Poll #${attempt}: status=${status.status}`);

    if (status.executionToken) {
      console.log("   ✓ Received one-time execution token (et_...).");
      return status.executionToken;
    }

    if (
      status.status === "rejected" ||
      status.status === "blocked" ||
      status.status === "expired"
    ) {
      throw new GatewayClientError({
        code:
          status.status === "rejected"
            ? "proposal_rejected"
            : status.status === "blocked"
              ? "proposal_blocked"
              : "proposal_expired",
        message: `Proposal ${proposalId} ended with status=${status.status} before approval.`,
        status: 200,
      });
    }

    if (status.status === "executed") {
      throw new Error(
        "Proposal is already executed. Create a fresh REVIEW demo (new propose) before polling."
      );
    }

    if (
      status.status === "approved" &&
      status.executionTokenIssued &&
      !status.executionToken
    ) {
      throw new GatewayClientError({
        code: "token_unavailable",
        message:
          "Proposal is approved but no execution token is available (likely already consumed). Re-run the REVIEW scenario with a new propose.",
        status: 200,
      });
    }

    if (Date.now() + POLL_INTERVAL_MS > deadline) {
      break;
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new GatewayClientError({
    code: "poll_timeout",
    message: `Timed out after ${POLL_TIMEOUT_MS}ms waiting for human approval on proposal ${proposalId}.`,
    status: 0,
  });
}

async function verifyAndSimulate(
  client: ApprovalLayerAgentClient,
  proposalId: string,
  action: DemoAction,
  executionToken: string
): Promise<boolean> {
  console.log("\n🔐 Step 3 — Verify execution token (gateway gate before side effects)");

  const verified = await client.verifyExecution(proposalId, {
    executionToken,
    toolName: action.propose.toolName,
    actionType: action.propose.actionType,
    payload: action.propose.payload ?? {},
  });

  console.log(`   allowed=${verified.allowed}`);
  console.log(`   actionHash=${verified.actionHash}`);
  console.log(`   consumedAt=${verified.consumedAt}`);

  if (!verified.allowed) {
    console.error("\n✗ Execution verification failed.");
    return false;
  }

  console.log("\n🛠 Step 4 — Simulated tool execution (no real side effects)");
  console.log(`   tool=${action.propose.toolName}`);
  console.log(`   actionType=${action.propose.actionType}`);
  console.log(`   payload=${JSON.stringify(action.propose.payload)}`);
  console.log("   ✓ Simulated execution complete — gateway recorded audit events.");

  return true;
}

async function runScenario(
  client: ApprovalLayerAgentClient,
  name: ScenarioName
): Promise<boolean> {
  const action = SCENARIOS[name];

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Scenario: ${action.label}`);
  console.log(`Expected policy decision: ${action.expectedDecision}`);
  console.log("=".repeat(60));

  try {
    console.log("\n📨 Step 1 — Propose action to gateway");

    const proposal = await client.propose(action.propose);

    console.log(`   proposalId=${proposal.proposalId}`);
    console.log(`   status=${proposal.status}`);
    console.log(`   decision=${proposal.decision}`);
    console.log(`   actionHash=${proposal.actionHash}`);

    if (proposal.decision !== action.expectedDecision) {
      console.error(
        `\n✗ Expected decision ${action.expectedDecision}, got ${proposal.decision}`
      );
      return false;
    }

    if (action.expectedDecision === "BLOCK") {
      console.log("\n🛑 BLOCK — gateway denied execution. No token issued, no verify, no tool run.");
      console.log("✓ BLOCK scenario complete.");
      return true;
    }

    let executionToken: string;

    if (action.expectedDecision === "REVIEW") {
      if (proposal.status !== "review_required") {
        console.error(`\n✗ Expected status review_required, got ${proposal.status}`);
        return false;
      }

      console.log("\n✓ REVIEW — proposal held for human approval.");
      executionToken = await pollForReviewApproval(client, proposal.proposalId);
    } else {
      console.log("\n📊 Step 2 — Fetch execution token (ALLOW policy)");

      const status = await client.getStatus(proposal.proposalId);
      console.log(`   status=${status.status}`);

      if (status.status !== "approved") {
        console.error(`\n✗ Expected approved status for ALLOW, got ${status.status}`);
        return false;
      }

      if (!status.executionToken) {
        console.error("\n✗ No execution token returned for ALLOW proposal.");
        return false;
      }

      console.log("   ✓ Received one-time execution token (et_...).");
      executionToken = status.executionToken;
    }

    const ok = await verifyAndSimulate(client, proposal.proposalId, action, executionToken);
    if (!ok) {
      return false;
    }

    console.log(`\n✓ ${action.expectedDecision} scenario complete.`);
    return true;
  } catch (err) {
    console.error("\n✗ Scenario failed:");
    console.error(`   ${formatError(err)}`);
    return false;
  }
}

async function main(): Promise<void> {
  requireApiKey();

  const arg = (process.argv[2] ?? "all").toLowerCase() as ScenarioName | "all";

  if (arg !== "all" && !(arg in SCENARIOS)) {
    console.error("Usage: npm run demo:agent -- [allow|review|block|all]");
    process.exit(1);
  }

  const client = createClient();

  console.log("ApprovalLayer Demo Agent");
  console.log(`Gateway:  ${BASE_URL}`);
  console.log(`Agent ID: ${AGENT_ID}`);
  console.log(`Poll:     every ${POLL_INTERVAL_MS}ms, timeout ${Math.round(POLL_TIMEOUT_MS / 1000)}s`);
  console.log("Uses ApprovalLayerAgentClient — no real refunds or destructive operations.\n");

  const scenarios: ScenarioName[] =
    arg === "all" ? ["allow", "block", "review"] : [arg];

  if (arg === "all") {
    console.log(
      "Running allow + block automatically. REVIEW waits for you at /approvals.\n"
    );
  }

  let passed = 0;
  for (const name of scenarios) {
    const ok = await runScenario(client, name);
    if (ok) passed += 1;
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Results: ${passed}/${scenarios.length} scenarios passed`);
  console.log("=".repeat(60));

  process.exit(passed === scenarios.length ? 0 : 1);
}

void main();
