import { z } from "zod";

const activityTypes = [
  "quiz",
  "word_search",
  "crossword",
  "cloze",
  "multiple_choice",
  "fill_in_the_blank",
  "drag_drop",
  "sentence_order",
  "board_game",
  "roulette",
  "hangman",
  "memory",
  "fill_in_blanks",
  "mole_hit",
] as const;

export const listActivitiesQuerySchema = z.object({
  scope: z.enum(["mine", "explore", "all"]).optional(),
  search: z.string().trim().max(120, "A busca deve ter no máximo 120 caracteres.").optional(),
  type: z.enum(activityTypes).optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  page: z.coerce
    .number()
    .int("A página deve ser um número inteiro.")
    .min(1, "A página deve ser maior que zero.")
    .default(1),
  limit: z.coerce
    .number()
    .int("O limite deve ser um número inteiro.")
    .min(1, "O limite deve ser maior que zero.")
    .max(100, "O limite máximo é 100.")
    .default(20),
});

export type ListActivitiesQuery = z.infer<
  typeof listActivitiesQuerySchema
>;
