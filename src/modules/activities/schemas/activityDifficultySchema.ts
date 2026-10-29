import { z } from "zod";
import { ActivityDifficulty } from "../types/ActivityDifficulty";

export const activityDifficultySchema = z.enum(ActivityDifficulty);

export type ActivityDifficultyInput = z.infer<
  typeof activityDifficultySchema
>;