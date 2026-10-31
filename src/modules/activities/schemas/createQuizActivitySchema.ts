import { z } from "zod";
import { ActivityDifficulty } from "../types/ActivityDifficulty";
import { quizDraftContentSchema } from "./content/quizContentSchema";

export const createQuizActivitySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullable().optional(),
  difficulty: z.enum(ActivityDifficulty),
  timeLimitSeconds: z.number().int().positive().nullable().optional(),
  content: quizDraftContentSchema,
});

export type CreateQuizActivityBody = z.infer<typeof createQuizActivitySchema>;
