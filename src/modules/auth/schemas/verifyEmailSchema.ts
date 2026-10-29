import { z } from "zod";

export const verifyEmailSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/, "Token inválido."),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;