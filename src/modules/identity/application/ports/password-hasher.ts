export interface PasswordHasher {
  hash(plainTextPassword: string): Promise<string>;
}
