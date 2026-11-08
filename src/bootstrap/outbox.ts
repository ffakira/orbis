import "#config/env.js";

import { Resend } from "resend";

import { createAsyncSingleton } from "#bootstrap/async-singleton.js";
import { outboxConfig } from "#config/outbox.js";
import { getDatabase } from "#infrastructure/database/client.js";
import {
  getEmailVerificationSecret,
  getResendSecret,
} from "#infrastructure/secrets/secrets-manager.js";
import { SystemClock } from "#infrastructure/time/system-clock.js";
import { HmacEmailVerificationTokenSigner } from "#modules/identity/infrastructure/cryptography/hmac-email-verification-token-signer.js";
import { EmailVerificationRequestedHandler } from "#modules/outbox/application/email-verification-requested.handler.js";
import { OutboxPublisher } from "#modules/outbox/application/outbox-publisher.js";
import { RoutingOutboxEventDispatcher } from "#modules/outbox/application/routing-outbox-event-dispatcher.js";
import { EjsEmailTemplateRenderer } from "#modules/outbox/infrastructure/email/ejs-email-template-renderer.js";
import { ResendEmailSender } from "#modules/outbox/infrastructure/email/resend-email-sender.js";
import { DrizzleEmailVerificationRecipientRepository } from "#modules/outbox/infrastructure/persistence/drizzle-email-verification-recipient-repository.js";
import { DrizzleOutboxRepository } from "#modules/outbox/infrastructure/persistence/drizzle-outbox-repository.js";

import type { Clock } from "#modules/identity/application/ports/clock.js";

const clock: Clock = new SystemClock();

export const getOutboxPublisher = createAsyncSingleton(async () => {
  const [database, resendSecret, emailVerificationSecret] = await Promise.all([
    getDatabase(),
    getResendSecret(),
    getEmailVerificationSecret(),
  ]);

  const resendClient = new Resend(resendSecret.RESEND_API_KEY);

  const emailSender = new ResendEmailSender(resendClient, {
    from: outboxConfig.emailFromAddress,
  });

  const emailTemplateRenderer = new EjsEmailTemplateRenderer();

  const recipientRepository = new DrizzleEmailVerificationRecipientRepository(
    database,
  );

  const outboxRepository = new DrizzleOutboxRepository(database);

  const tokenSigner = new HmacEmailVerificationTokenSigner(
    emailVerificationSecret.EMAIL_VERIFICATION_SECRET,
  );

  const emailVerificationHandler = new EmailVerificationRequestedHandler({
    clock,
    emailSender,
    emailTemplateRenderer,
    recipients: recipientRepository,
    tokenSigner,
    buildVerificationUrl(token: string): string {
      const url = new URL("/verify-email", outboxConfig.publicAppUrl);

      url.searchParams.set("token", token);

      return url.toString();
    },
  });

  const dispatcher = new RoutingOutboxEventDispatcher(
    new Map([
      ["identity.email_verification_requested.v1", emailVerificationHandler],
    ]),
  );

  return new OutboxPublisher({
    clock,
    dispatcher,
    repository: outboxRepository,
    config: {
      batchSize: outboxConfig.batchSize,
      leaseDurationMs: outboxConfig.leaseDurationMs,
      maxAttempts: outboxConfig.maxAttempts,
      retryBaseDelayMs: outboxConfig.retryBaseDelayMs,
      retryMaxDelayMs: outboxConfig.retryMaxDelayMs,
    },
  });
});
