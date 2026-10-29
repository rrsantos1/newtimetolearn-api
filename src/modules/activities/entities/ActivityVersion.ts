import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from "typeorm";
import { BaseEntity } from "../../../shared/database/entities/BaseEntity";
import { ActivityDifficulty } from "../types/ActivityDifficulty";
import { ActivityVersionStatus } from "../types/ActivityVersionStatus";
import { Activity } from "./Activity";

@Entity("activity_versions")
@Index(
  "uq_activity_versions_number",
  ["activityId", "versionNumber"],
  { unique: true },
)
@Index(
  "uq_activity_versions_activity_id",
  ["activityId", "id"],
  { unique: true },
)
@Index(
  "idx_activity_versions_activity_status",
  ["activityId", "status"],
)
export class ActivityVersion extends BaseEntity {
  @Column({ name: "activity_id", type: "uuid" })
  activityId!: string;

  @ManyToOne(
    () => Activity,
    (activity) => activity.versions,
    { onDelete: "RESTRICT" },
  )
  @JoinColumn({ name: "activity_id" })
  activity!: Activity;

  @Column({ name: "version_number", type: "integer" })
  versionNumber!: number;

  @Column({ type: "varchar", length: 120 })
  name!: string;

  @Column({
    type: "varchar",
    length: 2000,
    nullable: true,
  })
  description!: string | null;

  @Column({ type: "varchar", length: 20 })
  difficulty!: ActivityDifficulty;

  @Column({
    name: "time_limit_seconds",
    type: "integer",
    nullable: true,
  })
  timeLimitSeconds!: number | null;

  @Column({ type: "jsonb" })
  content!: Record<string, unknown>;

  @Column({
    type: "varchar",
    length: 30,
    default: ActivityVersionStatus.DRAFT,
  })
  status!: ActivityVersionStatus;

  @Column({
    type: "integer",
    default: 1,
  })
  revision!: number;

  @Column({
    name: "submitted_at",
    type: "timestamptz",
    nullable: true,
  })
  submittedAt!: Date | null;

  @Column({
    name: "published_at",
    type: "timestamptz",
    nullable: true,
  })
  publishedAt!: Date | null;

  @Column({
    name: "generated_data",
    type: "jsonb",
    nullable: true,
  })
  generatedData!: Record<string, unknown> | null;
}