import Fastify, { type FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import jwt from "@fastify/jwt";
import cors from "@fastify/cors";
import { env } from "./shared/config/env";
import { authRoutes } from "./modules/auth/routes/authRoutes";
import { userRoutes } from "./modules/users/routes/userRoutes";
import { activityRoutes } from "./modules/activities/routes/activityRoutes";

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  app.register(rateLimit, { global: false });

  app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: {
      algorithm: "HS256",
      iss: "timetolearn-api",
      aud: "timetolearn-app",
    },
    verify: {
      algorithms: ["HS256"],
      allowedIss: "timetolearn-api",
      allowedAud: "timetolearn-app",
    },
  });

  app.register(cors, {
    origin: [
      "http://localhost:3000"
    ],
    methods: ["POST", "GET", "PUT", "DELETE", "PATCH"],
    credentials: true,
  });

  app.get("/api/v1/health", async () => ({
    success: true,
    data: { status: "ok", service: "timetolearn-api" },
  }));

  app.register(authRoutes, { prefix: "/api/v1/auth" });
  app.register(userRoutes, { prefix: "/api/v1/users" });
  app.register(activityRoutes, { prefix: "/api/v1/activities" });

  return app;
}