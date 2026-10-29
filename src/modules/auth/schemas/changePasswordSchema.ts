import { z } from "zod";

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(72),
    newPassword: z.string().min(8).max(72),
  })
  .strict()
  .refine(
    (data) => data.currentPassword !== data.newPassword,
    {
      message: "A nova senha deve ser diferente da senha atual.",
      path: ["newPassword"],
    },
  );

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;