import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .email()
    .trim()
    .transform((email) => email.toLowerCase()),
  password: z.string().min(1).max(72),
});

export type LoginInput = z.infer<typeof loginSchema>;