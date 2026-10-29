import { z } from "zod";

export const confirmEmailChangeSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/i),
}).strict();

export type ConfirmEmailChangeInput = z.infer<
  typeof confirmEmailChangeSchema
>;