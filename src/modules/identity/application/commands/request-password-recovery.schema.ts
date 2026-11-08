import { z } from "zod";

import { emailSchema } from "#modules/identity/domain/value-objects/email.schema.js";

export const requestPasswordRecoverySchema = z.strictObject({
  email: emailSchema,
});

export type RequestPasswordRecoveryCommand = z.infer<
  typeof requestPasswordRecoverySchema
>;
