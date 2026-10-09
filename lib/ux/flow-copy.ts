/** Shared copy for the create → test → approve → activity flow. */

export const FLOW_LOADING = {
  creatingAgent: "Creating your agent...",
  interpretingAgent: "Understanding your request...",
  testingAgent: "Testing your agent...",
  savingApproval: "Saving your approval...",
} as const;

export const FLOW_ERRORS = {
  genericApi: "Something went wrong. Try again.",
  createAgent: "Could not create agent. Check your description.",
  testAgent: "Could not test agent. Make sure it's configured.",
  loadApprovals: "Something went wrong. Try again.",
  saveApproval: "Something went wrong. Try again.",
} as const;
