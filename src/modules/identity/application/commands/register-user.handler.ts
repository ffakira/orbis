import { Email } from "../../domain/value-objects/email.js";
import { User } from "../../domain/user.js";
import { TermsAcceptance } from "../../domain/terms-acceptance.js";
import { EmailVerificationToken } from "../../domain/email-verification-token.js";
import { EmailVerificationRequested } from "../../domain/email-verification-requested.event.js";

import type { RegisterUserCommand } from "./register-user.schema.js";

import type { Clock } from "../ports/clock.js";
import type { IdGenerator } from "../ports/id-generator.js";
import type { PasswordHasher } from "../ports/password-hasher.js";
import type { TermsPolicy } from "../ports/terms-policy.js";
import type { EmailVerificationTokenSigner } from "../ports/email-verification-token-signer.js";
import type { IdentityUnitOfWork } from "../ports/unit-of-work.js";

const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export interface RegisterUserDependencies {
  ids: IdGenerator;
  clock: Clock;
  passwordHasher: PasswordHasher;
  termsPolicy: TermsPolicy;
  emailVerificationTokenSigner: EmailVerificationTokenSigner;
  unitOfWork: IdentityUnitOfWork;
}

export interface RegisterUserResult {
  userId: string;
}

export class RegisterUserHandler {
  constructor(private readonly dependencies: RegisterUserDependencies) {}

  async execute(command: RegisterUserCommand): Promise<RegisterUserResult> {
    const {
      ids,
      clock,
      passwordHasher,
      termsPolicy,
      emailVerificationTokenSigner,
      unitOfWork,
    } = this.dependencies;

    const passwordHash = await passwordHasher.hash(command.password);

    const now = clock.now();
    const registeredAt = now.toISOString();

    const user = User.register({
      id: ids.generate(),
      eventId: ids.generate(),
      firstName: command.firstName,
      lastName: command.lastName,
      email: Email.create(command.email),
      phone: command.phone,
      passwordHash,
      registeredAt,
    });

    const termsAcceptance = TermsAcceptance.record({
      id: ids.generate(),
      userId: user.id,
      document: "terms_of_service",
      version: termsPolicy.currentTermsOfServiceVersion(),
      acceptedAt: registeredAt,
    });

    const tokenId = ids.generate();
    const expiresAt = new Date(
      now.getTime() + EMAIL_VERIFICATION_TOKEN_TTL_MS,
    );
    const expiresAtIso = expiresAt.toISOString();

    const tokenContext = {
      tokenId,
      userId: user.id,
      expiresAt: expiresAtIso,
    };

    const bearerToken =
      emailVerificationTokenSigner.deriveToken(tokenContext);

    const verificationToken = EmailVerificationToken.create({
      id: tokenId,
      userId: user.id,
      tokenHash: emailVerificationTokenSigner.hashToken(bearerToken),
      createdAt: now,
      expiresAt,
    });

    const verificationRequestedEvent = new EmailVerificationRequested(
      ids.generate(),
      user.id,
      tokenId,
      expiresAtIso,
      registeredAt,
    );

    const domainEvents = user.pullDomainEvents();

    await unitOfWork.transaction(async (transaction) => {
      await transaction.users.insert(user);

      await transaction.termsAcceptances.insert(termsAcceptance);

      await transaction.emailVerificationTokens.insert(verificationToken);

      for (const event of domainEvents) {
        await transaction.outbox.append(event);
      }

      await transaction.outbox.append(verificationRequestedEvent);
    });

    return {
      userId: user.id,
    };
  }
}
