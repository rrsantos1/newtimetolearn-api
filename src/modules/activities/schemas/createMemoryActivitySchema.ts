import { z } from "zod";
import { ActivityDifficulty } from "../types/ActivityDifficulty";
import { memoryContentSchema } from "./content/memoryContentSchema";

export const createMemoryActivitySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullable().optional(),
  difficulty: z.enum(ActivityDifficulty),
  timeLimitSeconds: z.number().int().positive().nullable().optional(),
  content: memoryContentSchema,
}).strict();

export type CreateMemoryActivityBody = z.infer<typeof createMemoryActivitySchema>;
