import { Column, Entity, Index } from "typeorm";
import { BaseEntity } from "../../../shared/database/entities/BaseEntity";

@Entity("activity_attempts")
@Index("idx_activity_attempts_activity_score", ["activityId", "score"])
@Index("idx_activity_attempts_user_created", ["userId", "createdAt"])
export class ActivityAttempt extends BaseEntity {
  @Column({ name: "activity_id", type: "uuid" })
  activityId!: string;

  @Column({ name: "activity_version_id", type: "uuid" })
  activityVersionId!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @Column({ name: "student_name", type: "varchar", length: 120 })
  studentName!: string;

  @Column({ name: "words_found", type: "text", array: true })
  wordsFound!: string[];

  @Column({ name: "total_words", type: "integer" })
  totalWords!: number;

  @Column({ name: "elapsed_seconds", type: "integer" })
  elapsedSeconds!: number;

  @Column({ type: "integer" })
  score!: number;

  @Column({ name: "accuracy_points", type: "integer" })
  accuracyPoints!: number;

  @Column({ name: "speed_points", type: "integer" })
  speedPoints!: number;
}
