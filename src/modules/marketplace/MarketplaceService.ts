import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { env } from "../../shared/config/env";
import { AppError } from "../../shared/errors/AppError";
import { BackblazeStorageProvider } from "../../shared/storage/providers/BackblazeStorageProvider";
import { TeacherEntitlementsRepository } from "../subscriptions/repositories/TeacherEntitlementsRepository";
import { MarketplaceRepository } from "./MarketplaceRepository";
import { MarketplaceSellerAccountService } from "./MarketplaceSellerAccountService";
import { PresentationPreviewGenerator } from "./PresentationPreviewGenerator";

const TYPES = new Set([
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);
const EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};

interface CreateProductInput {
  seller: string;
  title: string;
  description: string;
  category: string;
  price: number;
  fileName: string;
  type: string;
  file: Buffer;
}

interface CreateExternalProductInput {
  seller: string;
  title: string;
  description: string;
  category: string;
  price: number;
  externalUrl: string;
  previewFile: Buffer;
}

export class MarketplaceService {
  constructor(
    private readonly repo = new MarketplaceRepository(),
    private readonly storage = new BackblazeStorageProvider(),
    private readonly generator = new PresentationPreviewGenerator(),
    private readonly entitlements = new TeacherEntitlementsRepository(),
    private readonly sellerAccounts = new MarketplaceSellerAccountService(),
  ) {}

  async list(q: string, category: string, page: number, limit: number) {
    const data = await this.repo.list(q, category, page, limit);
    return { ...data, page, limit, pages: Math.ceil(data.total / limit) };
  }

  async detail(slug: string) {
    const product = await this.repo.detail(slug);
    if (!product) throw new AppError("PRODUCT_NOT_FOUND", 404, "Material não encontrado.");
    return {
      ...product,
      previews: Array.from({ length: product.preview_pages }, (_, index) => ({ pageNumber: index + 1 })),
    };
  }
  async sellerProducts(userId: string) {
    return this.repo.sellerProducts(userId);
  }

  async archiveProduct(productId: string, userId: string, isAdmin: boolean): Promise<void> {
    const archived = await this.repo.archiveProduct(productId, userId, isAdmin);
    if (!archived) {
      throw new AppError("PRODUCT_NOT_FOUND_OR_FORBIDDEN", 404, "Material não encontrado ou sem permissão para removê-lo.");
    }
  }


  async createTeacher(input: CreateProductInput): Promise<string> {
    const entitlements = await this.entitlements.findByTeacherId(input.seller);
    if (entitlements.subscriptionStatus !== "ACTIVE" || entitlements.planCode !== "TEACHER_MONTHLY") {
      throw new AppError("ACTIVE_SUBSCRIPTION_REQUIRED", 403, "É necessário ter uma assinatura ativa para publicar materiais à venda.");
    }
    return this.create(input, "PENDING_REVIEW", "TEACHER");
  }

  async createAdmin(input: CreateProductInput): Promise<string> {
    return this.create(input, "PUBLISHED", "ADMIN");
  }

  async createTeacherExternal(input: CreateExternalProductInput): Promise<string> {
    const entitlements = await this.entitlements.findByTeacherId(input.seller);
    if (entitlements.subscriptionStatus !== "ACTIVE" || entitlements.planCode !== "TEACHER_MONTHLY") {
      throw new AppError("ACTIVE_SUBSCRIPTION_REQUIRED", 403, "É necessário ter uma assinatura ativa para publicar materiais à venda.");
    }
    return this.createExternal(input, "PENDING_REVIEW", "TEACHER");
  }

  async createAdminExternal(input: CreateExternalProductInput): Promise<string> {
    return this.createExternal(input, "PUBLISHED", "ADMIN");
  }

  private async createExternal(
    input: CreateExternalProductInput,
    status: "PENDING_REVIEW" | "PUBLISHED",
    publisherType: "ADMIN" | "TEACHER",
  ): Promise<string> {
    const parsedUrl = this.normalizeGoogleSlidesCopyUrl(input.externalUrl);
    const pages = await this.generator.generate(input.previewFile, "application/pdf");
    const folder = `marketplace/${input.seller}/${randomUUID()}`;
    const coverKey = `${folder}/cover.webp`;
    const previewKeys = pages.map((page) => `${folder}/preview-${page.pageNumber}.jpg`);

    try {
      const uploads = await Promise.allSettled([
        this.storage.uploadObject({
          bucketName: env.B2_QUARANTINE_BUCKET_NAME!,
          storageKey: coverKey,
          contentType: "image/webp",
          body: pages[0]!.thumbnailBuffer,
          cacheControl: "private, no-store",
        }),
        ...pages.map((page, index) => this.storage.uploadObject({
          bucketName: env.B2_QUARANTINE_BUCKET_NAME!,
          storageKey: previewKeys[index]!,
          contentType: "image/jpeg",
          body: page.buffer,
          cacheControl: "private, max-age=300",
        })),
      ]);
      const failedUpload = uploads.find((result) => result.status === "rejected");
      if (failedUpload?.status === "rejected") throw failedUpload.reason;

      return await this.repo.create({
        seller: input.seller,
        publisherType,
        title: input.title,
        description: input.description,
        category: input.category,
        price: input.price,
        deliveryType: "EXTERNAL_URL",
        externalUrl: parsedUrl,
        originalKey: null,
        fileName: null,
        type: null,
        size: null,
        coverKey,
        previewKeys,
        status,
      });
    } catch (error: unknown) {
      await Promise.all([coverKey, ...previewKeys]
        .map((key) => this.storage.deleteObject(key, env.B2_QUARANTINE_BUCKET_NAME!)))
        .catch(() => undefined);
      throw error;
    }
  }

  private normalizeGoogleSlidesCopyUrl(value: string): string {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new AppError("INVALID_EXTERNAL_URL", 400, "Informe um link válido do Google Slides.");
    }
    const match = url.hostname === "docs.google.com"
      ? url.pathname.match(/^\/presentation\/d\/([a-zA-Z0-9_-]+)\/(?:edit|copy|present)$/)
      : null;
    if (url.protocol !== "https:" || (url.port !== "" && url.port !== "443") || !match?.[1] || url.username || url.password) {
      throw new AppError("UNSUPPORTED_EXTERNAL_URL", 400, "Por enquanto, aceitamos somente links do Google Slides.");
    }
    return `https://docs.google.com/presentation/d/${match[1]}/copy`;
  }

  private async create(
    input: CreateProductInput,
    status: "PENDING_REVIEW" | "PUBLISHED",
    publisherType: "ADMIN" | "TEACHER",
  ): Promise<string> {
    if (!TYPES.has(input.type)) throw new AppError("INVALID_FILE_TYPE", 400, "Envie PDF, PPT ou PPTX.");
    if (input.file.length > 40 * 1024 * 1024 || input.file.length === 0) {
      throw new AppError("INVALID_FILE_SIZE", 400, "O arquivo deve ter até 40 MB.");
    }

    const pages = await this.generator.generate(input.file, input.type);
    const folder = `marketplace/${input.seller}/${randomUUID()}`;
    const originalKey = `${folder}/original.${EXT[input.type]}`;
    const coverKey = `${folder}/cover.webp`;
    const previewKeys = pages.map((page) => `${folder}/preview-${page.pageNumber}.jpg`);
    const tasks: Promise<void>[] = [
      this.storage.uploadObject({
        bucketName: env.B2_QUARANTINE_BUCKET_NAME!,
        storageKey: originalKey,
        contentType: input.type,
        body: input.file,
        cacheControl: "private, no-store",
      }),
      this.storage.uploadObject({
        bucketName: env.B2_QUARANTINE_BUCKET_NAME!,
        storageKey: coverKey,
        contentType: "image/webp",
        body: pages[0]!.thumbnailBuffer,
        cacheControl: "private, no-store",
      }),
    ];
    pages.forEach((page, index) => tasks.push(this.storage.uploadObject({
      bucketName: env.B2_QUARANTINE_BUCKET_NAME!,
      storageKey: previewKeys[index]!,
      contentType: "image/jpeg",
      body: page.buffer,
      cacheControl: "private, max-age=300",
    })));
    try {
      const uploads = await Promise.allSettled(tasks);
      const failedUpload = uploads.find((result) => result.status === "rejected");
      if (failedUpload?.status === "rejected") throw failedUpload.reason;

      return await this.repo.create({
        seller: input.seller,
        publisherType,
        title: input.title,
        description: input.description,
        category: input.category,
        price: input.price,
        deliveryType: "FILE",
        externalUrl: null,
        originalKey,
        fileName: input.fileName.replaceAll("\\", "_").replaceAll("/", "_").replace(/[\\r\\n\\0]/g, "_").slice(0, 180),
        type: input.type,
        size: input.file.length,
        coverKey,
        previewKeys,
        status,
      });
    } catch (error: unknown) {
      await Promise.all([originalKey, coverKey, ...previewKeys]
        .map((key) => this.storage.deleteObject(key, env.B2_QUARANTINE_BUCKET_NAME!)))
        .catch(() => undefined);
      throw error;
    }
  }

  async cover(slug: string): Promise<{ buffer: Buffer; contentType: string }> {
    const product = await this.repo.detail(slug);
    if (!product?.cover_key) throw new AppError("COVER_NOT_FOUND", 404, "Capa não encontrada.");
    const buffer = (await this.storage.downloadObject(product.cover_key, env.B2_QUARANTINE_BUCKET_NAME!)).body;
    const metadata = await sharp(buffer).metadata();
    const contentType = metadata.format === "webp" ? "image/webp" : "image/jpeg";
    return { buffer, contentType };
  }

  async preview(slug: string, page: number): Promise<Buffer> {
    const product = await this.repo.detail(slug);
    if (!product) throw new AppError("PRODUCT_NOT_FOUND", 404, "Material não encontrado.");
    const item = (await this.repo.previews(product.id)).find((preview) => preview.page_number === page);
    if (!item) throw new AppError("PREVIEW_NOT_FOUND", 404, "Página não encontrada.");
    return (await this.storage.downloadObject(item.preview_key, env.B2_QUARANTINE_BUCKET_NAME!)).body;
  }

  async checkout(slug: string, buyerId: string | null, email: string) {
    if (env.MERCADO_PAGO_ENABLED !== "true" || !env.MERCADO_PAGO_ACCESS_TOKEN) {
      throw new AppError("MERCADO_PAGO_DISABLED", 503, "O pagamento está temporariamente indisponível.");
    }
    const product = await this.repo.checkoutProduct(slug);
    if (!product) throw new AppError("PRODUCT_NOT_FOUND", 404, "Material não encontrado.");

    const amountCents = Number(product.price_cents);
    const isTeacherSale = product.publisher_type === "TEACHER";
    const token = isTeacherSale
      ? await this.sellerAccounts.getAccessTokenForTeacher(product.seller_user_id)
      : env.MERCADO_PAGO_ACCESS_TOKEN;
    const marketplaceFeeCents = isTeacherSale
      ? Math.round((amountCents * env.MARKETPLACE_COMMISSION_PERCENT) / 100)
      : 0;
    const orderId = await this.repo.createOrder(product.id, buyerId, email, amountCents, marketplaceFeeCents);

    const preferenceBody: Record<string, unknown> = {
      items: [{
        id: orderId,
        title: product.title.slice(0, 250),
        quantity: 1,
        currency_id: "BRL",
        unit_price: amountCents / 100,
      }],
      payer: { email },
      external_reference: orderId,
      metadata: { order_id: orderId },
      notification_url: `${env.API_PUBLIC_URL}/api/v1/webhooks/marketplace`,
      back_urls: {
        success: `${env.FRONTEND_URL}/marketplace/checkout/success`,
        failure: `${env.FRONTEND_URL}/marketplace/checkout/failure`,
        pending: `${env.FRONTEND_URL}/marketplace/checkout/pending`,
      },
      auto_return: "approved",
    };
    if (isTeacherSale) preferenceBody.marketplace_fee = marketplaceFeeCents / 100;

    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": randomUUID(),
      },
      body: JSON.stringify(preferenceBody),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`MARKETPLACE_PREFERENCE_FAILED: HTTP ${response.status} - ${body.slice(0, 500)}`);
    }
    const data = await response.json() as { id?: string; init_point?: string };
    if (!data.id || !data.init_point) throw new Error("INVALID_PREFERENCE");
    await this.repo.setPreference(orderId, data.id);
    return { orderId, checkoutUrl: data.init_point };
  }

  async payment(
    paymentId: string,
    eventId: string,
    payload: unknown,
    sellerMpUserId?: string,
  ): Promise<boolean> {
    const token = sellerMpUserId
      ? await this.sellerAccounts.getAccessTokenForMercadoPagoUser(sellerMpUserId)
      : null;
    const accessToken = token ?? env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) throw new Error("PAYMENT_TOKEN_MISSING");

    const response = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok) throw new Error("PAYMENT_LOOKUP_FAILED");
    const payment = await response.json() as {
      id: string;
      status: string;
      external_reference: string;
      transaction_amount: number;
      currency_id: string;
      collector_id?: number | string;
    };
    if (sellerMpUserId && payment.collector_id && String(payment.collector_id) !== sellerMpUserId) {
      throw new Error("PAYMENT_SELLER_MISMATCH");
    }
    const order = await this.repo.order(payment.external_reference);
    if (!order || payment.currency_id !== "BRL" || Math.round(payment.transaction_amount * 100) !== Number(order.amount_cents)) {
      throw new Error("PAYMENT_ORDER_MISMATCH");
    }

    const status = payment.status === "approved" ? "APPROVED"
      : payment.status === "rejected" ? "REJECTED"
      : payment.status === "cancelled" ? "CANCELLED"
      : payment.status === "refunded" || payment.status === "charged_back" ? "REFUNDED"
      : null;
    if (!status) return false;
    return this.repo.applyPayment({
      orderId: order.id,
      paymentId: String(payment.id),
      eventId,
      status,
      payload,
    });
  }

  async sellerConnectionStatus(userId: string) {
    return this.sellerAccounts.getConnectionStatus(userId);
  }

  async sellerConnectionUrl(userId: string) {
    return this.sellerAccounts.createAuthorizationUrl(userId);
  }

  async completeSellerConnection(code: string, state: string) {
    return this.sellerAccounts.completeAuthorization(code, state);
  }

  async review(id: string, approved: boolean, note: string): Promise<void> {
    const changed = await this.repo.review(id, approved, note);
    if (!changed) throw new AppError("PRODUCT_NOT_PENDING", 409, "Este material não está aguardando moderação.");
  }

  async pending() {
    return this.repo.pending();
  }

  async purchases(userId: string) {
    return this.repo.purchases(userId);
  }

  async download(orderId: string, userId: string) {
    const row = await this.repo.download(orderId, userId);
    if (!row) throw new AppError("DOWNLOAD_FORBIDDEN", 403, "Compra não aprovada.");
    return this.storage.createDownloadUrl(row.key, env.B2_QUARANTINE_BUCKET_NAME!, 120);
  }
}
