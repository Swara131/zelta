import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SUPPORT_TICKET } from "@/lib/agents/crm/validate-ticket";
import { renderTicketResolvedWhatsApp } from "./ticket-resolved";

test("renderTicketResolvedWhatsApp includes ticket fields", () => {
  const body = renderTicketResolvedWhatsApp(DEFAULT_SUPPORT_TICKET);
  assert.match(body, /Support Ticket Resolved/);
  assert.match(body, /Jane Doe/);
  assert.match(body, /TKT-1042/);
  assert.match(body, /5\/5/);
  assert.match(body, /CRM customer record has been updated successfully/);
});
