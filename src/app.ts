import Fastify, { type FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import jwt from "@fastify/jwt";
import cors from "@fastify/cors";
import { env } from "./shared/config/env";
import { authRoutes } from "./modules/auth/routes/authRoutes";
import { userRoutes } from "./modules/users/routes/userRoutes";
import { activityRoutes } from "./modules/activities/routes/activityRoutes";
import { teacherStudentRoutes } from "./modules/teacher-students/routes/teacherStudentRoutes";
import { notificationRoutes } from "./modules/notifications/routes/notificationRoutes";
import { notebookRoutes } from "./modules/notebooks/routes/notebookRoutes";
import { subscriptionRoutes } from "./modules/subscriptions/routes/subscriptionRoutes";
import { mercadoPagoWebhookRoutes } from "./modules/subscriptions/routes/mercadoPagoWebhookRoutes";
import { marketplaceRoutes, marketplaceWebhookRoutes } from "./modules/marketplace/marketplaceRoutes";

const imageContentTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const marketplaceContentTypes = [
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];
const notebookAttachmentContentTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true, bodyLimit: 5 * 1024 * 1024 });

  app.addContentTypeParser(imageContentTypes, { parseAs: "buffer", bodyLimit: 5 * 1024 * 1024 }, (_request, body, done) => {
    done(null, body);
  });
  app.addContentTypeParser(marketplaceContentTypes, { parseAs: "buffer", bodyLimit: 40 * 1024 * 1024 }, (_request, body, done) => {
    done(null, body);
  });
  app.addContentTypeParser(notebookAttachmentContentTypes, { parseAs: "buffer", bodyLimit: 50 * 1024 * 1024 }, (_request, body, done) => {
    done(null, body);
  });

  app.register(rateLimit, { global: false });
  app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { algorithm: "HS256", iss: "timetolearn-api", aud: "timetolearn-app" },
    verify: { algorithms: ["HS256"], allowedIss: "timetolearn-api", allowedAud: "timetolearn-app" },
  });
  app.register(cors, {
    origin: ["http://localhost:3000"],
    methods: ["POST", "GET", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "x-file-name", "x-alt-text", "x-image-content-type", "x-signature", "x-request-id", "x-marketplace-title", "x-marketplace-description", "x-marketplace-category", "x-marketplace-price-cents"],
    credentials: true,
  });

  app.get("/api/v1/health", async () => ({ success: true, data: { status: "ok", service: "timetolearn-api" } }));
  app.register(authRoutes, { prefix: "/api/v1/auth" });
  app.register(userRoutes, { prefix: "/api/v1/users" });
  app.register(teacherStudentRoutes, { prefix: "/api/v1/teacher-students" });
  app.register(notificationRoutes, { prefix: "/api/v1/notifications" });
  app.register(notebookRoutes, { prefix: "/api/v1/notebooks" });
  app.register(activityRoutes, { prefix: "/api/v1/activities" });
  app.register(subscriptionRoutes, { prefix: "/api/v1/subscriptions" });
  app.register(mercadoPagoWebhookRoutes, { prefix: "/api/v1/webhooks" });
  app.register(marketplaceRoutes, { prefix: "/api/v1/marketplace" });
  app.register(marketplaceWebhookRoutes, { prefix: "/api/v1/webhooks" });
  return app;
}
