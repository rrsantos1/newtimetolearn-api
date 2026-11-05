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

const imageContentTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true, bodyLimit: 5 * 1024 * 1024 });

  app.addContentTypeParser(imageContentTypes, { parseAs: "buffer", bodyLimit: 5 * 1024 * 1024 }, (_request, body, done) => {
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
    allowedHeaders: ["Content-Type", "Authorization", "x-file-name", "x-alt-text", "x-image-content-type"],
    credentials: true,
  });

  app.get("/api/v1/health", async () => ({ success: true, data: { status: "ok", service: "timetolearn-api" } }));
  app.register(authRoutes, { prefix: "/api/v1/auth" });
  app.register(userRoutes, { prefix: "/api/v1/users" });
  app.register(teacherStudentRoutes, { prefix: "/api/v1/teacher-students" });
  app.register(notificationRoutes, { prefix: "/api/v1/notifications" });
  app.register(activityRoutes, { prefix: "/api/v1/activities" });
  return app;
}
