import type { ActivityDifficulty } from "../ActivityDifficulty";
import type { CrosswordContentWord } from "../../schemas/content/crosswordContent.schema";

export interface CreateCrosswordActivityInput {
  teacherId: string;
  isAdmin: boolean;
  name: string;
  description?: string | null;
  difficulty: ActivityDifficulty;
  timeLimitSeconds?: number | null;
  words: CrosswordContentWord[];
}
