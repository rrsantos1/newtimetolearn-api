import { z } from "zod";

export const moleHitContentSchema = z.object({
  holeCount: z.union([z.literal(6), z.literal(9), z.literal(12)]),
}).strict();

export type MoleHitContent = z.infer<typeof moleHitContentSchema>;
