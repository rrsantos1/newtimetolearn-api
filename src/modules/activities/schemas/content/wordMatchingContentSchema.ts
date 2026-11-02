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
  const sourceKeys = new Set<string>();
  const targetKeys = new Set<string>();
  content.pairs.forEach((pair, index) => {
    if (ids.has(pair.id)) {
      context.addIssue({
        code: "custom",
        path: ["pairs", index, "id"],
        message: "Cada associação deve ter um identificador único.",
      });
    }
    ids.add(pair.id);

    const sourceKey = pair.source.type === "text"
      ? `text:${pair.source.value.toLocaleLowerCase("pt-BR")}`
      : `image:${pair.source.storageKey}`;
    const targetKey = pair.target.type === "text"
      ? `text:${pair.target.value.toLocaleLowerCase("pt-BR")}`
      : `image:${pair.target.storageKey}`;

    if (sourceKeys.has(sourceKey)) {
      context.addIssue({ code: "custom", path: ["pairs", index, "source"], message: "Cada item de origem deve ser único." });
    }
    if (targetKeys.has(targetKey)) {
      context.addIssue({ code: "custom", path: ["pairs", index, "target"], message: "Cada correspondência de destino deve ser única." });
    }
    sourceKeys.add(sourceKey);
    targetKeys.add(targetKey);
  });
});

export type WordMatchingContent = z.infer<typeof wordMatchingContentSchema>;
export type WordMatchingItem = z.infer<typeof matchingItemSchema>;
export type WordMatchingPair = z.infer<typeof matchingPairSchema>;
