import { z } from "zod";
import { ActivityDifficulty } from "../types/ActivityDifficulty";

export const createDragDropActivitySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullable().optional(),
  difficulty: z.enum(ActivityDifficulty),
  timeLimitSeconds: z.number().int().min(60).max(14_400).nullable().optional(),
  content: z.unknown(),
}).strict();

export type CreateDragDropActivityBody = z.infer<typeof createDragDropActivitySchema>;
