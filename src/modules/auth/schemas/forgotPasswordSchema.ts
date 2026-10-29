import { z } from "zod";

export const forgotPasswordSchema = z.object({
  email: z
    .email()
    .trim()
    .transform((email) => email.toLowerCase()),
});