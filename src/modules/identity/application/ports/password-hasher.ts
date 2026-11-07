export interface PasswordHasher {
  hash(plainTextPassword: string): Promise<string>;

  verify(plainTextPassword: string, passwordHash: string): Promise<boolean>;
}
