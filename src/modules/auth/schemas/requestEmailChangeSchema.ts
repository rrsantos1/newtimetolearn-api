import { z } from "zod";

export const requestEmailChangeSchema = z.object({
  newEmail: z.email().trim().toLowerCase(),
  currentPassword: z.string().min(1).max(72),
}).strict();

export type RequestEmailChangeInput = z.infer<
  typeof requestEmailChangeSchema
>;