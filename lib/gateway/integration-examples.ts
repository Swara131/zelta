export type IntegrationExampleLanguage = "curl" | "typescript" | "python";

export interface IntegrationExampleParams {
  baseUrl: string;
  agentId: string;
  apiKeyPlaceholder?: string;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export function buildProposeExamples(params: IntegrationExampleParams): Record<
  IntegrationExampleLanguage,
  string
> {
  const base = normalizeBaseUrl(params.baseUrl);
  const key = params.apiKeyPlaceholder ?? "YOUR_AGENT_API_KEY";

  return {
    curl: `curl -X POST "${base}/api/v1/actions/propose" \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": "${params.agentId}",
    "toolName": "issue_refund",
    "actionType": "financial.refund",
    "payload": {
      "customerId": "cus_demo",
      "amount": 50000,
      "currency": "INR"
    }
  }'`,

    typescript: `const baseUrl = "${base}";
const apiKey = process.env.AGENT_API_KEY!;

const response = await fetch(\`\${baseUrl}/api/v1/actions/propose\`, {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${apiKey}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    agentId: "${params.agentId}",
    toolName: "issue_refund",
    actionType: "financial.refund",
    payload: {
      customerId: "cus_demo",
      amount: 50000,
      currency: "INR",
    },
  }),
});

if (!response.ok) {
  throw new Error(await response.text());
}

const proposal = await response.json();
console.log(proposal);`,

    python: `import os
import requests

base_url = "${base}"
api_key = os.environ["AGENT_API_KEY"]

response = requests.post(
    f"{base_url}/api/v1/actions/propose",
    headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    },
    json={
        "agentId": "${params.agentId}",
        "toolName": "issue_refund",
        "actionType": "financial.refund",
        "payload": {
            "customerId": "cus_demo",
            "amount": 50000,
            "currency": "INR",
        },
    },
    timeout=30,
)
response.raise_for_status()
print(response.json())`,
  };
}

export function buildStatusExamples(
  params: IntegrationExampleParams & { proposalId: string }
): Record<IntegrationExampleLanguage, string> {
  const base = normalizeBaseUrl(params.baseUrl);
  const key = params.apiKeyPlaceholder ?? "YOUR_AGENT_API_KEY";

  return {
    curl: `curl "${base}/api/v1/actions/${params.proposalId}/status" \\
  -H "Authorization: Bearer ${key}"`,

    typescript: `const response = await fetch(
  \`\${baseUrl}/api/v1/actions/${params.proposalId}/status\`,
  { headers: { Authorization: \`Bearer \${apiKey}\` } }
);
const status = await response.json();
console.log(status.executionToken); // shown once when newly issued`,

    python: `response = requests.get(
    f"{base_url}/api/v1/actions/${params.proposalId}/status",
    headers={"Authorization": f"Bearer {api_key}"},
    timeout=30,
)
response.raise_for_status()
print(response.json())`,
  };
}

export function buildVerifyExamples(
  params: IntegrationExampleParams & { proposalId: string }
): Record<IntegrationExampleLanguage, string> {
  const base = normalizeBaseUrl(params.baseUrl);
  const key = params.apiKeyPlaceholder ?? "YOUR_AGENT_API_KEY";

  return {
    curl: `curl -X POST "${base}/api/v1/actions/${params.proposalId}/verify-execution" \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "executionToken": "YOUR_EXECUTION_TOKEN",
    "toolName": "issue_refund",
    "actionType": "financial.refund",
    "payload": {
      "customerId": "cus_demo",
      "amount": 50000,
      "currency": "INR"
    }
  }'`,

    typescript: `const response = await fetch(
  \`\${baseUrl}/api/v1/actions/${params.proposalId}/verify-execution\`,
  {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${apiKey}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      executionToken: executionToken,
      toolName: "issue_refund",
      actionType: "financial.refund",
      payload: {
        customerId: "cus_demo",
        amount: 50000,
        currency: "INR",
      },
    }),
  }
);`,

    python: `response = requests.post(
    f"{base_url}/api/v1/actions/${params.proposalId}/verify-execution",
    headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    },
    json={
        "executionToken": execution_token,
        "toolName": "issue_refund",
        "actionType": "financial.refund",
        "payload": {
            "customerId": "cus_demo",
            "amount": 50000,
            "currency": "INR",
        },
    },
    timeout=30,
)
response.raise_for_status()
print(response.json())`,
  };
}
