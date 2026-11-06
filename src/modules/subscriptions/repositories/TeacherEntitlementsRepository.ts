import { AppDataSource } from "../../../shared/database/data-source";

export interface TeacherEntitlements {
  planCode: string;
  planName: string;
  storageLimitBytes: number;
  studentLimit: number | null;
  removesAds: boolean;
  subscriptionStatus: "FREE" | "PENDING" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED";
}

interface TeacherEntitlementsRow {
  plan_code: string;
  plan_name: string;
  storage_limit_bytes: string | number;
  student_limit: number | null;
  removes_ads: boolean;
  subscription_status: TeacherEntitlements["subscriptionStatus"];
}

export class TeacherEntitlementsRepository {
  async findByTeacherId(teacherId: string): Promise<TeacherEntitlements> {
    const rows = await AppDataSource.query<TeacherEntitlementsRow[]>(
      `WITH free_plan AS (
        SELECT code, name, storage_limit_bytes, student_limit, removes_ads
        FROM public.subscription_plans
        WHERE code = 'FREE' AND is_active = TRUE
        LIMIT 1
      ),
      latest_subscription AS (
        SELECT
          subscription.status,
          subscription.current_period_end,
          plan.code,
          plan.name,
          plan.storage_limit_bytes,
          plan.student_limit,
          plan.removes_ads,
          plan.is_active
        FROM public.teacher_subscriptions subscription
        INNER JOIN public.subscription_plans plan ON plan.id = subscription.plan_id
        WHERE subscription.teacher_id = $1
        ORDER BY subscription.created_at DESC
        LIMIT 1
      )
      SELECT
        CASE WHEN latest.status = 'ACTIVE'
          AND latest.is_active = TRUE
          AND (latest.current_period_end IS NULL OR latest.current_period_end > CURRENT_TIMESTAMP)
          THEN latest.code ELSE free_plan.code END AS plan_code,
        CASE WHEN latest.status = 'ACTIVE'
          AND latest.is_active = TRUE
          AND (latest.current_period_end IS NULL OR latest.current_period_end > CURRENT_TIMESTAMP)
          THEN latest.name ELSE free_plan.name END AS plan_name,
        CASE WHEN latest.status = 'ACTIVE'
          AND latest.is_active = TRUE
          AND (latest.current_period_end IS NULL OR latest.current_period_end > CURRENT_TIMESTAMP)
          THEN latest.storage_limit_bytes ELSE free_plan.storage_limit_bytes END AS storage_limit_bytes,
        CASE WHEN latest.status = 'ACTIVE'
          AND latest.is_active = TRUE
          AND (latest.current_period_end IS NULL OR latest.current_period_end > CURRENT_TIMESTAMP)
          THEN latest.student_limit ELSE free_plan.student_limit END AS student_limit,
        CASE WHEN latest.status = 'ACTIVE'
          AND latest.is_active = TRUE
          AND (latest.current_period_end IS NULL OR latest.current_period_end > CURRENT_TIMESTAMP)
          THEN latest.removes_ads ELSE free_plan.removes_ads END AS removes_ads,
        CASE
          WHEN latest.status = 'ACTIVE'
            AND latest.current_period_end IS NOT NULL
            AND latest.current_period_end <= CURRENT_TIMESTAMP THEN 'EXPIRED'
          ELSE COALESCE(latest.status, 'FREE')
        END AS subscription_status
      FROM free_plan
      LEFT JOIN latest_subscription latest ON TRUE`,
      [teacherId],
    );

    const row = rows[0];
    if (!row) throw new Error("SUBSCRIPTION_FREE_PLAN_NOT_CONFIGURED");

    return {
      planCode: row.plan_code,
      planName: row.plan_name,
      storageLimitBytes: Number(row.storage_limit_bytes),
      studentLimit: row.student_limit === null ? null : Number(row.student_limit),
      removesAds: row.removes_ads,
      subscriptionStatus: row.subscription_status,
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
