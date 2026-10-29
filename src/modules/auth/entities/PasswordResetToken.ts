import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from "typeorm";
import { User } from "../../users/entities/User";

@Entity("password_reset_tokens")
@Index("uq_password_reset_tokens_hash", ["tokenHash"], {
  unique: true,
})
@Index("idx_password_reset_tokens_user_id", ["userId"])
@Index("idx_password_reset_tokens_expires_at", ["expiresAt"])
export class PasswordResetToken {
  @Column({
    name: "id",
    type: "uuid",
    primary: true,
    default: () => "gen_random_uuid()",
  })
  id!: string;

  @Column({
    name: "user_id",
    type: "uuid",
  })
  userId!: string;

  @ManyToOne(() => User, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({
    name: "token_hash",
    type: "varchar",
    length: 64,
  })
  tokenHash!: string;

  @Column({
    name: "expires_at",
    type: "timestamptz",
  })
  expiresAt!: Date;

  @Column({
    name: "consumed_at",
    type: "timestamptz",
    nullable: true,
  })
  consumedAt!: Date | null;

  @Column({
    name: "created_at",
    type: "timestamptz",
    default: () => "NOW()",
  })
  createdAt!: Date;
}