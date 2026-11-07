import { describe, expect, it, vi } from "vitest";
import { Resend } from "resend";

import {
  ResendEmailSender,
  type ResendEmailSenderConfig,
} from "#modules/outbox/infrastructure/email/resend-email-sender.js";

import type { EmailMessage } from "#modules/outbox/application/ports/email-sender.js";

const message: EmailMessage = {
  to: "recipient@example.test",
  subject: "Verify your email address",
  text: "Hello Alex, verify your email.",
  html: "<p>Hello Alex, verify your email.</p>",
  idempotencyKey: "email-verification/event-123",
};

const config: ResendEmailSenderConfig = {
  from: "Orbis <notifications@example.test>",
};

function createSender() {
  const send = vi.fn().mockResolvedValue({
    data: {
      id: "resend-message-123",
    },
    error: null,
  });

  const client = {
    emails: {
      send,
    },
  } as unknown as Resend;

  return {
    sender: new ResendEmailSender(client, config),
    send,
  };
}

describe("ResendEmailSender", () => {
  it("sends an email using the configured sender address", async () => {
    const { sender, send } = createSender();

    await sender.send(message);

    expect(send).toHaveBeenCalledOnce();

    expect(send).toHaveBeenCalledWith(
      {
        from: config.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      },
      {
        idempotencyKey: message.idempotencyKey,
      },
    );
  });

  it("forwards the idempotency key unchanged", async () => {
    const { sender, send } = createSender();

    await sender.send(message);

    const [, options] = send.mock.calls[0];

    expect(options).toEqual({
      idempotencyKey: "email-verification/event-123",
    });
  });

  it("does not throw when Resend accepts the email", async () => {
    const { sender } = createSender();

    await expect(sender.send(message)).resolves.toBeUndefined();
  });

  it("throws when Resend returns an API error", async () => {
    const send = vi.fn().mockResolvedValue({
      data: null,
      error: {
        name: "validation_error",
        message: "Invalid recipient address",
      },
    });

    const client = {
      emails: {
        send,
      },
    } as unknown as Resend;

    const sender = new ResendEmailSender(client, config);

    await expect(sender.send(message)).rejects.toThrow(
      "Resend email delivery failed: Invalid recipient address",
    );
  });

  it("propagates unexpected SDK failures", async () => {
    const sdkError = new Error("Network connection failed");

    const send = vi.fn().mockRejectedValue(sdkError);

    const client = {
      emails: {
        send,
      },
    } as unknown as Resend;

    const sender = new ResendEmailSender(client, config);

    await expect(sender.send(message)).rejects.toBe(sdkError);
  });
});
