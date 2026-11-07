import type { ActivityDifficulty } from "../ActivityDifficulty";
import type { MoleHitContent } from "./MoleHitContent";

export interface CreateMoleHitActivityInput {
  teacherId: string;
  isAdmin: boolean;
  name: string;
  description?: string | null;
  difficulty: ActivityDifficulty;
  timeLimitSeconds?: number | null;
  content: MoleHitContent;
}
