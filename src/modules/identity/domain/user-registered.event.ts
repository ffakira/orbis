export interface UserRegisteredProps {
  id: string;
  userId: string;
  occurredAt: string;
}

export class UserRegistered {
  readonly type = "identity.user_registered.v1";

  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly occurredAt: string,
  ) {}
}
