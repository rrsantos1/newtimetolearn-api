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

export interface IListeningAttemptRepository {
  create(input: CreateListeningAttemptInput): Promise<ListeningAttempt>;
  getRanking(activityId: string): Promise<ListeningAttempt[]>;
}
