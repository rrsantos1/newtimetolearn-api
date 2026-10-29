import { z } from "zod";
import { ActivityType } from "../types/ActivityType";

export const activityTypeSchema = z.enum(ActivityType);

export type ActivityTypeInput = z.infer<typeof activityTypeSchema>;