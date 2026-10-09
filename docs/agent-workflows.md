# Agent workflows

Workflows are the editable graph for **builder agents**. They reuse `createBuilderAgent`, Safety Autopilot, and `PUT /api/v1/agents/:slug/workflow`. They do not replace Connect, Test, Deploy, Decision Agents, or templates.

## Data structure

Stored on the agent as `safety_settings.workflowState`:

```ts
{
  published: { version, nodes, edges },
  draft: { version, nodes, edges } | null,
  lastVerifiedAt,
  verificationStatus,
  versions?: [{ id, createdAt, graph, note }],
  safetyReviewedAt?: string | null,
  runs?: []
}
```

Each node has `id`, `type`, `category`, `name`, `description`, `config`, `status`, `position`, and canvas `x`/`y`.

AI nodes never execute tools. Tool nodes use the existing allowlist (`send_email`, `web_search`, …). Sample connectors (`placeholder_tool`) are display-only.

## Prompt → workflow

1. `POST /api/v1/agents/interpret` when available.
2. `generateWorkflowFromInterpretation`.
3. Lead/outreach keyword graphs from `prompt-heuristics.ts` (deterministic; not labeled as a fallback in the UI).
4. If interpret fails, the same heuristics still generate a graph.

## Adding a node type

1. Extend `WorkflowNodeType` in `lib/agents/workflow/types.ts`.
2. Add a catalog entry in `node-definitions.ts`.
3. Teach `validate-workflow.ts` if the type has extra rules (loops need `maxIterations`).
4. Style the node in `WorkflowFlowNode` / `workflow-canvas.css`.

## Activation

`POST .../workflow/publish` validates the graph server-side, snapshots a version, and refuses high-risk graphs (high-impact tools without a safety/approval node) until `POST .../workflow/review`.

Tool permission `"automatic"` cannot bypass server policy.

## Tests

```bash
npx tsx --test lib/agents/workflow/**/*.test.ts
```

No database migration for v1. JSON versions live on the agent row.
