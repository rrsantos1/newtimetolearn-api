import { AppDataSource } from "../../../shared/database/data-source";
export interface PaidSubscriptionPlan { id: string; amount_cents: number; }
export interface CurrentProviderSubscription { id: string; provider_subscription_id: string | null; status: "PENDING" | "ACTIVE" | "PAST_DUE"; }
export interface SubscriptionWebhookUpdate {
  eventId: string; eventType: string; payload: unknown; providerSubscriptionId: string;
  status: "PENDING" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED";
}
export class SubscriptionPaymentRepository {
  async findTeacherEmail(teacherId: string): Promise<string | null> {
    const rows = await AppDataSource.query<Array<{ email: string }>>("SELECT email FROM public.users WHERE id = $1 LIMIT 1", [teacherId]);
    return rows[0]?.email ?? null;
  }
  async findPaidPlan(): Promise<PaidSubscriptionPlan | null> {
    const rows = await AppDataSource.query<PaidSubscriptionPlan[]>("SELECT id, amount_cents FROM public.subscription_plans WHERE code = 'TEACHER_MONTHLY' AND is_active = TRUE LIMIT 1");
    return rows[0] ?? null;
  }
  async createPendingSubscription(teacherId: string, planId: string): Promise<string> {
    return AppDataSource.transaction(async (manager) => {
      await manager.query("SELECT id FROM public.users WHERE id = $1 FOR UPDATE", [teacherId]);
      await manager.query(
        "UPDATE public.teacher_subscriptions SET status = 'CANCELLED', cancelled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE teacher_id = $1 AND status = 'PENDING' AND created_at < CURRENT_TIMESTAMP - INTERVAL '30 minutes'",
        [teacherId],
      );
      const existing = await manager.query<Array<{ id: string }>>("SELECT id FROM public.teacher_subscriptions WHERE teacher_id = $1 AND status IN ('PENDING', 'ACTIVE') LIMIT 1", [teacherId]);
      if (existing.length > 0) throw new Error("SUBSCRIPTION_ALREADY_EXISTS");
      const rows = await manager.query<Array<{ id: string }>>("INSERT INTO public.teacher_subscriptions (teacher_id, plan_id, status, provider) VALUES ($1, $2, 'PENDING', 'MERCADO_PAGO') RETURNING id", [teacherId, planId]);
      const id = rows[0]?.id;
      if (!id) throw new Error("SUBSCRIPTION_PENDING_CREATE_FAILED");
      return id;
    });
  }
  async setProviderSubscriptionId(localId: string, providerId: string): Promise<void> {
    await AppDataSource.query("UPDATE public.teacher_subscriptions SET provider_subscription_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1", [localId, providerId]);
  }
  async markSubscriptionCancelled(localId: string): Promise<void> {
    await AppDataSource.query("UPDATE public.teacher_subscriptions SET status = 'CANCELLED', cancelled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = 'PENDING'", [localId]);
  }
  async findCurrentSubscription(teacherId: string): Promise<CurrentProviderSubscription | null> {
    const rows = await AppDataSource.query<CurrentProviderSubscription[]>(
      "SELECT id, provider_subscription_id, status FROM public.teacher_subscriptions WHERE teacher_id = $1 AND status IN ('PENDING', 'ACTIVE', 'PAST_DUE') ORDER BY created_at DESC LIMIT 1",
      [teacherId],
    );
    return rows[0] ?? null;
  }
  async markCurrentSubscriptionCancelled(localId: string): Promise<void> {
    await AppDataSource.query(
      "UPDATE public.teacher_subscriptions SET status = 'CANCELLED', cancelled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status IN ('PENDING', 'ACTIVE', 'PAST_DUE')",
      [localId],
    );
  }
  async applyWebhookUpdate(input: SubscriptionWebhookUpdate): Promise<boolean> {
    return AppDataSource.transaction(async (manager) => {
      const inserted = await manager.query<Array<{ id: string }>>(
        `INSERT INTO public.subscription_payment_events (provider, provider_event_id, event_type, payload)
         VALUES ('MERCADO_PAGO', $1, $2, $3::jsonb) ON CONFLICT (provider, provider_event_id) DO NOTHING RETURNING id`,
        [input.eventId, input.eventType, JSON.stringify(input.payload)],
      );
      if (inserted.length === 0) return false;
      const updated = await manager.query<Array<{ id: string }>>(
        `UPDATE public.teacher_subscriptions SET status = $2,
         cancelled_at = CASE WHEN $2 = 'CANCELLED' THEN CURRENT_TIMESTAMP ELSE cancelled_at END,
         updated_at = CURRENT_TIMESTAMP
         WHERE provider = 'MERCADO_PAGO' AND provider_subscription_id = $1 RETURNING id`,
        [input.providerSubscriptionId, input.status],
      );
      if (updated.length === 0) throw new Error("SUBSCRIPTION_WEBHOOK_REFERENCE_NOT_FOUND");
      await manager.query("UPDATE public.subscription_payment_events SET processed_at = CURRENT_TIMESTAMP WHERE provider = 'MERCADO_PAGO' AND provider_event_id = $1", [input.eventId]);
      return true;
    });
  }
}