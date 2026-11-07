import { z } from "zod";
import { activityDifficultySchema } from "./activityDifficultySchema";
import { moleHitContentSchema } from "./content/moleHitContent.schema";

export const createMoleHitActivitySchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da atividade.").max(120),
  description: z.string().trim().max(2000).nullable().optional(),
  difficulty: activityDifficultySchema,
  timeLimitSeconds: z.number().int().min(10).max(300).nullable().optional(),
  content: moleHitContentSchema,
}).strict();
