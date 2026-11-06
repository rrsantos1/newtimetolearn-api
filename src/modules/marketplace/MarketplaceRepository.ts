import { randomUUID } from "node:crypto";
import { AppDataSource } from "../../shared/database/data-source";

export interface ProductRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  price_cents: number;
  currency: string;
  author_name: string;
  preview_pages: number;
  cover_key: string | null;
  delivery_type: "FILE" | "EXTERNAL_URL";
}

export interface CheckoutProductRow {
  id: string;
  slug: string;
  title: string;
  price_cents: number;
  publisher_type: "ADMIN" | "TEACHER";
  seller_user_id: string;
}

export class MarketplaceRepository {
  async list(q: string, category: string, page: number, limit: number): Promise<{ items: ProductRow[]; total: number }> {
    const items = await AppDataSource.query<ProductRow[]>(
      `SELECT p.id,p.slug,p.title,p.description,p.category,p.price_cents,p.currency,
        u.name AS author_name,p.preview_pages,p.cover_key,p.delivery_type
       FROM marketplace_products p JOIN users u ON u.id=p.seller_user_id
       WHERE p.status='PUBLISHED'
        AND ($1='' OR p.title ILIKE '%'||$1||'%' OR p.description ILIKE '%'||$1||'%')
        AND ($2='' OR p.category=$2)
       ORDER BY p.published_at DESC LIMIT $3 OFFSET $4`,
      [q, category, limit, (page - 1) * limit],
    );
    const count = await AppDataSource.query<Array<{ total: string }>>(
      "SELECT COUNT(*)::text AS total FROM marketplace_products WHERE status='PUBLISHED' AND ($1='' OR title ILIKE '%'||$1||'%' OR description ILIKE '%'||$1||'%') AND ($2='' OR category=$2)",
      [q, category],
    );
    return { items, total: Number(count[0]?.total ?? 0) };
  }

  async detail(slug: string): Promise<ProductRow | null> {
    const rows = await AppDataSource.query<ProductRow[]>(
      `SELECT p.id,p.slug,p.title,p.description,p.category,p.price_cents,p.currency,
        u.name AS author_name,p.preview_pages,p.cover_key
       FROM marketplace_products p JOIN users u ON u.id=p.seller_user_id
       WHERE p.slug=$1 AND p.status='PUBLISHED'`,
      [slug],
    );
    return rows[0] ?? null;
  }

  async checkoutProduct(slug: string): Promise<CheckoutProductRow | null> {
    const rows = await AppDataSource.query<CheckoutProductRow[]>(
      "SELECT id,slug,title,price_cents,publisher_type,seller_user_id FROM marketplace_products WHERE slug=$1 AND status='PUBLISHED'",
      [slug],
    );
    return rows[0] ?? null;
  }

  async previews(id: string): Promise<Array<{ page_number: number; preview_key: string }>> {
    return AppDataSource.query(
      "SELECT page_number,preview_key FROM marketplace_product_previews WHERE product_id=$1 ORDER BY page_number",
      [id],
    );
  }

  async create(input: {
    seller: string;
    publisherType: "ADMIN" | "TEACHER";
    title: string;
    description: string;
    category: string;
    price: number;
    deliveryType: "FILE" | "EXTERNAL_URL";
    externalUrl: string | null;
    originalKey: string | null;
    fileName: string | null;
    type: string | null;
    size: number | null;
    coverKey: string | null;
    previewKeys: string[];
    status: "PENDING_REVIEW" | "PUBLISHED";
  }): Promise<string> {
    return AppDataSource.transaction(async (manager) => {
      const id = randomUUID();
      await manager.query(
        `INSERT INTO marketplace_products
          (id,seller_user_id,publisher_type,title,description,category,price_cents,delivery_type,external_url,
           original_key,original_file_name,original_content_type,original_size_bytes,cover_key,preview_pages,status,published_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
           CASE WHEN $17::boolean THEN CURRENT_TIMESTAMP ELSE NULL END)`,
        [
          id, input.seller, input.publisherType, input.title, input.description, input.category,
          input.price, input.deliveryType, input.externalUrl, input.originalKey, input.fileName,
          input.type, input.size, input.coverKey, input.previewKeys.length, input.status,
          input.status === "PUBLISHED",
        ],
      );
      for (let index = 0; index < input.previewKeys.length; index += 1) {
        await manager.query(
          "INSERT INTO marketplace_product_previews(product_id,page_number,preview_key) VALUES($1,$2,$3)",
          [id, index + 1, input.previewKeys[index]],
        );
      }
      return id;
    });
  }

  async createOrder(productId: string, buyerId: string | null, email: string, amount: number, marketplaceFeeCents: number): Promise<string> {
    const rows = await AppDataSource.query<Array<{ id: string }>>(
      "INSERT INTO marketplace_orders(product_id,buyer_user_id,buyer_email,amount_cents,marketplace_fee_cents,status) SELECT id,$2,$3,$4,$5,'PENDING' FROM marketplace_products WHERE id=$1 AND status='PUBLISHED' AND price_cents=$4 RETURNING id",
      [productId, buyerId, email.toLowerCase(), amount, marketplaceFeeCents],
    );
    if (!rows[0]?.id) throw new Error("MARKETPLACE_PRODUCT_UNAVAILABLE");
    return rows[0].id;
  }

  async setPreference(id: string, preference: string): Promise<void> {
    await AppDataSource.query("UPDATE marketplace_orders SET provider_preference_id=$2 WHERE id=$1", [id, preference]);
  }

  async order(id: string): Promise<{ id: string; amount_cents: number } | null> {
    const rows = await AppDataSource.query<Array<{ id: string; amount_cents: number }>>(
      "SELECT id,amount_cents FROM marketplace_orders WHERE id=$1",
      [id],
    );
    return rows[0] ?? null;
  }

  async applyPayment(input: {
    orderId: string;
    paymentId: string;
    eventId: string;
    status: "APPROVED" | "REJECTED" | "CANCELLED" | "REFUNDED";
    payload: unknown;
  }): Promise<boolean> {
    return AppDataSource.transaction(async (manager) => {
      const event = await manager.query<Array<{ id: string }>>(
        "INSERT INTO marketplace_payment_events(provider_event_id,order_id,payload) VALUES($1,$2,$3::jsonb) ON CONFLICT(provider_event_id) DO NOTHING RETURNING id",
        [input.eventId, input.orderId, JSON.stringify(input.payload)],
      );
      if (!event.length) return false;
      const updated = await manager.query<Array<{ id: string }>>(
        "UPDATE marketplace_orders SET status=$2,provider_payment_id=$3,paid_at=CASE WHEN $2='APPROVED' THEN CURRENT_TIMESTAMP ELSE paid_at END,updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING id",
        [input.orderId, input.status, input.paymentId],
      );
      if (!updated.length) throw new Error("MARKETPLACE_ORDER_NOT_FOUND");
      return true;
    });
  }

  async review(id: string, approved: boolean, note: string): Promise<boolean> {
    const rows = await AppDataSource.query<Array<{ id: string }>>(
      "UPDATE marketplace_products SET status=$2,moderation_note=$3,published_at=CASE WHEN $2='PUBLISHED' THEN CURRENT_TIMESTAMP ELSE NULL END,updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='PENDING_REVIEW' RETURNING id",
      [id, approved ? "PUBLISHED" : "REJECTED", note],
    );
    return rows.length > 0;
  }

  async pending(): Promise<Array<{ id: string; title: string; description: string; category: string; price_cents: number; author_name: string; created_at: string }>> {
    return AppDataSource.query(
      "SELECT p.id,p.title,p.description,p.category,p.price_cents,u.name AS author_name,p.created_at FROM marketplace_products p JOIN users u ON u.id=p.seller_user_id WHERE p.status='PENDING_REVIEW' ORDER BY p.created_at ASC",
    );
  }

  async purchases(userId: string) {
    await AppDataSource.query(
      "UPDATE marketplace_orders o SET buyer_user_id=u.id,updated_at=CURRENT_TIMESTAMP FROM users u WHERE u.id=$1 AND u.email_verified_at IS NOT NULL AND o.buyer_user_id IS NULL AND lower(o.buyer_email)=lower(u.email) AND o.status='APPROVED'",
      [userId],
    );
    return AppDataSource.query(
      "SELECT o.id,p.title,p.original_file_name,p.delivery_type,p.external_url,o.paid_at FROM marketplace_orders o JOIN marketplace_products p ON p.id=o.product_id WHERE o.buyer_user_id=$1 AND o.status='APPROVED' ORDER BY o.paid_at DESC",
      [userId],
    );
  }

  async download(orderId: string, userId: string): Promise<{ key: string } | null> {
    const rows = await AppDataSource.query<Array<{ key: string }>>(
      "SELECT p.original_key AS key FROM marketplace_orders o JOIN marketplace_products p ON p.id=o.product_id WHERE o.id=$1 AND o.buyer_user_id=$2 AND o.status='APPROVED' AND p.status='PUBLISHED'",
      [orderId, userId],
    );
    return rows[0] ?? null;
  }
}
