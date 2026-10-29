import { z } from "zod";
import { ActivityDifficulty } from "../types/ActivityDifficulty";

export const createWordSearchActivitySchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "O nome deve conter pelo menos 3 caracteres.")
    .max(120, "O nome deve conter no máximo 120 caracteres."),

  description: z
    .string()
    .trim()
    .max(2000, "A descrição deve conter no máximo 2000 caracteres.")
    .nullable()
    .optional(),

  difficulty: z.enum(ActivityDifficulty),

  timeLimitSeconds: z
    .number()
    .int("O limite de tempo deve ser um número inteiro.")
    .positive("O limite de tempo deve ser positivo.")
    .nullable()
    .optional(),

  words: z.array(z.string()),
});

export type CreateWordSearchActivityBody = z.infer<
  typeof createWordSearchActivitySchema
>;