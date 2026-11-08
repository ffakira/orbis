import { passwordResetRequestedPayloadSchema } from "#modules/outbox/application/password-reset-requested.schema.js";

import type { Clock } from "#modules/identity/application/ports/clock.js";
import type { PasswordResetTokenSigner } from "#modules/identity/application/ports/password-reset-token-signer.js";
import type { EmailSender } from "#modules/outbox/application/ports/email-sender.js";
import type { EmailTemplateRenderer } from "#modules/outbox/application/ports/email-template-renderer.js";
import type { EmailVerificationRecipientRepository } from "#modules/outbox/application/ports/email-verification-recipient-repository.js";
import type { OutboxEventHandler } from "#modules/outbox/application/ports/outbox-event-handler.js";
import type { ClaimedOutboxEvent } from "#modules/outbox/application/ports/outbox-repository.js";

const PASSWORD_RESET_EVENT_TYPE = "identity.password_reset_requested.v1";

export interface PasswordResetRequestedHandlerDependencies {
  clock: Clock;
  emailSender: EmailSender;
  emailTemplateRenderer: EmailTemplateRenderer;
  recipients: EmailVerificationRecipientRepository;
  tokenSigner: PasswordResetTokenSigner;
  buildPasswordResetUrl(token: string): string;
}

export class PasswordResetRequestedHandler implements OutboxEventHandler {
  constructor(
    private readonly dependencies: PasswordResetRequestedHandlerDependencies,
  ) {}

  async handle(event: ClaimedOutboxEvent): Promise<void> {
    if (event.eventType !== PASSWORD_RESET_EVENT_TYPE) {
      throw new Error(`Unexpected outbox event type: ${event.eventType}`);
    }

    const payload = passwordResetRequestedPayloadSchema.parse(event.payload);
    const expiresAt = new Date(payload.expiresAt);

    if (expiresAt <= this.dependencies.clock.now()) {
      return;
    }

    const recipient = await this.dependencies.recipients.findActiveByUserId(
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

    const resetUrl = this.dependencies.buildPasswordResetUrl(token);

    const renderedEmail =
      await this.dependencies.emailTemplateRenderer.renderPasswordReset({
        firstName: recipient.firstName,
        resetUrl,
      });

    await this.dependencies.emailSender.send({
      to: recipient.email,
      subject: "Reset your password",
      idempotencyKey: `password-reset/${event.id}`,
      ...renderedEmail,
    });
  }
}
