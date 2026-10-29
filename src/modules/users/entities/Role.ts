import { Column, Entity, Index, OneToMany } from "typeorm";
import { BaseEntity } from "../../../shared/database/entities/BaseEntity";
import { RoleCode } from "../types/RoleCode";
import { UserRole } from "./UserRole";

@Entity("roles")
@Index("uq_roles_code", ["code"], { unique: true })
export class Role extends BaseEntity {
  @Column({
    type: "enum",
    enum: RoleCode,
    enumName: "role_code",
  })
  code!: RoleCode;

  @Column({ type: "varchar", length: 80 })
  name!: string;

  @OneToMany(() => UserRole, (userRole) => userRole.role)
  userRoles!: UserRole[];
}