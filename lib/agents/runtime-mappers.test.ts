import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mapAgentActionRow,
  mapAgentRow,
  mapAgentRunRow,
  mapAgentScheduleRow,
  mapToolExecutionRow,
} from "./runtime-mappers";

describe("runtime mappers", () => {
  it("maps extended agent row with runtime defaults", () => {
    const mapped = mapAgentRow({
      id: "11111111-1111-4111-8111-111111111111",
      user_id: "22222222-2222-4222-8222-222222222222",
      organization_id: "33333333-3333-4333-8333-333333333333",
      name: "Founder Engagement Agent",
      slug: "founder-engagement-agent",
      description: "Find AI founder posts on X",
      goal: "Engage with AI founders",
      instructions: "Be thoughtful and concise",
      model: "grok-2",
      source: "zelta-builder",
      tools: ["search_x", "post_x"],
      capabilities: [{ id: "search_x", label: "Search X", enabled: true }],
      trigger_type: "schedule",
      schedule: { when: "daily", time: "09:00" },
      timezone: "Asia/Kolkata",
      memory_enabled: true,
      safety_settings: { requireApprovalFor: ["post_x"] },
      suggested_threshold: 5000,
      status: "draft",
      published_at: null,
      created_at: "2026-09-15T00:00:00.000Z",
      updated_at: "2026-09-15T00:00:00.000Z",
    });

    assert.equal(mapped.slug, "founder-engagement-agent");
    assert.equal(mapped.goal, "Engage with AI founders");
    assert.equal(mapped.tools.length, 2);
    assert.equal(mapped.capabilities[0]?.label, "Search X");
    assert.equal(mapped.timezone, "Asia/Kolkata");
    assert.equal(mapped.memoryEnabled, true);
    assert.deepEqual(mapped.safetySettings.requireApprovalFor, ["post_x"]);
  });

  it("maps agent run and action rows", () => {
    const run = mapAgentRunRow({
      id: "44444444-4444-4444-8444-444444444444",
      agent_id: "11111111-1111-4111-8111-111111111111",
      user_id: "22222222-2222-4222-8222-222222222222",
      organization_id: "33333333-3333-4333-8333-333333333333",
      status: "running",
      mode: "test",
      trigger_source: "dashboard",
      summary: null,
      error_message: null,
      limits: { maxToolCalls: 10 },
      metadata: {},
      started_at: "2026-09-15T09:00:00.000Z",
      finished_at: null,
      created_at: "2026-09-15T09:00:00.000Z",
      updated_at: "2026-09-15T09:00:00.000Z",
    });

    assert.equal(run.mode, "test");
    assert.equal(run.limits.maxToolCalls, 10);

    const action = mapAgentActionRow({
      id: "55555555-5555-4555-8555-555555555555",
      agent_run_id: run.id,
      agent_id: "11111111-1111-4111-8111-111111111111",
      user_id: "22222222-2222-4222-8222-222222222222",
      organization_id: "33333333-3333-4333-8333-333333333333",
      action_proposal_id: "66666666-6666-4666-8666-666666666666",
      sequence: 1,
      tool_name: "send_email",
      action_type: "communication.email",
      summary: "Send refund confirmation",
      status: "review_required",
      policy_decision: "review",
      metadata: {},
      created_at: "2026-09-15T09:01:00.000Z",
      updated_at: "2026-09-15T09:01:00.000Z",
    });

    assert.equal(action.actionProposalId, "66666666-6666-4666-8666-666666666666");
    assert.equal(action.status, "review_required");
  });

  it("maps schedule and tool execution rows", () => {
    const schedule = mapAgentScheduleRow({
      id: "77777777-7777-4777-8777-777777777777",
      agent_id: "11111111-1111-4111-8111-111111111111",
      user_id: "22222222-2222-4222-8222-222222222222",
      organization_id: "33333333-3333-4333-8333-333333333333",
      frequency: "daily",
      timezone: "UTC",
      schedule_config: { time: "09:00" },
      cron_expression: "0 9 * * *",
      next_run_at: "2026-09-16T09:00:00.000Z",
      last_run_at: null,
      enabled: true,
      created_at: "2026-09-15T00:00:00.000Z",
      updated_at: "2026-09-15T00:00:00.000Z",
    });

    assert.equal(schedule.frequency, "daily");
    assert.equal(schedule.enabled, true);

    const execution = mapToolExecutionRow({
      id: "88888888-8888-4888-8888-888888888888",
      agent_run_id: "44444444-4444-4444-8444-444444444444",
      agent_action_id: "55555555-5555-4555-8555-555555555555",
      action_proposal_id: "66666666-6666-4666-8666-666666666666",
      agent_id: "11111111-1111-4111-8111-111111111111",
      user_id: "22222222-2222-4222-8222-222222222222",
      organization_id: "33333333-3333-4333-8333-333333333333",
      tool_name: "send_email",
      status: "succeeded",
      input: { customerId: "cus_123" },
      output: { ok: true },
      error: null,
      started_at: "2026-09-15T09:02:00.000Z",
      finished_at: "2026-09-15T09:02:01.000Z",
      created_at: "2026-09-15T09:02:00.000Z",
      updated_at: "2026-09-15T09:02:01.000Z",
    });

    assert.equal(execution.status, "succeeded");
    assert.equal(execution.input.customerId, "cus_123");
  });
});
