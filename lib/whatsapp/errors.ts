export class WhatsAppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WhatsAppError";
  }
}

export class WhatsAppPhoneError extends WhatsAppError {
  constructor(message: string) {
    super(message);
    this.name = "WhatsAppPhoneError";
  }
}

export class WhatsAppVerificationError extends WhatsAppError {
  constructor(message: string) {
    super(message);
    this.name = "WhatsAppVerificationError";
  }
}

export class WhatsAppSendError extends WhatsAppError {
  constructor(message: string) {
    super(message);
    this.name = "WhatsAppSendError";
  }
}
