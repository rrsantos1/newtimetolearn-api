import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from "typeorm";

import { User } from "./User";
import { Role } from "./Role";

@Entity("user_roles")
export class UserRole {
  @PrimaryColumn({ name: "user_id", type: "uuid" })
  userId!: string;

  @PrimaryColumn({ name: "role_id", type: "uuid" })
  roleId!: string;

  @ManyToOne(() => User, (user) => user.userRoles, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @ManyToOne(() => Role, (role) => role.userRoles, {
    onDelete: "RESTRICT",
  })
  @JoinColumn({ name: "role_id" })
  role!: Role;

  @CreateDateColumn({
    name: "created_at",
    type: "timestamptz",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt!: Date;
}