import type { Clock } from "#modules/identity/application/ports/clock.js";
import type { EmailVerificationTokenSigner } from "#modules/identity/application/ports/email-verification-token-signer.js";

import type { EmailSender } from "#modules/outbox/application/ports/email-sender.js";
import type { EmailTemplateRenderer } from "#modules/outbox/application/ports/email-template-renderer.js";
import type { EmailVerificationRecipientRepository } from "#modules/outbox/application/ports/email-verification-recipient-repository.js";
import type { OutboxEventHandler } from "#modules/outbox/application/ports/outbox-event-handler.js";
import type { ClaimedOutboxEvent } from "#modules/outbox/application/ports/outbox-repository.js";

import { emailVerificationRequestedPayloadSchema } from "#modules/outbox/application/email-verification-requested.schema.js";

const EMAIL_VERIFICATION_EVENT_TYPE =
  "identity.email_verification_requested.v1";

export interface EmailVerificationRequestedHandlerDependencies {
  clock: Clock;
  emailSender: EmailSender;
  emailTemplateRenderer: EmailTemplateRenderer;
  recipients: EmailVerificationRecipientRepository;
  tokenSigner: EmailVerificationTokenSigner;
  buildVerificationUrl(token: string): string;
}

export class EmailVerificationRequestedHandler implements OutboxEventHandler {
  constructor(
    private readonly dependencies: EmailVerificationRequestedHandlerDependencies,
  ) {}

  async handle(event: ClaimedOutboxEvent): Promise<void> {
    if (event.eventType !== EMAIL_VERIFICATION_EVENT_TYPE) {
      throw new Error(`Unexpected outbox event type: ${event.eventType}`);
    }

    const payload = emailVerificationRequestedPayloadSchema.parse(
      event.payload,
    );

    const expiresAt = new Date(payload.expiresAt);

    if (expiresAt <= this.dependencies.clock.now()) {
      return;
    }

    const recipient = await this.dependencies.recipients.findPendingByUserId(
      payload.userId,
    );

    if (!recipient) {
      return;
    }

    const token = this.dependencies.tokenSigner.deriveToken({
      tokenId: payload.tokenId,
      userId: payload.userId,
      expiresAt: payload.expiresAt,
    });

    const verificationUrl = this.dependencies.buildVerificationUrl(token);

    const renderedEmail =
      await this.dependencies.emailTemplateRenderer.renderEmailVerification({
        firstName: recipient.firstName,
        verificationUrl,
      });

    await this.dependencies.emailSender.send({
      to: recipient.email,
      subject: "Verify your email address",
      idempotencyKey: `email-verification/${event.id}`,
      ...renderedEmail,
    });
  }
}
