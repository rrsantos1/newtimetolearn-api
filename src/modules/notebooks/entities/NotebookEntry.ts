import { Column, Entity, Index } from "typeorm";
import { BaseEntity } from "../../../shared/database/entities/BaseEntity";

export type NotebookEntryKind = "TEXT" | "IMAGE" | "ACTIVITY_LINK" | "FILE";

@Entity("notebook_entries")
@Index("idx_notebook_entries_day_position", ["dayId", "position"])
export class NotebookEntry extends BaseEntity {
  @Column({ name: "day_id", type: "uuid" })
  dayId!: string;

  @Column({ name: "created_by", type: "uuid" })
  createdBy!: string;

  @Column({ type: "varchar", length: 30 })
  kind!: NotebookEntryKind;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  content!: Record<string, unknown>;

  @Column({ type: "integer", default: 0 })
  position!: number;

  @Column({ name: "deleted_at", type: "timestamptz", nullable: true })
  deletedAt!: Date | null;

  @Column({ name: "deleted_by", type: "uuid", nullable: true })
  deletedBy!: string | null;
}
