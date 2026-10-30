import { z } from "zod";
import { ActivityDifficulty } from "../types/ActivityDifficulty";
import { crosswordContentSchema } from "./content/crosswordContent.schema";
import { normalizeCrosswordAnswer } from "../utils/crossword/normalizeCrosswordAnswer";

export const createCrosswordActivitySchema = z
  .object({
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
    words: crosswordContentSchema.shape.words,
  })
  .superRefine((data, context) => {
    const normalizedWords = new Set<string>();

    data.words.forEach((entry, index) => {
      const normalized = normalizeCrosswordAnswer(entry.word).normalized;

      if (normalizedWords.has(normalized)) {
        context.addIssue({
          code: "custom",
          path: ["words", index, "word"],
          message: "Não é permitido cadastrar respostas repetidas.",
        });
      }

      normalizedWords.add(normalized);
    });
  });

export type CreateCrosswordActivityBody = z.infer<
  typeof createCrosswordActivitySchema
>;
