import { Column, Entity, Index } from "typeorm";
import { BaseEntity } from "../../../shared/database/entities/BaseEntity";

@Entity("notebook_notes")
@Index("idx_notebook_notes_relationship_created", ["relationshipId", "createdAt"])
export class NotebookNote extends BaseEntity {
  @Column({ name: "relationship_id", type: "uuid" })
  relationshipId!: string;

  @Column({ name: "author_id", type: "uuid" })
  authorId!: string;

  @Column({ name: "parent_id", type: "uuid", nullable: true })
  parentId!: string | null;

  @Column({ type: "text" })
  message!: string;
}
