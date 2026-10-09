export type DemoActionId =
  | "issue_refund"
  | "send_email"
  | "delete_record"
  | "change_permissions"
  | "transfer_money"
  | "apply_discount";

export const DEMO_ACTION_IDS = [
  "issue_refund",
  "send_email",
  "delete_record",
  "change_permissions",
  "transfer_money",
  "apply_discount",
] as const satisfies readonly DemoActionId[];

export interface DemoActionDefinition {
  id: DemoActionId;
  label: string;
  description: string;
  showAmount: boolean;
  amountLabel?: string;
  amountPlaceholder?: string;
  defaultAmountInr?: number;
}

export const DEMO_SAFETY_DISCLAIMER =
  "DEMO — No real action will be executed.";

export const DEMO_AGENT_ID = "demo-customer-support-agent";
export const DEMO_AGENT_NAME = "Customer Support Agent";

export const DEMO_ACTION_CATALOG: DemoActionDefinition[] = [
  {
    id: "issue_refund",
    label: "Issue customer refund",
    description: "Refund money to a customer account.",
    showAmount: true,
    amountLabel: "Refund amount (INR)",
    amountPlaceholder: "25000",
    defaultAmountInr: 25_000,
  },
  {
    id: "send_email",
    label: "Send customer email",
    description: "Send a message to a customer inbox.",
    showAmount: false,
  },
  {
    id: "delete_record",
    label: "Delete customer record",
    description: "Remove customer data from a database.",
    showAmount: false,
  },
  {
    id: "change_permissions",
    label: "Change account permissions",
    description: "Grant or change access for a user account.",
    showAmount: false,
  },
  {
    id: "transfer_money",
    label: "Transfer money",
    description: "Move funds between accounts.",
    showAmount: true,
    amountLabel: "Transfer amount (INR)",
    amountPlaceholder: "100000",
    defaultAmountInr: 100_000,
  },
  {
    id: "apply_discount",
    label: "Give customer discount",
    description: "Apply a promotional discount to an order.",
    showAmount: true,
    amountLabel: "Discount amount (INR)",
    amountPlaceholder: "15000",
    defaultAmountInr: 15_000,
  },
];

export function getDemoAction(id: DemoActionId): DemoActionDefinition {
  const action = DEMO_ACTION_CATALOG.find((item) => item.id === id);
  if (!action) {
    throw new Error("Unknown demo action.");
  }
  return action;
}

export interface BuiltDemoActionPayload {
  toolName: string;
  actionType: string;
  payload: Record<string, unknown>;
  actionLabel: string;
  amountDisplay: string | null;
}

function formatInr(amountInr: number): string {
  return `₹${amountInr.toLocaleString("en-IN")}`;
}

function inrToPaise(amountInr: number): number {
  return Math.round(amountInr * 100);
}

/** Maps founder-friendly action choices to gateway proposal shapes. */
export function buildDemoActionPayload(
  actionId: DemoActionId,
  params: {
    customerId: string;
    reason: string;
    amountInr?: number | null;
  }
): BuiltDemoActionPayload {
  const customerId = params.customerId.trim() || "cus_demo_unknown";
  const reason = params.reason.trim();

  switch (actionId) {
    case "issue_refund": {
      const amountInr = params.amountInr ?? 25_000;
      return {
        toolName: "issue_refund",
        actionType: "financial.refund",
        payload: {
          customerId,
          amount: inrToPaise(amountInr),
          currency: "INR",
          reason,
        },
        actionLabel: "Issue Refund",
        amountDisplay: formatInr(amountInr),
      };
    }
    case "send_email":
      return {
        toolName: "send_email",
        actionType: "communication.email",
        payload: {
          customerId,
          subject: "Account update",
          body: reason || "Demo email content",
        },
        actionLabel: "Send Customer Email",
        amountDisplay: null,
      };
    case "delete_record":
      return {
        toolName: "delete_database",
        actionType: "database.delete",
        payload: {
          customerId,
          resourceType: "database",
          environment: "production",
          destructiveOperation: true,
          productionTarget: true,
          databaseName: "customer-records",
          reason,
        },
        actionLabel: "Delete Customer Record",
        amountDisplay: null,
      };
    case "change_permissions":
      return {
        toolName: "grant_permissions",
        actionType: "identity.permission",
        payload: {
          customerId,
          privilegeChange: true,
          role: "admin",
          reason,
        },
        actionLabel: "Change Account Permissions",
        amountDisplay: null,
      };
    case "transfer_money": {
      const amountInr = params.amountInr ?? 100_000;
      return {
        toolName: "transfer_funds",
        actionType: "financial.transfer",
        payload: {
          customerId,
          amount: inrToPaise(amountInr),
          currency: "INR",
          destination: "external_account",
          newDestination: true,
          reason,
        },
        actionLabel: "Transfer Money",
        amountDisplay: formatInr(amountInr),
      };
    }
    case "apply_discount": {
      const amountInr = params.amountInr ?? 15_000;
      return {
        toolName: "apply_discount",
        actionType: "financial.discount",
        payload: {
          customerId,
          amount: inrToPaise(amountInr),
          currency: "INR",
          reason,
        },
        actionLabel: "Give Customer Discount",
        amountDisplay: formatInr(amountInr),
      };
    }
  }
}
