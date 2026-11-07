export interface EmailVerificationRecipient {
  email: string;
  firstName: string;
}

export interface EmailVerificationRecipientRepository {
  findPendingByUserId(
    userId: string,
  ): Promise<EmailVerificationRecipient | null>;
}
