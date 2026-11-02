import { z } from "zod";

const matchingTextItemSchema = z.object({
  type: z.literal("text"),
  value: z.string().trim().min(1).max(500),
}).strict();

const matchingImageItemSchema = z.object({
  type: z.literal("image"),
  storageKey: z.string().trim().min(1).max(500),
  altText: z.string().trim().max(250).default(""),
}).strict();

const matchingItemSchema = z.discriminatedUnion("type", [
  matchingTextItemSchema,
  matchingImageItemSchema,
]);

const matchingPairSchema = z.object({
  id: z.string().trim().min(1).max(50),
  source: matchingItemSchema,
  target: matchingItemSchema,
}).strict();

export const wordMatchingContentSchema = z.object({
  pairs: z.array(matchingPairSchema)
    .min(3, "A atividade deve ter pelo menos 3 associações.")
    .max(50, "A atividade pode ter no máximo 50 associações."),
}).strict().superRefine((content, context) => {
  const ids = new Set<string>();
  content.pairs.forEach((pair, index) => {
    if (ids.has(pair.id)) {
      context.addIssue({
        code: "custom",
        path: ["pairs", index, "id"],
        message: "Cada associação deve ter um identificador único.",
      });
    }
    ids.add(pair.id);
  });
});

export type WordMatchingContent = z.infer<typeof wordMatchingContentSchema>;
export type WordMatchingItem = z.infer<typeof matchingItemSchema>;
export type WordMatchingPair = z.infer<typeof matchingPairSchema>;
