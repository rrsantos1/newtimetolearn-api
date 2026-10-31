import type { ActivityDifficulty } from "../ActivityDifficulty";
import type { QuizDraftContent } from "../../schemas/content/quizContentSchema";

export interface CreateQuizActivityInput {
  teacherId: string;
  isAdmin: boolean;
  name: string;
  description?: string | null;
  difficulty: ActivityDifficulty;
  timeLimitSeconds?: number | null;
  content: QuizDraftContent;
}
