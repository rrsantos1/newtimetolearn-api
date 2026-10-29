import { z } from "zod";
import { normalizeWordSearchWord } from "../../utils/wordSearch/normalizeWordSearchWord";

const wordSearchWordSchema = z
  .string()
  .trim()
  .min(1, "A palavra não pode estar vazia.")
  .max(50, "Cada palavra pode ter no máximo 50 caracteres.")
  .refine(
    (word) => /^[\p{L}\s-]+$/u.test(word),
    "Utilize apenas letras, espaços e hífens.",
  )
  .refine(
    (word) => {
      const normalized = normalizeWordSearchWord(word).normalized;
      return normalized.length >= 2;
    },
    "Cada palavra deve conter pelo menos 2 letras.",
  )
  .refine(
    (word) => normalizeWordSearchWord(word).letters.length <= 20,
    "Cada palavra pode conter no máximo 20 letras, desconsiderando espaços e hífens.",
  );

export const wordSearchContentSchema = z
  .object({
    words: z
      .array(wordSearchWordSchema)
      .min(3, "O caça-palavras deve conter pelo menos 3 palavras.")
      .max(30, "O caça-palavras pode conter no máximo 30 palavras."),
  })
  .superRefine((content, context) => {
    const normalizedWords = new Set<string>();

    content.words.forEach((word, index) => {
      const normalized = normalizeWordSearchWord(word).normalized;

      if (normalizedWords.has(normalized)) {
        context.addIssue({
          code: "custom",
          path: ["words", index],
          message: "Não é permitido cadastrar palavras repetidas.",
        });
      }

      normalizedWords.add(normalized);
    });
  });

export type WordSearchContent = z.infer<typeof wordSearchContentSchema>;