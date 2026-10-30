import { z } from "zod";
import { normalizeCrosswordAnswer } from "../../utils/crossword/normalizeCrosswordAnswer";

const crosswordWordSchema = z
  .object({
    word: z
      .string()
      .trim()
      .min(1, "A resposta não pode estar vazia.")
      .max(100, "A resposta deve conter no máximo 100 caracteres.")
      .refine(
        (word) => /^[\\p{L}\\s-]+$/u.test(word),
        "Utilize apenas letras, espaços e hífens na resposta.",
      )
      .refine(
        (word) => {
          const normalized = normalizeCrosswordAnswer(word).normalized;
          return normalized.length >= 2;
        },
        "A resposta deve conter pelo menos 2 letras.",
      )
      .refine(
        (word) => normalizeCrosswordAnswer(word).normalized.length <= 25,
        "A resposta pode conter no máximo 25 letras, desconsiderando espaços e hífens.",
      ),
    clue: z
      .string()
      .trim()
      .min(1, "A pista não pode estar vazia.")
      .max(500, "A pista deve conter no máximo 500 caracteres."),
  })
  .strict();

export const crosswordContentSchema = z
  .object({
    words: z
      .array(crosswordWordSchema)
      .min(3, "A cruzadinha deve conter pelo menos 3 palavras.")
      .max(20, "A cruzadinha pode conter no máximo 20 palavras."),
  })
  .strict()
  .superRefine((content, context) => {
    const normalizedWords = new Set<string>();

    content.words.forEach((entry, index) => {
      const normalized = normalizeCrosswordAnswer(entry.word).normalized;

      if (normalizedWords.has(normalized)) {
        context.addIssue({
          code: "custom",
          path: ["words", index, "word"],
          message: "Não é permitido cadastrar respostas repetidas.",
        });
      }

      normalizedWords.add(normalized);
    });
  });

export type CrosswordContent = z.infer<typeof crosswordContentSchema>;
export type CrosswordContentWord = z.infer<typeof crosswordWordSchema>;
