import { z } from "zod";

const quizOptionSchema = z.object({
  id: z.string().trim().min(1).max(50),
  text: z.string().trim().min(1).max(500),
});

const quizQuestionSchema = z.object({
  id: z.string().trim().min(1).max(50),
  statement: z.string().trim().min(1).max(2000),
  options: z.array(quizOptionSchema).min(2).max(10),
  correctOptionId: z.string().trim().min(1).max(50),
  explanation: z.string().trim().max(2000).optional(),
});

export const quizContentSchema = z.object({
  questions: z.array(quizQuestionSchema).min(1).max(100),
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

    const optionIds = new Set<string>();

    question.options.forEach((option, optionIndex) => {
      if (optionIds.has(option.id)) {
        context.addIssue({
          code: "custom",
          path: [
            "questions",
            questionIndex,
            "options",
            optionIndex,
            "id",
          ],
          message: "O identificador da alternativa deve ser único.",
        });
      }

      optionIds.add(option.id);
    });

    if (!optionIds.has(question.correctOptionId)) {
      context.addIssue({
        code: "custom",
        path: ["questions", questionIndex, "correctOptionId"],
        message: "A alternativa correta deve existir entre as opções.",
      });
    }
  });
});

export type QuizContent = z.infer<typeof quizContentSchema>;