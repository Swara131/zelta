import { Resend } from "resend";
import { getResendApiKey, getResendFromEmail } from "./env";

export class EmailSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailSendError";
  }
}

let resendClient: Resend | undefined;

function getClient(): Resend {
  if (!resendClient) {
    resendClient = new Resend(getResendApiKey());
  }
  return resendClient;
}

export async function sendHtmlEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ messageId: string }> {
  const { data, error } = await getClient().emails.send({
    from: getResendFromEmail(),
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  if (error) {
    throw new EmailSendError(error.message);
  }

  if (!data?.id) {
    throw new EmailSendError("Resend did not return a message id.");
  }

  return { messageId: data.id };
}
