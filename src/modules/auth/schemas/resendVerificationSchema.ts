import { z } from "zod";

export const resendVerificationSchema = z.object({
  email: z.email()
    .trim()
    .transform((value) => value.toLowerCase()),
});