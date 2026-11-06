import { MercadoPagoProvider } from "../providers/MercadoPagoProvider";
import { SubscriptionPaymentRepository } from "../repositories/SubscriptionPaymentRepository";

export interface MercadoPagoWebhookInput {
  eventId: string;
  eventType: string;
  dataId: string;
  payload: unknown;
}

type LocalSubscriptionStatus =
  | "PENDING"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELLED"
  | "EXPIRED";

export class ProcessMercadoPagoWebhookService {
  constructor(
    private readonly repository: SubscriptionPaymentRepository,
    private readonly provider: MercadoPagoProvider,
  ) {}

  async execute(input: MercadoPagoWebhookInput): Promise<boolean> {
    if (input.eventType === "subscription_authorized_payment") {
      const invoice = await this.provider.getAuthorizedPayment(input.dataId);
      const subscription = await this.provider.getSubscription(invoice.preapproval_id);
      const mappedStatus = mapSubscriptionStatus(subscription.status);

      if (!mappedStatus) return false;

      const isRejected =
        invoice.payment?.status === "rejected" ||
        invoice.summarized === "recycling";
      const status =
        isRejected && mappedStatus !== "CANCELLED"
          ? "PAST_DUE"
          : mappedStatus;

      await this.repository.applyWebhookUpdate({
        eventId: input.eventId,
        eventType: input.eventType,
        payload: input.payload,
        providerSubscriptionId: invoice.preapproval_id,
        status,
      });
      return true;
    }

    const subscription = await this.provider.getSubscription(input.dataId);
    const status = mapSubscriptionStatus(subscription.status);

    if (!status) return false;

    await this.repository.applyWebhookUpdate({
      eventId: input.eventId,
      eventType: input.eventType,
      payload: input.payload,
      providerSubscriptionId: subscription.id,
      status,
    });
    return true;
  }
}

function mapSubscriptionStatus(status: string): LocalSubscriptionStatus | null {
  switch (status) {
    case "authorized":
      return "ACTIVE";
    case "pending":
      return "PENDING";
    case "paused":
      return "PAST_DUE";
    case "cancelled":
    case "canceled":
      return "CANCELLED";
    case "expired":
      return "EXPIRED";
    default:
      return null;
  }
}
