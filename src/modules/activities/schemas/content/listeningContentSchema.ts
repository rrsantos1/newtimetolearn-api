import { z } from "zod";

const listeningBlankSchema = z.object({
  id: z.string().trim().min(1).max(50),
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().positive(),
  expectedAnswer: z.string().trim().min(1).max(300),
  alternatives: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
  grammarCategory: z.string().trim().max(80).nullable().optional().default(null),
});

const listeningAudioSchema = z.object({
  storageKey: z.string().trim().max(500).nullable().default(null),
  publicUrl: z.url().nullable().optional().default(null),
  disclosure: z.string().trim().max(200).nullable().optional().default(null),
  status: z.enum(["PENDING", "READY", "STALE", "FAILED"]).default("PENDING"),
  model: z.string().trim().max(100).nullable().optional().default(null),
  voice: z.string().trim().max(100).nullable().optional().default(null),
  textHash: z.string().trim().max(128).nullable().optional().default(null),
  durationSeconds: z.number().nonnegative().nullable().optional().default(null),
});

const listeningPassageSchema = z.object({
  id: z.string().trim().min(1).max(50),
  title: z.string().trim().max(160).default(""),
  text: z.string().max(4096).default(""),
  blanks: z.array(listeningBlankSchema).max(500).default([]),
  audio: listeningAudioSchema.default({
    storageKey: null,
    publicUrl: null,
    disclosure: null,
    status: "PENDING",
    model: null,
    voice: null,
    textHash: null,
    durationSeconds: null,
  }),
}).superRefine((passage, context) => {
  const blankIds = new Set<string>();
  const sortedBlanks = [...passage.blanks].sort((a, b) => a.startOffset - b.startOffset);

  passage.blanks.forEach((blank, index) => {
    if (blankIds.has(blank.id)) {
      context.addIssue({ code: "custom", path: ["blanks", index, "id"], message: "O identificador da lacuna deve ser único no texto." });
    }
    blankIds.add(blank.id);

    if (blank.startOffset >= blank.endOffset || blank.endOffset > passage.text.length) {
      context.addIssue({ code: "custom", path: ["blanks", index], message: "As posições da lacuna são inválidas para o texto." });
      return;
    }

    const sourceText = passage.text.slice(blank.startOffset, blank.endOffset);
    if (sourceText.toLocaleLowerCase("pt-BR") !== blank.expectedAnswer.toLocaleLowerCase("pt-BR")) {
      context.addIssue({ code: "custom", path: ["blanks", index, "expectedAnswer"], message: "A resposta esperada deve corresponder ao trecho selecionado no texto." });
    }
  });

  for (let index = 1; index < sortedBlanks.length; index += 1) {
    const previous = sortedBlanks[index - 1];
    const current = sortedBlanks[index];
    if (previous && current && current.startOffset < previous.endOffset) {
      context.addIssue({ code: "custom", path: ["blanks"], message: "As lacunas não podem se sobrepor." });
    }
  }

  if (passage.audio.status === "READY" && !passage.audio.storageKey) {
    context.addIssue({ code: "custom", path: ["audio", "storageKey"], message: "O áudio pronto precisa ter uma referência de armazenamento." });
  }
});

export const listeningDraftContentSchema = z.object({
  language: z.string().trim().min(2).max(20).default("pt-BR"),
  instructions: z.string().trim().max(2000).default("Ouça o áudio e preencha as lacunas."),
  passages: z.array(listeningPassageSchema).max(50).default([]),
}).superRefine((content, context) => {
  const passageIds = new Set<string>();
  content.passages.forEach((passage, index) => {
    if (passageIds.has(passage.id)) {
      context.addIssue({ code: "custom", path: ["passages", index, "id"], message: "O identificador de cada texto deve ser único." });
    }
    passageIds.add(passage.id);
  });
});

export type ListeningDraftContent = z.infer<typeof listeningDraftContentSchema>;
