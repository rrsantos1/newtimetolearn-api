import { z } from "zod";

const optionSchema = z.string().trim().min(1).max(80);

export const moleHitContentSchema = z.object({
  holeCount: z.union([z.literal(6), z.literal(9), z.literal(12)]),
  theme: z.string().trim().min(2).max(160),
  correctOptions: z.array(optionSchema).min(2).max(30),
  incorrectOptions: z.array(optionSchema).min(2).max(30),
}).strict().superRefine((content, context) => {
  const normalized = [...content.correctOptions, ...content.incorrectOptions]
    .map((option) => option.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").trim().toLocaleUpperCase("pt-BR"));
  if (new Set(normalized).size !== normalized.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "As opções corretas e incorretas devem ser únicas.", path: ["correctOptions"] });
  }
});

export type MoleHitContent = z.infer<typeof moleHitContentSchema>;
