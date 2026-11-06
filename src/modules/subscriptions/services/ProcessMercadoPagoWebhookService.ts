import { MercadoPagoProvider } from "../providers/MercadoPagoProvider";
import { SubscriptionPaymentRepository } from "../repositories/SubscriptionPaymentRepository";
export interface MercadoPagoWebhookInput { eventId: string; eventType: string; dataId: string; payload: unknown; }
export class ProcessMercadoPagoWebhookService {
  constructor(private readonly repository: SubscriptionPaymentRepository, private readonly provider: MercadoPagoProvider) {}
  async execute(input: MercadoPagoWebhookInput): Promise<void> {
    if (input.eventType === "subscription_authorized_payment") {
      const invoice = await this.provider.getAuthorizedPayment(input.dataId);
      const isRejected = invoice.payment?.status === "rejected" || invoice.summarized === "recycling";
      const subscription = await this.provider.getSubscription(invoice.preapproval_id);
      await this.repository.applyWebhookUpdate({
        eventId: input.eventId, eventType: input.eventType, payload: input.payload,
        providerSubscriptionId: invoice.preapproval_id,
        status: isRejected ? "PAST_DUE" : mapSubscriptionStatus(subscription.status),
      });
      return;
    }
    const subscription = await this.provider.getSubscription(input.dataId);
    await this.repository.applyWebhookUpdate({
      eventId: input.eventId, eventType: input.eventType, payload: input.payload,
      providerSubscriptionId: subscription.id, status: mapSubscriptionStatus(subscription.status),
    });
  }
}
function mapSubscriptionStatus(status: string): "PENDING" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED" {
  switch (status) {
    case "authorized": return "ACTIVE";
    case "pending": return "PENDING";
    case "paused": return "PAST_DUE";
    case "cancelled":
    case "canceled": return "CANCELLED";
    default: return "EXPIRED";
  }
}