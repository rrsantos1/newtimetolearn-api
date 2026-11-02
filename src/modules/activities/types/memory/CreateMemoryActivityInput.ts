import type { ActivityDifficulty } from "../ActivityDifficulty";
import type { MemoryContent } from "../../schemas/content/memoryContentSchema";

export interface CreateMemoryActivityInput {
  teacherId: string;
  isAdmin: boolean;
  name: string;
  description?: string | null;
  difficulty: ActivityDifficulty;
  timeLimitSeconds?: number | null;
  content: MemoryContent;
}
