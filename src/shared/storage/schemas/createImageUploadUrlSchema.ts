import { z } from "zod";

export const createImageUploadUrlSchema = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
  extension: z.enum(["jpg", "png", "webp", "gif"]),
});

export type CreateImageUploadUrlInput = z.infer<
  typeof createImageUploadUrlSchema
>;
