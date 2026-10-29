import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "../../users/entities/User";

@Entity("email_change_requests")
@Index("uq_email_change_requests_token_hash", ["tokenHash"], {
  unique: true,
})
@Index("idx_email_change_requests_user_id", ["userId"])
@Index("idx_email_change_requests_new_email", ["newEmail"])
@Index("idx_email_change_requests_expires_at", ["expiresAt"])
export class EmailChangeRequest {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ name: "new_email", type: "varchar", length: 255 })
  newEmail!: string;

  @Column({ name: "token_hash", type: "varchar", length: 64 })
  tokenHash!: string;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt!: Date;

  @Column({ name: "consumed_at", type: "timestamptz", nullable: true })
  consumedAt!: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @Column({ name: "sent_at", type: "timestamptz", nullable: true })
  sentAt!: Date | null;
}