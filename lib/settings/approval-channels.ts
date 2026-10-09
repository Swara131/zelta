import { formatIndianPhoneDisplay, maskIndianPhone } from "@/lib/whatsapp/phone";

export interface ApprovalChannelPreferences {
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  dashboardEnabled: boolean;
  whatsappPhoneE164: string | null;
  whatsappPhoneDisplay: string | null;
  whatsappPhoneMasked: string | null;
  whatsappVerified: boolean;
  whatsappVerifiedAt: string | null;
}

export interface ApprovalChannelPreferencesRow {
  approval_email_enabled: boolean;
  approval_whatsapp_enabled: boolean;
  approval_dashboard_enabled: boolean;
  whatsapp_phone_e164: string | null;
  whatsapp_phone_verified_at: string | null;
}

export function mapApprovalChannelPreferences(
  row: ApprovalChannelPreferencesRow | null | undefined
): ApprovalChannelPreferences {
  const phone = row?.whatsapp_phone_e164 ?? null;
  const verified = Boolean(row?.whatsapp_phone_verified_at && phone);

  return {
    emailEnabled: row?.approval_email_enabled ?? true,
    whatsappEnabled: verified ? (row?.approval_whatsapp_enabled ?? false) : false,
    dashboardEnabled: row?.approval_dashboard_enabled ?? true,
    whatsappPhoneE164: phone,
    whatsappPhoneDisplay:
      phone && verified
        ? (() => {
            try {
              return formatIndianPhoneDisplay(phone);
            } catch {
              return phone;
            }
          })()
        : null,
    whatsappPhoneMasked:
      phone && verified
        ? (() => {
            try {
              return maskIndianPhone(phone);
            } catch {
              return phone;
            }
          })()
        : null,
    whatsappVerified: verified,
    whatsappVerifiedAt: row?.whatsapp_phone_verified_at ?? null,
  };
}

export const APPROVAL_CHANNEL_COPY = {
  sectionTitle: "Approval channels",
  sectionLead: "Choose how you want to be notified when an agent action needs your approval.",
  emailLabel: "Email",
  emailHint: "Approval links sent to your inbox",
  whatsappLabel: "WhatsApp",
  whatsappHint: "Instant mobile alerts — India-first",
  dashboardLabel: "Dashboard",
  dashboardHint: "In-app only on the Approvals page",
  whatsappSetupTitle: "Connect WhatsApp",
  whatsappSetupLead: "Enter your Indian mobile number. We will send a verification code on WhatsApp.",
  whatsappVerifiedLabel: "Verified number",
} as const;
