import { z } from "zod";
import { RoleCode } from "../../users/types/RoleCode";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().trim().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(72),
  role: z
    .enum([RoleCode.STUDENT, RoleCode.TEACHER])
    .default(RoleCode.STUDENT),
});

export type RegisterInput = z.infer<typeof registerSchema>;