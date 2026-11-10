export class InvalidPasswordResetTokenError extends Error {
  constructor() {
    super("The password reset token is invalid or has expired.");
    this.name = "InvalidPasswordResetTokenError";
  }
}
