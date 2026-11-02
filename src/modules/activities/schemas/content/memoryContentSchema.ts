import { z } from "zod";

const memoryTextItemSchema = z.object({
  type: z.literal("text"),
  value: z.string().trim().min(1, "O texto do par não pode ficar vazio.").max(300),
}).strict();

const memoryImageItemSchema = z.object({
  type: z.literal("image"),
  storageKey: z.string().trim().min(1).max(500),
  altText: z.string().trim().max(250).default(""),
}).strict();

const memoryItemSchema = z.discriminatedUnion("type", [
  memoryTextItemSchema,
  memoryImageItemSchema,
]);

const memoryPairSchema = z.object({
  id: z.string().trim().min(1).max(50),
  first: memoryItemSchema,
  second: memoryItemSchema,
}).strict();

export const memoryContentSchema = z.object({
  pairs: z.array(memoryPairSchema).min(3, "O jogo deve ter pelo menos 3 pares.").max(50, "O jogo pode ter no máximo 50 pares."),
}).strict().superRefine((content, context) => {
  const ids = new Set<string>();
  content.pairs.forEach((pair, index) => {
    if (ids.has(pair.id)) {
      context.addIssue({ code: "custom", path: ["pairs", index, "id"], message: "Cada par deve ter um identificador único." });
    }
    ids.add(pair.id);
  });
});

export type MemoryContent = z.infer<typeof memoryContentSchema>;
export type MemoryItem = z.infer<typeof memoryItemSchema>;
export type MemoryPair = z.infer<typeof memoryPairSchema>;
