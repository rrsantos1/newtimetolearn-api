import { Column, Entity, Index } from "typeorm";
import { BaseEntity } from "../../../shared/database/entities/BaseEntity";

@Entity("notebook_days")
@Index("uq_notebook_days_relationship_date", ["relationshipId", "dayDate"], { unique: true })
export class NotebookDay extends BaseEntity {
  @Column({ name: "relationship_id", type: "uuid" })
  relationshipId!: string;

  @Column({ name: "day_date", type: "date" })
  dayDate!: string;
}
