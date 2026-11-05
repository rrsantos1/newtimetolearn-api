import { z } from "zod";

export const createInvitationSchema = z.object({
  email: z.email().trim().transform((value) => value.toLowerCase()),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
