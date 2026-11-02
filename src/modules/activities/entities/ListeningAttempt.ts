import { Column, Entity, Index } from "typeorm";
import { BaseEntity } from "../../../shared/database/entities/BaseEntity";

export interface ListeningAttemptAnswer {
  passageId: string;
  blankId: string;
  answer: string;
  isCorrect: boolean;
}

@Entity("listening_attempts")
@Index("idx_listening_attempts_activity_score", ["activityId", "score"])
@Index("idx_listening_attempts_user_created", ["userId", "createdAt"])
export class ListeningAttempt extends BaseEntity {
  @Column({ name: "activity_id", type: "uuid" })
  activityId!: string;

  @Column({ name: "activity_version_id", type: "uuid" })
  activityVersionId!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @Column({ name: "student_name", type: "varchar", length: 120 })
  studentName!: string;

  @Column({ type: "jsonb" })
  answers!: ListeningAttemptAnswer[];

  @Column({ name: "total_blanks", type: "integer" })
  totalBlanks!: number;

  @Column({ name: "correct_blanks", type: "integer" })
  correctBlanks!: number;

  @Column({ name: "elapsed_seconds", type: "integer" })
  elapsedSeconds!: number;

  @Column({ type: "integer" })
  score!: number;
}
