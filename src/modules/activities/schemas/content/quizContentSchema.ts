import { z } from "zod";

const quizImageSchema = z.object({
  storageKey: z.string().trim().min(1).max(500),
  altText: z.string().trim().max(250).default(""),
});

const quizOptionSchema = z.object({
  id: z.string().trim().min(1).max(50),
  text: z.string().trim().max(1000).optional().default(""),
  images: z.array(quizImageSchema).max(5).default([]),
}).superRefine((option, context) => {
  if (option.text.length === 0 && option.images.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["text"],
      message: "A alternativa precisa ter texto ou pelo menos uma imagem.",
    });
  }
});

const quizQuestionSchema = z.object({
  id: z.string().trim().min(1).max(50),
  statement: z.string().trim().min(1).max(2000),
  images: z.array(quizImageSchema).max(5).default([]),
  options: z.array(quizOptionSchema).min(3).max(6),
  correctOptionId: z.string().trim().min(1).max(50),
  explanation: z.string().trim().max(2000).optional().default(""),
}).superRefine((question, context) => {
  const optionIds = new Set(question.options.map((option) => option.id));

  if (optionIds.size !== question.options.length) {
    context.addIssue({
      code: "custom",
      path: ["options"],
      message: "Os identificadores das alternativas devem ser únicos.",
    });
  }

  if (!optionIds.has(question.correctOptionId)) {
    context.addIssue({
      code: "custom",
      path: ["correctOptionId"],
      message: "A alternativa correta deve existir entre as opções.",
    });
  }
});

export const quizContentSchema = z.object({
  questions: z.array(quizQuestionSchema).min(1).max(1000),
}).superRefine((content, context) => {
  const questionIds = new Set<string>();

  content.questions.forEach((question, questionIndex) => {
    if (questionIds.has(question.id)) {
      context.addIssue({
        code: "custom",
        path: ["questions", questionIndex, "id"],
        message: "O identificador da questão deve ser único.",
      });
    }

    questionIds.add(question.id);
  });
});

export type QuizContent = z.infer<typeof quizContentSchema>;
