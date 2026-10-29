import {
  Column,
  Entity,
  Index,
  OneToMany,
} from "typeorm";
import { BaseEntity } from "../../../shared/database/entities/BaseEntity";
import { UserStatus } from "../types/UserStatus";
import { UserRole } from "./UserRole";

@Entity("users")
@Index("uq_users_email", { synchronize: false })
export class User extends BaseEntity {
  @Column({ type: "varchar", length: 120 })
  name!: string;

  @Column({ type: "varchar", length: 255 })
  email!: string;

  @Column({ name: "password_hash", type: "varchar", length: 255 })
  passwordHash!: string;

  @Column({
    type: "enum",
    enum: UserStatus,
    enumName: "user_status",
    default: UserStatus.PENDING_VERIFICATION,
  })
  status!: UserStatus;

  @Column({
    name: "email_verified_at",
    type: "timestamptz",
    nullable: true,
  })
  emailVerifiedAt!: Date | null;

  @OneToMany(() => UserRole, (userRole) => userRole.user)
  userRoles!: UserRole[];
}