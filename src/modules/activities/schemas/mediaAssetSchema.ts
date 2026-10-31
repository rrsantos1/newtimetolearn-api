import { z } from "zod";
export const createMediaAssetSchema = z.object({
  storageKey: z.string().trim().min(1).max(500),
  publicUrl: z.url(),
  fileName: z.string().trim().min(1).max(255),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
  sizeBytes: z.number().int().positive().max(5 * 1024 * 1024),
  altText: z.string().trim().max(250).default(""),
});
export const listMediaAssetsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(60).default(24),
  search: z.string().trim().max(100).optional(),
});
