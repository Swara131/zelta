import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
  const eq = trimmed.indexOf("=");
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  if (!process.env[key]) process.env[key] = value;
}

const sid = process.env.TWILIO_ACCOUNT_SID;
const token = process.env.TWILIO_AUTH_TOKEN;
if (!sid || !token) {
  console.error("missing twilio creds");
  process.exit(1);
}

const auth = Buffer.from(`${sid}:${token}`).toString("base64");

async function get(url: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const json = (await response.json()) as Record<string, unknown>;
  return { status: response.status, json };
}

async function main() {
  const content = await get("https://content.twilio.com/v1/Content?PageSize=50");
  const contents = Array.isArray(content.json.contents) ? content.json.contents : [];
  console.log("CONTENT_STATUS", content.status);
  console.log("CONTENT_ERROR", JSON.stringify({
    code: content.json.code,
    message: content.json.message,
    status: content.json.status,
  }));
  console.log(
    "CONTENTS",
    JSON.stringify(
      contents.map((c: Record<string, unknown>) => ({
        sid: c.sid,
        friendly_name: c.friendly_name,
        language: c.language,
        types: Object.keys((c.types as object) || {}),
      })),
      null,
      2
    )
  );

  const messages = await get(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json?PageSize=1`
  );
  console.log("MESSAGES_STATUS", messages.status, messages.json.message ?? "ok");

  const incoming = await get(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json`
  );
  console.log("NUMBERS_STATUS", incoming.status);
  const nums = Array.isArray(incoming.json.incoming_phone_numbers)
    ? incoming.json.incoming_phone_numbers
    : [];
  console.log(
    "NUMBERS",
    JSON.stringify(
      nums.map((n: Record<string, unknown>) => ({
        phone: n.phone_number,
        sms: n.capabilities,
      })),
      null,
      2
    )
  );

  const services = await get("https://messaging.twilio.com/v1/Services?PageSize=20");
  console.log("MSG_SERVICES_STATUS", services.status);
  const serviceList = Array.isArray(services.json.services) ? services.json.services : [];
  console.log(
    "MSG_SERVICES",
    JSON.stringify(
      serviceList.map((s: Record<string, unknown>) => ({
        sid: s.sid,
        friendly_name: s.friendly_name,
      })),
      null,
      2
    )
  );
}

void main();
