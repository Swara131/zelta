export type DeveloperExampleLanguage = "typescript" | "curl" | "python";

export interface DeveloperDecisionCard {
  decision: "ALLOW" | "REVIEW" | "BLOCK";
  title: string;
  description: string;
}

export const DEVELOPER_QUICK_START = [
  {
    step: 1,
    title: "Create or select an agent",
    body: "Register your agent in Wave and create an API key bound to its agent ID.",
  },
  {
    step: 2,
    title: "Send the agent's action to Wave",
    body: "POST the proposed tool call to /api/v1/actions/propose before your agent executes it.",
  },
  {
    step: 3,
    title: "Execute only when Wave allows it",
    body: "Handle ALLOW, REVIEW, or BLOCK — poll for approval, then verify execution with a one-time token.",
  },
] as const;

export const DEVELOPER_DECISIONS: DeveloperDecisionCard[] = [
  {
    decision: "ALLOW",
    title: "Allow",
    description: "Continue with the action.",
  },
  {
    decision: "REVIEW",
    title: "Review",
    description: "Wait for human approval.",
  },
  {
    decision: "BLOCK",
    title: "Block",
    description: "Do not execute the action.",
  },
];

export interface DeveloperDocLink {
  label: string;
  href: string;
  description: string;
}

/** Only routes that exist in the app today. */
export const DEVELOPER_DOC_LINKS: DeveloperDocLink[] = [
  {
    label: "Quick Start",
    href: "/onboarding/connect",
    description: "Connect an agent to Wave step by step.",
  },
  {
    label: "My Agents",
    href: "/integrations",
    description: "Create API keys and copy integration examples.",
  },
  {
    label: "Pipeline",
    href: "/pipeline",
    description: "See how actions flow through Wave.",
  },
];

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export function buildDeveloperFlowExample(
  params: {
    baseUrl: string;
    agentId: string;
    apiKeyPlaceholder?: string;
  },
  language: DeveloperExampleLanguage
): string {
  const base = normalizeBaseUrl(params.baseUrl);
  const key = params.apiKeyPlaceholder ?? "YOUR_AGENT_API_KEY";
  const agentId = params.agentId;

  if (language === "curl") {
    return `# 1) Agent proposes an action
curl -X POST "${base}/api/v1/actions/propose" \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": "${agentId}",
    "toolName": "issue_refund",
    "actionType": "financial.refund",
    "payload": {
      "customerId": "cus_demo",
      "amount": 5000000,
      "currency": "INR"
    }
  }'

# Response includes decision: ALLOW | REVIEW | BLOCK

# 2) If REVIEW — poll until approved
curl "${base}/api/v1/actions/{proposalId}/status" \\
  -H "Authorization: Bearer ${key}"

# 3) If approved — verify before executing (one-time token)
curl -X POST "${base}/api/v1/actions/{proposalId}/verify-execution" \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "executionToken": "YOUR_EXECUTION_TOKEN",
    "toolName": "issue_refund",
    "actionType": "financial.refund",
    "payload": {
      "customerId": "cus_demo",
      "amount": 5000000,
      "currency": "INR"
    }
  }'`;
  }

  if (language === "python") {
    return `import os
import time
import requests

base_url = "${base}"
api_key = os.environ["AGENT_API_KEY"]
headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

action = {
    "agentId": "${agentId}",
    "toolName": "issue_refund",
    "actionType": "financial.refund",
    "payload": {"customerId": "cus_demo", "amount": 5_000_000, "currency": "INR"},
}

# 1) Propose — Wave checks policy + risk
proposal = requests.post(
    f"{base_url}/api/v1/actions/propose", headers=headers, json=action, timeout=30
).json()

decision = proposal["decision"]  # ALLOW | REVIEW | BLOCK
proposal_id = proposal["proposalId"]

if decision == "BLOCK":
    raise SystemExit("Blocked by Wave — do not execute.")

if decision == "REVIEW":
    # Wait for human approval, then poll status
    while True:
        status = requests.get(
            f"{base_url}/api/v1/actions/{proposal_id}/status",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=30,
        ).json()
        if status["status"] in ("rejected", "blocked", "expired"):
            raise SystemExit(f"Not approved: {status['status']}")
        if status.get("executionToken"):
            token = status["executionToken"]
            break
        time.sleep(5)
else:
    # ALLOW — poll once for execution token
    status = requests.get(
        f"{base_url}/api/v1/actions/{proposal_id}/status",
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=30,
    ).json()
    token = status["executionToken"]

# 2) Verify token, then run your tool locally
requests.post(
    f"{base_url}/api/v1/actions/{proposal_id}/verify-execution",
    headers=headers,
    json={**action, "executionToken": token},
    timeout=30,
).raise_for_status()

# 3) Safe to execute your agent tool now
print("Verified — execute the refund in your app.")`;
  }

  return `const baseUrl = "${base}";
const apiKey = process.env.AGENT_API_KEY!;

const action = {
  agentId: "${agentId}",
  toolName: "issue_refund",
  actionType: "financial.refund",
  payload: {
    customerId: "cus_demo",
    amount: 5_000_000,
    currency: "INR",
  },
};

// 1) Agent proposes action — Wave checks it
const proposeRes = await fetch(\`\${baseUrl}/api/v1/actions/propose\`, {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${apiKey}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(action),
});

const proposal = await proposeRes.json();
// { proposalId, decision: "ALLOW" | "REVIEW" | "BLOCK", status, matchedPolicies, ... }

if (proposal.decision === "BLOCK") {
  throw new Error("Blocked by Wave — do not execute.");
}

// 2) Handle decision
let executionToken: string | undefined;

if (proposal.decision === "REVIEW") {
  // Poll until a human approves and Wave issues a token
  while (!executionToken) {
    const statusRes = await fetch(
      \`\${baseUrl}/api/v1/actions/\${proposal.proposalId}/status\`,
      { headers: { Authorization: \`Bearer \${apiKey}\` } }
    );
    const status = await statusRes.json();

    if (["rejected", "blocked", "expired"].includes(status.status)) {
      throw new Error(\`Not approved: \${status.status}\`);
    }

    executionToken = status.executionToken;
    if (!executionToken) await new Promise((r) => setTimeout(r, 5000));
  }
} else {
  const statusRes = await fetch(
    \`\${baseUrl}/api/v1/actions/\${proposal.proposalId}/status\`,
    { headers: { Authorization: \`Bearer \${apiKey}\` } }
  );
  const status = await statusRes.json();
  executionToken = status.executionToken;
}

// 3) Verify before executing — binds token to exact payload
await fetch(\`\${baseUrl}/api/v1/actions/\${proposal.proposalId}/verify-execution\`, {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${apiKey}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ ...action, executionToken }),
});

// 4) Now safe to run your agent tool locally
await issueRefund(action.payload);`;
}

export const DEVELOPER_RESPONSE_EXAMPLE = `{
  "proposalId": "00000000-0000-4000-8000-000000000099",
  "status": "review_required",
  "actionHash": "abc123…",
  "decision": "REVIEW",
  "matchedPolicies": [
    {
      "policyId": "demo-refund-review-large",
      "name": "Large INR refund requires review",
      "decision": "REVIEW",
      "reason": "Refunds above 5000 INR require human review."
    }
  ]
}`;
