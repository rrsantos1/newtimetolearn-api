import { z } from "zod";
import { ActivityVisibility } from "../types/ActivityVisibility";

export const activityVisibilitySchema = z.enum(ActivityVisibility);

export type ActivityVisibilityInput = z.infer<
  typeof activityVisibilitySchema
>;