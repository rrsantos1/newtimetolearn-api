import { AppDataSource } from "../../../shared/database/data-source";

export interface TeacherEntitlements {
  planCode: string;
  planName: string;
  storageLimitBytes: number;
  studentLimit: number | null;
  removesAds: boolean;
  subscriptionStatus: "FREE" | "PENDING" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED";
}

export class TeacherEntitlementsRepository {
  async findByTeacherId(teacherId: string): Promise<TeacherEntitlements> {
    const rows = await AppDataSource.query<Array<Record<string, unknown>>>(
      "SELECT * FROM public.get_teacher_entitlements($1)",
      [teacherId],
    );
    const row = rows[0];
    if (!row) throw new Error("SUBSCRIPTION_FREE_PLAN_NOT_CONFIGURED");
    return {
      planCode: String(row.plan_code),
      planName: String(row.plan_name),
      storageLimitBytes: Number(row.storage_limit_bytes),
      studentLimit: row.student_limit === null ? null : Number(row.student_limit),
      removesAds: Boolean(row.removes_ads),
      subscriptionStatus: String(row.subscription_status) as TeacherEntitlements["subscriptionStatus"],
    };
  }

  async countReservedStudents(teacherId: string): Promise<number> {
    const rows = await AppDataSource.query<Array<{ total: number | string }>>(
      "SELECT COUNT(*)::int AS total FROM public.teacher_student_relationships WHERE teacher_id = $1 AND status IN ('ACTIVE', 'PENDING')",
      [teacherId],
    );
    return Number(rows[0]?.total ?? 0);
  }
}
