import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  RESEND_API_KEY: z.string().min(1).optional(),

  EMAIL_FROM: z.string().min(1).default("onboarding@resend.dev"),

  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  HOST: z.string().min(1).default("0.0.0.0"),

  DATABASE_URL: z.url().optional(),

  DB_SSL: z
    .enum(["true", "false"])
    .default("false"),

  FRONTEND_URL: z.url().default("http://localhost:3001"),

  JWT_SECRET: z.string().min(32),
  
  JWT_EXPIRES_IN: z
    .enum(["15m", "30m", "1h", "2h", "4h", "1d"])
    .default("1h"),
  });

export const env = envSchema.parse(process.env);