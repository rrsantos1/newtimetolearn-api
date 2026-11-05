import { Column, Entity, Index } from "typeorm";
import { BaseEntity } from "../../../shared/database/entities/BaseEntity";

@Entity("notifications")
@Index("idx_notifications_recipient_created", ["recipientId", "createdAt"], { synchronize: false })
@Index("idx_notifications_recipient_unread", ["recipientId", "readAt"], { synchronize: false })
export class Notification extends BaseEntity {
  @Column({ name: "recipient_id", type: "uuid" })
  recipientId!: string;

  @Column({ type: "varchar", length: 80 })
  type!: string;

  @Column({ type: "varchar", length: 160 })
  title!: string;

  @Column({ type: "text" })
  message!: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  link!: string | null;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @Column({ name: "read_at", type: "timestamptz", nullable: true })
  readAt!: Date | null;
}
