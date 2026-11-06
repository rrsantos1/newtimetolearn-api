import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../../shared/database/entities/BaseEntity";
import { User } from "../../users/entities/User";
import { Activity } from "./Activity";

@Entity("activity_favorites")
@Index("uq_activity_favorites_user_activity", ["userId", "activityId"], { unique: true })
@Index("idx_activity_favorites_activity", ["activityId"])
export class ActivityFavorite extends BaseEntity {
  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ name: "activity_id", type: "uuid" })
  activityId!: string;

  @ManyToOne(() => Activity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "activity_id" })
  activity!: Activity;
}
