import type { ActivityDifficulty } from "../ActivityDifficulty";
import type { ListeningDraftContent } from "../../schemas/content/listeningContentSchema";

export interface CreateListeningActivityInput {
  teacherId: string;
  isAdmin: boolean;
  name: string;
  description?: string | null;
  difficulty: ActivityDifficulty;
  timeLimitSeconds?: number | null;
  content: ListeningDraftContent;
}
