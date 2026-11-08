import type { EmailVerificationRequested } from "#modules/identity/domain/email-verification-requested.event.js";
import type { PasswordResetRequested } from "#modules/identity/domain/password-reset-requested.event.js";
import type { OutboxEvent } from "#modules/outbox/application/ports/outbox-event.js";

export type IdentityOutboxEvent = OutboxEvent &
  (EmailVerificationRequested | PasswordResetRequested);
