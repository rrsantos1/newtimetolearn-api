import { z } from "zod";

export const listActivitiesQuerySchema = z.object({
  scope: z.enum(["mine", "explore", "all"]).optional(),
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