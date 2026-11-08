export interface EmailVerificationRecipient {
  email: string;
  firstName: string;
}

export interface PasswordResetRecipient {
  email: string;
  firstName: string;
}

export interface EmailVerificationRecipientRepository {
  findPendingByUserId(
    userId: string,
  ): Promise<EmailVerificationRecipient | null>;

  findActiveByUserId(userId: string): Promise<PasswordResetRecipient | null>;
}
