import { Email } from "../../domain/value-objects/email.js";
import { User } from "../../domain/user.js";
import { TermsAcceptance } from "../../domain/terms-acceptance.js";

import type { RegisterUserCommand } from "./register-user.schema.js";

import type { Clock } from "../ports/clock.js";
import type { IdGenerator } from "../ports/id-generator.js";
import type { PasswordHasher } from "../ports/password-hasher.js";
import type { TermsPolicy } from "../ports/terms-policy.js";
import type { IdentityUnitOfWork } from "../ports/unit-of-work.js";

export interface RegisterUserDependencies {
  ids: IdGenerator;
  clock: Clock;
  passwordHasher: PasswordHasher;
  termsPolicy: TermsPolicy;
  unitOfWork: IdentityUnitOfWork;
}

export interface RegisterUserResult {
  userId: string;
}

export class RegisterUserHandler {
  constructor(private readonly dependencies: RegisterUserDependencies) {}

  async execute(command: RegisterUserCommand): Promise<RegisterUserResult> {
    const { ids, clock, passwordHasher, termsPolicy, unitOfWork } =
      this.dependencies;

    const passwordHash = await passwordHasher.hash(command.password);

    const registeredAt = clock.now().toISOString();

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

    const domainEvents = user.pullDomainEvents();

    await unitOfWork.transaction(async (transaction) => {
      await transaction.users.insert(user);

      await transaction.termsAcceptances.insert(termsAcceptance);

      for (const event of domainEvents) {
        await transaction.outbox.append(event);
      }
    });

    return {
      userId: user.id,
    };
  }
}
