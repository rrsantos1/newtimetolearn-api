import type { ActivityAttempt } from "../../entities/ActivityAttempt";

export interface CreateActivityAttemptInput {
  activityId: string;
  activityVersionId: string;
  userId: string;
  studentName: string;
  wordsFound: string[];
  totalWords: number;
  elapsedSeconds: number;
  score: number;
  accuracyPoints: number;
  speedPoints: number;
}

export interface ListActivityAttemptsResult {
  items: ActivityAttempt[];
  total: number;
}

export interface IActivityAttemptRepository {
  create(input: CreateActivityAttemptInput): Promise<ActivityAttempt>;
  getRanking(activityId: string): Promise<ActivityAttempt[]>;
  listByActivity(
    activityId: string,
    page: number,
    limit: number,
  ): Promise<ListActivityAttemptsResult>;
}
