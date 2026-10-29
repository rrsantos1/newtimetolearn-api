import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from "typeorm";
import { BaseEntity } from "../../../shared/database/entities/BaseEntity";
import { User } from "../../users/entities/User";
import { ActivityStatus } from "../types/ActivityStatus";
import { ActivityType } from "../types/ActivityType";
import { ActivityVisibility } from "../types/ActivityVisibility";
import { ActivityVersion } from "./ActivityVersion";
@Entity("activities")
@Index("uq_activities_slug", ["slug"], { unique: true })
@Index("idx_activities_teacher_status", ["teacherId", "status"])
@Index("idx_activities_type_status", ["type", "status"])
@Index("idx_activities_status_visibility", ["status", "visibility"])
export class Activity extends BaseEntity {
  @Column({ name: "teacher_id", type: "uuid" })
  teacherId!: string;

  @ManyToOne(() => User, {
    onDelete: "RESTRICT",
  })
  @JoinColumn({ name: "teacher_id" })
  teacher!: User;

  @Column({ type: "varchar", length: 50 })
  type!: ActivityType;

  @Column({ type: "varchar", length: 150 })
  slug!: string;

  @Column({
    type: "varchar",
    length: 20,
    default: ActivityStatus.DRAFT,
  })
  status!: ActivityStatus;

  @Column({
    type: "varchar",
    length: 20,
    default: ActivityVisibility.AUTHENTICATED,
  })
  visibility!: ActivityVisibility;

  @Column({
    name: "execution_count",
    type: "integer",
    default: 0,
  })
  executionCount!: number;

  @Column({
    name: "current_published_version_id",
    type: "uuid",
    nullable: true,
  })
  currentPublishedVersionId!: string | null;

  @Column({
    name: "deleted_at",
    type: "timestamptz",
    nullable: true,
  })
  deletedAt!: Date | null;

  @OneToMany(
    () => ActivityVersion,
    (activityVersion) => activityVersion.activity,
  )
  versions!: ActivityVersion[];
}