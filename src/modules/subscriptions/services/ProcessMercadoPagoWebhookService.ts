import { MercadoPagoProvider } from "../providers/MercadoPagoProvider";
import { SubscriptionPaymentRepository } from "../repositories/SubscriptionPaymentRepository";

export interface MercadoPagoWebhookInput {
  eventId: string;
  eventType: string;
  dataId: string;
  payload: unknown;
}

export class ProcessMercadoPagoWebhookService {
  constructor(
    private readonly repository: SubscriptionPaymentRepository,
    private readonly provider: MercadoPagoProvider,
  ) {}

  async execute(input: MercadoPagoWebhookInput): Promise<void> {
    const remote = await this.provider.getSubscription(input.dataId);
    await this.repository.applyWebhookUpdate({
      eventId: input.eventId,
      eventType: input.eventType,
      payload: input.payload,
      providerSubscriptionId: remote.id,
      status: mapSubscriptionStatus(remote.status),
    });
  }
}

function mapSubscriptionStatus(status: string): "PENDING" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED" {
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
    default:
      return "EXPIRED";
  }
}
