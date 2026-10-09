export interface SupportTicketInput {
  ticketId: string;
  customerId: string;
  customerName: string;
  resolutionDetails: string;
  satisfactionRating: number;
}

export interface CrmUpdateResult {
  success: boolean;
  updateId?: string;
  error?: string;
  ticket?: SupportTicketInput;
}

export interface WhatsAppNotifyResult {
  success: boolean;
  messageId?: string;
  error?: string;
  recipientMasked?: string;
}

export interface CrmWhatsAppFlowResult {
  crm: CrmUpdateResult;
  whatsapp: WhatsAppNotifyResult | null;
}
