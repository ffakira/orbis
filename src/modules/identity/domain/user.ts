import { Email } from "./value-objects/email.js";
import { UserRegistered } from "./user-registered.event.js";

export type UserStatus =
    | "pending_email_verification"
    | "active"
    | "suspended";

export interface RegisterUserProps {
    id: string;
    eventId: string;
    firstName: string;
    lastName: string;
    email: Email;
    phone: string;
    passwordHash: string;
    registeredAt: string;
}

export class User {
    private readonly domainEvents: UserRegistered[] = [];

    private constructor(
        public readonly id: string,
        public readonly firstName: string,
        public readonly lastName: string,
        public readonly email: Email,
        public readonly phone: string,
        private readonly passwordHashValue: string,
        public readonly status: UserStatus,
        public readonly createdAt: string,
        public readonly updatedAt: string,
    ) {}

    static register(props: RegisterUserProps): User {
        if (!props.id.trim()) {
            throw new Error("User ID is required.");
        }

        if (!props.eventId.trim()) {
            throw new Error("Event ID is required.");
        }

        if (!props.firstName.trim() || !props.lastName.trim()) {
            throw new Error("User name is required.");
        }

        if (!props.passwordHash.trim()) {
            throw new Error("Password hash is required.");
        }

        if (!Number.isFinite(Date.parse(props.registeredAt))) {
            throw new Error("Registration timestamp must be valid.");
        }

        const user = new User(
            props.id,
            props.firstName.trim(),
            props.lastName.trim(),
            props.email,
            props.phone,
            props.passwordHash,
            "pending_email_verification",
            props.registeredAt,
            props.registeredAt,
        );

        user.domainEvents.push(
            new UserRegistered(
                props.eventId,
                user.id,
                props.registeredAt,
            ),
        );

        return user;
    }

    get passwordHash(): string {
        return this.passwordHashValue;
    }

    pullDomainEvents(): UserRegistered[] {
        return this.domainEvents.splice(0);
    }
}