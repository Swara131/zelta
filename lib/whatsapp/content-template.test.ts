import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SUPPORT_TICKET } from "@/lib/agents/crm/validate-ticket";
import { buildWhatsAppContentVariables } from "./content-template";

test("buildWhatsAppContentVariables defaults to single body variable", () => {
  const vars = buildWhatsAppContentVariables({ body: "Hello world" });
  assert.equal(vars["1"], "Hello world");
});

test("buildWhatsAppContentVariables maps ticket fields when mode is ticket", () => {
  const previous = process.env.TWILIO_WHATSAPP_CONTENT_MODE;
  process.env.TWILIO_WHATSAPP_CONTENT_MODE = "ticket";
  try {
    const vars = buildWhatsAppContentVariables({
      body: "ignored",
      ticket: DEFAULT_SUPPORT_TICKET,
    });
    assert.equal(vars["1"], DEFAULT_SUPPORT_TICKET.customerName);
    assert.equal(vars["2"], DEFAULT_SUPPORT_TICKET.ticketId);
    assert.equal(vars["4"], "5");
  } finally {
    if (previous === undefined) {
      delete process.env.TWILIO_WHATSAPP_CONTENT_MODE;
    } else {
      process.env.TWILIO_WHATSAPP_CONTENT_MODE = previous;
    }
  }
});
