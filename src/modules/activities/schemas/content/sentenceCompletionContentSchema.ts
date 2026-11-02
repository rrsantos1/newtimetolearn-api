import { z } from "zod";

const wordSchema = z.object({
  id: z.string().trim().min(1).max(50),
  text: z.string().trim().min(1).max(150),
}).strict();

const blankSchema = z.object({
  id: z.string().trim().min(1).max(50),
  expectedWordId: z.string().trim().min(1).max(50),
}).strict();

const sentenceSchema = z.object({
  id: z.string().trim().min(1).max(50),
  text: z.string().trim().min(1).max(2000),
  blanks: z.array(blankSchema).min(1).max(20),
}).strict();

export const sentenceCompletionContentSchema = z.object({
  words: z.array(wordSchema).min(1).max(200),
  sentences: z.array(sentenceSchema).min(1).max(100),
}).strict().superRefine((content, context) => {
  const wordIds = new Set<string>();
  content.words.forEach((word, index) => {
    if (wordIds.has(word.id)) {
      context.addIssue({ code: "custom", path: ["words", index, "id"], message: "Cada item do banco deve ter um identificador único." });
    }
    wordIds.add(word.id);
  });

  const sentenceIds = new Set<string>();
  const blankIds = new Set<string>();
  content.sentences.forEach((sentence, sentenceIndex) => {
    if (sentenceIds.has(sentence.id)) {
      context.addIssue({ code: "custom", path: ["sentences", sentenceIndex, "id"], message: "Cada frase deve ter um identificador único." });
    }
    sentenceIds.add(sentence.id);

    sentence.blanks.forEach((blank, blankIndex) => {
      if (blankIds.has(blank.id)) {
        context.addIssue({ code: "custom", path: ["sentences", sentenceIndex, "blanks", blankIndex, "id"], message: "Cada lacuna deve ter um identificador único na atividade." });
      }
      blankIds.add(blank.id);

      if (!wordIds.has(blank.expectedWordId) && !content.words.some((word) => word.id === blank.expectedWordId)) {
        context.addIssue({ code: "custom", path: ["sentences", sentenceIndex, "blanks", blankIndex, "expectedWordId"], message: "A resposta da lacuna deve existir no banco de palavras." });
      }

      const marker = `{{${blank.id}}}`;
      if (sentence.text.split(marker).length !== 2) {
        context.addIssue({ code: "custom", path: ["sentences", sentenceIndex, "text"], message: `A frase deve conter exatamente uma marcação ${marker} para esta lacuna.` });
      }
    });

    const markerMatches = sentence.text.match(/\{\{[^{}]+\}\}/g) ?? [];
    const expectedMarkers = sentence.blanks.map((blank) => `{{${blank.id}}}`);
    if (markerMatches.length !== expectedMarkers.length || markerMatches.some((marker) => !expectedMarkers.includes(marker))) {
      context.addIssue({ code: "custom", path: ["sentences", sentenceIndex, "text"], message: "As marcações de lacunas no texto devem corresponder às lacunas cadastradas." });
    }
  });
});

export type SentenceCompletionContent = z.infer<typeof sentenceCompletionContentSchema>;
export type SentenceCompletionWord = z.infer<typeof wordSchema>;
export type SentenceCompletionBlank = z.infer<typeof blankSchema>;
export type SentenceCompletionSentence = z.infer<typeof sentenceSchema>;
