#!/usr/bin/env tsx
/**
 * Safe local demo agent for ApprovalLayer gateway MVP.
 * Simulates proposals only — never performs real refunds or destructive actions.
 *
 * Usage:
 *   AGENT_API_KEY=al_... npm run demo:agent -- allow
 *   AGENT_API_KEY=al_... npm run demo:agent -- review
 *   AGENT_API_KEY=al_... npm run demo:agent -- block
 *   AGENT_API_KEY=al_... npm run demo:agent -- all
 */

const BASE_URL = (process.env.APPROVALAYER_API_URL ?? "http://localhost:3000").replace(
  /\/+$/,
  ""
);
const API_KEY = process.env.AGENT_API_KEY?.trim();
const AGENT_ID = process.env.AGENT_ID?.trim() ?? "demo-refund-agent";

type ScenarioName = "allow" | "review" | "block";

interface DemoAction {
  label: string;
  toolName: string;
  actionType: string;
  payload: Record<string, unknown>;
  expectedDecision: "ALLOW" | "REVIEW" | "BLOCK";
}

const SCENARIOS: Record<ScenarioName, DemoAction> = {
  allow: {
    label: "Refund 500 INR (auto-allow)",
    toolName: "issue_refund",
    actionType: "financial.refund",
    payload: {
      customerId: "cus_demo_allow",
      amount: 50_000,
      currency: "INR",
    },
    expectedDecision: "ALLOW",
  },
  review: {
    label: "Refund 500000 INR (human review)",
    toolName: "issue_refund",
    actionType: "financial.refund",
    payload: {
      customerId: "cus_demo_review",
      amount: 50_000_000,
      currency: "INR",
    },
    expectedDecision: "REVIEW",
  },
  block: {
    label: "Delete production database (blocked)",
    toolName: "delete_database",
    actionType: "database.delete",
    payload: {
      resourceType: "database",
      environment: "production",
      destructiveOperation: true,
      productionTarget: true,
      databaseName: "demo-prod-db",
    },
    expectedDecision: "BLOCK",
  },
};

interface ProposeResponse {
  proposalId: string;
  status: string;
  actionHash: string;
  decision: string;
}

interface StatusResponse {
  proposalId: string;
  status: string;
  actionHash: string;
  executionToken?: string;
  executionTokenExpiresAt?: string;
  executionTokenIssued?: boolean;
}

interface VerifyResponse {
  allowed: boolean;
  proposalId: string;
  actionHash: string;
  consumedAt: string;
}

function requireApiKey(): void {
  if (!API_KEY) {
    console.error(
      "Missing AGENT_API_KEY. Create a key at /integrations and export it:\n" +
        "  set AGENT_API_KEY=al_...   (Windows)\n" +
        "  export AGENT_API_KEY=al_... (macOS/Linux)"
    );
    process.exit(1);
  }
}

async function gatewayFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }

  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : text || response.statusText;
    throw new Error(`${response.status} ${path}: ${message}`);
  }

  return body as T;
}

async function proposeAction(action: DemoAction): Promise<ProposeResponse> {
  return gatewayFetch<ProposeResponse>("/api/v1/actions/propose", {
    method: "POST",
    body: JSON.stringify({
      agentId: AGENT_ID,
      toolName: action.toolName,
      actionType: action.actionType,
      payload: action.payload,
    }),
  });
}

async function getStatus(proposalId: string): Promise<StatusResponse> {
  return gatewayFetch<StatusResponse>(`/api/v1/actions/${proposalId}/status`);
}

async function verifyExecution(
  proposalId: string,
  action: DemoAction,
  executionToken: string
): Promise<VerifyResponse> {
  return gatewayFetch<VerifyResponse>(`/api/v1/actions/${proposalId}/verify-execution`, {
    method: "POST",
    body: JSON.stringify({
      executionToken,
      toolName: action.toolName,
      actionType: action.actionType,
      payload: action.payload,
    }),
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollForExecutionToken(
  proposalId: string,
  maxAttempts = 60,
  intervalMs = 5000
): Promise<string> {
  console.log("\n⏳ Waiting for human approval in the dashboard (/approvals)…");

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const status = await getStatus(proposalId);
    console.log(`   Poll ${attempt}/${maxAttempts}: status=${status.status}`);

    if (status.executionToken) {
      console.log("   ✓ Received one-time execution token.");
      return status.executionToken;
    }

    if (status.status === "rejected" || status.status === "blocked") {
      throw new Error(`Proposal ended with status=${status.status}`);
    }

    if (status.status === "approved" && status.executionTokenIssued && !status.executionToken) {
      console.log("   Token already issued — create a fresh approved proposal or revoke prior token.");
    }

    await sleep(intervalMs);
  }

  throw new Error("Timed out waiting for human approval and execution token.");
}

async function simulateToolExecution(action: DemoAction): Promise<void> {
  console.log("\n🛠 Simulated tool execution (no real side effects):");
  console.log(`   tool=${action.toolName}`);
  console.log(`   actionType=${action.actionType}`);
  console.log(`   payload=${JSON.stringify(action.payload)}`);
  console.log("   ✓ Simulated execution complete — audit events recorded by gateway.");
}

async function runScenario(name: ScenarioName): Promise<boolean> {
  const action = SCENARIOS[name];
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Scenario: ${action.label}`);
  console.log(`Expected policy decision: ${action.expectedDecision}`);
  console.log("=".repeat(60));

  try {
    const proposal = await proposeAction(action);
    console.log("\n📨 Proposed action:");
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
      console.log("\n✓ BLOCK verified — execution prevented by policy.");
      return true;
    }

    if (action.expectedDecision === "REVIEW") {
      if (proposal.status !== "review_required") {
        console.error(`\n✗ Expected status review_required, got ${proposal.status}`);
        return false;
      }
      console.log("\n✓ REVIEW verified — execution paused pending human approval.");
      const token = await pollForExecutionToken(proposal.proposalId);
      const verified = await verifyExecution(proposal.proposalId, action, token);
      console.log("\n🔐 Verify execution:");
      console.log(`   allowed=${verified.allowed}`);
      console.log(`   consumedAt=${verified.consumedAt}`);
      console.log(`   actionHash=${verified.actionHash}`);

      if (!verified.allowed) {
        console.error("\n✗ Execution verification failed.");
        return false;
      }

      await simulateToolExecution(action);
      console.log("\n✓ REVIEW end-to-end flow complete.");
      return true;
    }

    // ALLOW path
    const status = await getStatus(proposal.proposalId);
    console.log("\n📊 Status check:");
    console.log(`   status=${status.status}`);

    if (status.status !== "approved") {
      console.error(`\n✗ Expected approved status for ALLOW, got ${status.status}`);
      return false;
    }

    const token = status.executionToken;
    if (!token) {
      console.error("\n✗ No execution token returned for ALLOW proposal.");
      return false;
    }

    const verified = await verifyExecution(proposal.proposalId, action, token);
    console.log("\n🔐 Verify execution:");
    console.log(`   allowed=${verified.allowed}`);

    if (!verified.allowed) {
      console.error("\n✗ Execution verification failed.");
      return false;
    }

    await simulateToolExecution(action);
    console.log("\n✓ ALLOW flow complete.");
    return true;
  } catch (err) {
    console.error("\n✗ Scenario failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

async function main(): Promise<void> {
  requireApiKey();

  const arg = (process.argv[2] ?? "all").toLowerCase() as ScenarioName | "all";

  console.log("ApprovalLayer Safe Demo Agent");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Agent ID: ${AGENT_ID}`);
  console.log("No real refunds or destructive operations are performed.\n");

  const scenarios: ScenarioName[] =
    arg === "all" ? ["allow", "block", "review"] : [arg as ScenarioName];

  if (!scenarios.every((name) => name in SCENARIOS)) {
    console.error("Usage: npm run demo:agent -- [allow|review|block|all]");
    process.exit(1);
  }

  if (arg === "all") {
    console.log(
      "Running allow and block automatically. REVIEW requires manual approval in /approvals.\n"
    );
  }

  let passed = 0;
  for (const name of scenarios) {
    const ok = await runScenario(name);
    if (ok) passed += 1;
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Results: ${passed}/${scenarios.length} scenarios passed`);
  console.log("=".repeat(60));

  process.exit(passed === scenarios.length ? 0 : 1);
}

void main();
