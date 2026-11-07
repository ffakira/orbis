import { z } from "zod";

import { Email } from "#modules/identity/domain/value-objects/email.js";

export const registerUserSchema = z.object({
  id: z.string().trim().min(1),
  eventId: z.string().trim().min(1),

  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),

  email: z.custom<Email>((value) => value instanceof Email),

  phone: z.string().max(16),
  passwordHash: z.string().min(1).max(255),

  registeredAt: z.iso.datetime({ offset: true }),
});

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
