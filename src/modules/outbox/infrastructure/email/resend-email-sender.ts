import { Resend } from "resend";

import type {
  EmailMessage,
  EmailSender,
} from "#modules/outbox/application/ports/email-sender.js";

export interface ResendEmailSenderConfig {
  from: string;
}

export class ResendEmailSender implements EmailSender {
  constructor(
    private readonly client: Resend,
    private readonly config: ResendEmailSenderConfig,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const { error } = await this.client.emails.send(
      {
        from: this.config.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      },
      {
        idempotencyKey: message.idempotencyKey,
      },
    );

    if (error) {
      throw new Error(`Resend email delivery failed: ${error.message}`);
    }
  }
}
