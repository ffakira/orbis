import { emailSchema } from "#modules/identity/domain/value-objects/email.schema.js";

export class Email {
  private constructor(public readonly value: string) {}

  static create(value: string): Email {
    return new Email(emailSchema.parse(value));
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
