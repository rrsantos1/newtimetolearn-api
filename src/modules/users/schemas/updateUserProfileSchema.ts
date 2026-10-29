import { z } from "zod";

export const updateUserProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
  })
  .strict();

export type UpdateUserProfileInput = z.infer<
  typeof updateUserProfileSchema
>;