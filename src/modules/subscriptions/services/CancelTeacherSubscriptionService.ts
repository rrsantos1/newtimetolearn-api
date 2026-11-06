import { AuthError } from "../../auth/errors/AuthError";
import { MercadoPagoProvider } from "../providers/MercadoPagoProvider";
import { SubscriptionPaymentRepository } from "../repositories/SubscriptionPaymentRepository";
export class CancelTeacherSubscriptionService {
  constructor(private readonly repository: SubscriptionPaymentRepository, private readonly provider: MercadoPagoProvider) {}
  async execute(teacherId: string): Promise<void> {
    const subscription = await this.repository.findCurrentSubscription(teacherId);
    if (!subscription) throw new AuthError("SUBSCRIPTION_NOT_FOUND", 404, "Nenhuma assinatura vigente foi encontrada.");
    if (subscription.provider_subscription_id) {
      await this.provider.cancelSubscription(subscription.provider_subscription_id);
    }
    await this.repository.markCurrentSubscriptionCancelled(subscription.id);
  }
}