import { randomUUID } from "node:crypto";
import { AuthError } from "../../auth/errors/AuthError";
import { MercadoPagoProvider } from "../providers/MercadoPagoProvider";
import { SubscriptionPaymentRepository } from "../repositories/SubscriptionPaymentRepository";

export class CreateTeacherSubscriptionService {
  constructor(
    private readonly repository: SubscriptionPaymentRepository,
    private readonly provider: MercadoPagoProvider,
  ) {}

  async execute(teacherId: string): Promise<{ checkoutUrl: string; subscriptionId: string }> {
    const email = await this.repository.findTeacherEmail(teacherId);
    if (!email) throw new AuthError("USER_NOT_FOUND", 404, "Usuário não encontrado.");

    const plan = await this.repository.findPaidPlan();
    if (!plan) throw new Error("SUBSCRIPTION_PLAN_NOT_CONFIGURED");

    const localId = await this.repository.createPendingSubscription(teacherId, plan.id);
    let remoteSubscriptionId: string | null = null;

    try {
      const remote = await this.provider.createSubscription({
        teacherId,
        email,
        amountCents: plan.amount_cents,
        idempotencyKey: randomUUID(),
      });
      remoteSubscriptionId = remote.id || null;
      if (!remoteSubscriptionId || !remote.init_point) {
        throw new Error("MERCADO_PAGO_INVALID_CHECKOUT_RESPONSE");
      }

      await this.repository.setProviderSubscriptionId(localId, remoteSubscriptionId);
      return { checkoutUrl: remote.init_point, subscriptionId: localId };
    } catch (error: unknown) {
      if (remoteSubscriptionId) {
        await this.provider.cancelSubscription(remoteSubscriptionId).catch(() => undefined);
      }
      await this.repository.markSubscriptionCancelled(localId);
      throw error;
    }
  }
}
