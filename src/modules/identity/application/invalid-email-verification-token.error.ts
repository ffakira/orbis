export class InvalidEmailVerificationTokenError extends Error {
  constructor() {
    super("The email verification token is invalid or has expired.");

    this.name = "InvalidEmailVerificationTokenError";
  }
}
