import { ActivityDifficulty } from "../ActivityDifficulty";

export interface CreateWordSearchActivityInput {
  teacherId: string;
  name: string;
  description?: string | null;
  difficulty: ActivityDifficulty;
  timeLimitSeconds?: number | null;
  words: string[];
}