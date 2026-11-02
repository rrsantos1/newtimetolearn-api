import type { ListeningAttempt, ListeningAttemptAnswer } from "../../entities/ListeningAttempt";

export interface CreateListeningAttemptInput {
  activityId: string;
  activityVersionId: string;
  userId: string;
  studentName: string;
  answers: ListeningAttemptAnswer[];
  totalBlanks: number;
  correctBlanks: number;
  elapsedSeconds: number;
  score: number;
}

export interface ListListeningAttemptsResult {
  items: ListeningAttempt[];
  total: number;
}

export interface IListeningAttemptRepository {
  create(input: CreateListeningAttemptInput): Promise<ListeningAttempt>;
  getRanking(activityId: string): Promise<ListeningAttempt[]>;
  listByActivity(activityId: string, page: number, limit: number): Promise<ListListeningAttemptsResult>;
}
