import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from "typeorm";
import { BaseEntity } from "../../../shared/database/entities/BaseEntity";
import { User } from "../../users/entities/User";
import { TeacherStudentStatus } from "../types/TeacherStudentStatus";

@Entity("teacher_student_relationships")
@Index("idx_teacher_student_teacher_status", ["teacherId", "status"])
@Index("idx_teacher_student_student_status", ["studentId", "status"])
export class TeacherStudentRelationship extends BaseEntity {
  @Column({ name: "teacher_id", type: "uuid" })
  teacherId!: string;

  @Column({ name: "student_id", type: "uuid" })
  studentId!: string;

  @Column({
    type: "enum",
    enum: TeacherStudentStatus,
    enumName: "teacher_student_status",
    default: TeacherStudentStatus.PENDING,
  })
  status!: TeacherStudentStatus;

  @Column({ name: "invited_at", type: "timestamptz" })
  invitedAt!: Date;

  @Column({ name: "responded_at", type: "timestamptz", nullable: true })
  respondedAt!: Date | null;

  @Column({ name: "ended_at", type: "timestamptz", nullable: true })
  endedAt!: Date | null;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "teacher_id" })
  teacher!: User;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "student_id" })
  student!: User;
}
