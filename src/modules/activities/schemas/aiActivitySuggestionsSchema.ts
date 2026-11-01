import { z } from "zod";

export const aiActivitySuggestionsSchema = z.discriminatedUnion("activityType", [
  z.object({
    activityType: z.literal("word_search"),
    topic: z.string().trim().min(2).max(160),
    quantity: z.coerce.number().int().min(3).max(25),
    difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
    gradeLevel: z.string().trim().max(80).optional(),
    instructions: z.string().trim().max(500).optional(),
  }).strict(),
  z.object({
    activityType: z.literal("crossword"),
    topic: z.string().trim().min(2).max(160),
    quantity: z.coerce.number().int().min(3).max(20),
    difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
    gradeLevel: z.string().trim().max(80).optional(),
    instructions: z.string().trim().max(500).optional(),
  }).strict(),
  z.object({
    activityType: z.literal("quiz"),
    topic: z.string().trim().min(2).max(160),
    quantity: z.coerce.number().int().min(1).max(10),
    difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
    gradeLevel: z.string().trim().max(80).optional(),
    instructions: z.string().trim().max(500).optional(),
    optionCount: z.coerce.number().int().min(3).max(6).default(4),
  }).strict(),
]);

export type AiActivitySuggestionsInput = z.infer<typeof aiActivitySuggestionsSchema>;

export const aiActivitySuggestionsOutputSchema = z.discriminatedUnion("activityType", [
  z.object({
    activityType: z.literal("word_search"),
    words: z.array(z.string().trim().min(2).max(50).refine((word) => word.replace(/[\\s-]/g, "").length <= 20, "A palavra deve ter até 20 letras, desconsiderando espaços e hífens.")).min(1).max(25),
  }).strict(),
  z.object({
    activityType: z.literal("crossword"),
    entries: z.array(z.object({
      answer: z.string().trim().min(2).max(100).refine((answer) => answer.replace(/[\\s-]/g, "").length <= 25, "A resposta deve ter até 25 letras, desconsiderando espaços e hífens."),
      clue: z.string().trim().min(3).max(240),
    }).strict()).min(1).max(20),
  }).strict(),
  z.object({
    activityType: z.literal("quiz"),
    questions: z.array(z.object({
      question: z.string().trim().min(5).max(500),
      options: z.array(z.object({
        text: z.string().trim().min(1).max(300),
        isCorrect: z.boolean(),
      }).strict()).min(3).max(6),
      explanation: z.string().trim().max(500).optional(),
    }).strict().refine((question) => question.options.filter((option) => option.isCorrect).length === 1, {
      message: "Cada questão deve conter exatamente uma alternativa correta.",
    })).min(1).max(10),
  }).strict(),
]);
