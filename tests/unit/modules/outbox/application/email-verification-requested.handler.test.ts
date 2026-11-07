
import { describe, expect, it, vi } from "vitest";

import {
  EmailVerificationRequestedHandler,
  type EmailVerificationRequestedHandlerDependencies,
} from "#modules/outbox/application/email-verification-requested.handler.js";

import type { Clock } from "#modules/identity/application/ports/clock.js";
import type { EmailVerificationTokenSigner } from "#modules/identity/application/ports/email-verification-token-signer.js";
import type { EmailSender } from "#modules/outbox/application/ports/email-sender.js";
import type { EmailTemplateRenderer } from "#modules/outbox/application/ports/email-template-renderer.js";
import type { EmailVerificationRecipientRepository } from "#modules/outbox/application/ports/email-verification-recipient-repository.js";
import type { ClaimedOutboxEvent } from "#modules/outbox/application/ports/outbox-repository.js";

const now = new Date("2026-11-07T12:00:00.000Z");

const payload = {
  userId: "550e8400-e29b-41d4-a716-446655440000",
  tokenId: "550e8400-e29b-41d4-a716-446655440001",
  expiresAt: "2026-11-08T12:00:00.000Z",
  occurredAt: "2026-11-07T11:00:00.000Z",
};

const event: ClaimedOutboxEvent = {
  id: "event-123",
  eventType: "identity.email_verification_requested.v1",
  payload,
  attempts: 1,
  leaseToken: "lease-token-123",
};

const recipient = {
  email: "alex@example.test",
  firstName: "Alex",
};

const renderedEmail = {
  html: "<p>Verify your email</p>",
  text: "Verify your email",
};

function createHandler(
  overrides: Partial<EmailVerificationRequestedHandlerDependencies> = {},
) {
  const clock: Clock = {
    now: vi.fn(() => now),
  };

  const emailSender: EmailSender = {
    send: vi.fn(async () => {}),
  };

  const emailTemplateRenderer: EmailTemplateRenderer = {
    renderEmailVerification: vi.fn(async () => renderedEmail),
  };

  const recipients: EmailVerificationRecipientRepository = {
    findPendingByUserId: vi.fn(async () => recipient),
  };

  const tokenSigner: EmailVerificationTokenSigner = {
    deriveToken: vi.fn(() => "synthetic-verification-token"),
    hashToken: vi.fn(() => "synthetic-token-hash"),
  };

  const buildVerificationUrl = vi.fn(
    (token: string) =>
      `https://example.test/verify?token=${token}`,
  );

  const dependencies: EmailVerificationRequestedHandlerDependencies = {
    clock,
    emailSender,
    emailTemplateRenderer,
    recipients,
    tokenSigner,
    buildVerificationUrl,
    ...overrides,
  };

  return {
    handler: new EmailVerificationRequestedHandler(dependencies),
    clock,
    emailSender,
    emailTemplateRenderer,
    recipients,
    tokenSigner,
    buildVerificationUrl,
  };
}

describe("EmailVerificationRequestedHandler", () => {
  it("sends a verification email for a valid event", async () => {
    const { handler, emailSender } = createHandler();

    await handler.handle(event);

    expect(emailSender.send).toHaveBeenCalledOnce();

    expect(emailSender.send).toHaveBeenCalledWith({
      to: recipient.email,
      subject: "Verify your email address",
      idempotencyKey: `email-verification/${event.id}`,
      ...renderedEmail,
    });
  });

  it("derives the verification token using the event context", async () => {
    const { handler, tokenSigner } = createHandler();

    await handler.handle(event);

    expect(tokenSigner.deriveToken).toHaveBeenCalledOnce();

    expect(tokenSigner.deriveToken).toHaveBeenCalledWith({
      tokenId: payload.tokenId,
      userId: payload.userId,
      expiresAt: payload.expiresAt,
    });

    expect(tokenSigner.hashToken).not.toHaveBeenCalled();
  });

  it("builds the verification URL using the derived token", async () => {
    const { handler, buildVerificationUrl } = createHandler();

    await handler.handle(event);

    expect(buildVerificationUrl).toHaveBeenCalledOnce();

    expect(buildVerificationUrl).toHaveBeenCalledWith(
      "synthetic-verification-token",
    );
  });

  it("renders the email using the recipient name and verification URL", async () => {
    const { handler, emailTemplateRenderer } = createHandler();

    await handler.handle(event);

    expect(
      emailTemplateRenderer.renderEmailVerification,
    ).toHaveBeenCalledOnce();

    expect(
      emailTemplateRenderer.renderEmailVerification,
    ).toHaveBeenCalledWith({
      firstName: recipient.firstName,
      verificationUrl:
        "https://example.test/verify?token=synthetic-verification-token",
    });
  });

  it("does not process an expired verification event", async () => {
    const {
      handler,
      recipients,
      tokenSigner,
      emailTemplateRenderer,
      emailSender,
    } = createHandler();

    const expiredEvent: ClaimedOutboxEvent = {
      ...event,
      payload: {
        ...payload,
        expiresAt: "2026-11-07T11:59:59.000Z",
      },
    };

    await handler.handle(expiredEvent);

    expect(recipients.findPendingByUserId).not.toHaveBeenCalled();
    expect(tokenSigner.deriveToken).not.toHaveBeenCalled();
    expect(
      emailTemplateRenderer.renderEmailVerification,
    ).not.toHaveBeenCalled();
    expect(emailSender.send).not.toHaveBeenCalled();
  });

  it("does not send an email when the recipient is not found", async () => {
    const recipients: EmailVerificationRecipientRepository = {
      findPendingByUserId: vi.fn(async () => null),
    };

    const {
      handler,
      tokenSigner,
      emailTemplateRenderer,
      emailSender,
    } = createHandler({ recipients });

    await handler.handle(event);

    expect(recipients.findPendingByUserId).toHaveBeenCalledWith(
      payload.userId,
    );

    expect(tokenSigner.deriveToken).not.toHaveBeenCalled();

    expect(
      emailTemplateRenderer.renderEmailVerification,
    ).not.toHaveBeenCalled();

    expect(emailSender.send).not.toHaveBeenCalled();
  });

  it("rejects an event with an unexpected event type", async () => {
    const { handler, recipients, emailSender } = createHandler();

    const unexpectedEvent: ClaimedOutboxEvent = {
      ...event,
      eventType: "identity.user_registered.v1",
    };

    await expect(
      handler.handle(unexpectedEvent),
    ).rejects.toThrow(
      "Unexpected outbox event type: identity.user_registered.v1",
    );

    expect(recipients.findPendingByUserId).not.toHaveBeenCalled();
    expect(emailSender.send).not.toHaveBeenCalled();
  });

  it("rejects an event with an invalid payload", async () => {
    const { handler, recipients, emailSender } = createHandler();

    const invalidEvent: ClaimedOutboxEvent = {
      ...event,
      payload: {
        ...payload,
        userId: "not-a-uuid",
      },
    };

    await expect(
      handler.handle(invalidEvent),
    ).rejects.toThrow();

    expect(recipients.findPendingByUserId).not.toHaveBeenCalled();
    expect(emailSender.send).not.toHaveBeenCalled();
  });

  it("propagates email delivery failures", async () => {
    const deliveryError = new Error("Email provider unavailable.");

    const emailSender: EmailSender = {
      send: vi.fn(async () => {
        throw deliveryError;
      }),
    };

    const { handler } = createHandler({ emailSender });

    await expect(
      handler.handle(event),
    ).rejects.toBe(deliveryError);
  });
});
