export interface UserProfile {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: "pending_email_verification" | "active" | "suspended";
  createdAt: Date;
}

export interface UserProfileRepository {
  findById(userId: string): Promise<UserProfile | null>;
}
