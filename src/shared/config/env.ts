import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  RESEND_API_KEY: z.string().min(1).optional(),
  GOOGLE_VISION_API_KEY: z.string().min(1).optional(),

  B2_S3_ENDPOINT: z.url().optional(),
  B2_REGION: z.string().min(1).optional(),
  B2_BUCKET_NAME: z.string().min(1).optional(),
  B2_APPLICATION_KEY_ID: z.string().min(1).optional(),
  B2_APPLICATION_KEY: z.string().min(1).optional(),
  B2_PUBLIC_BASE_URL: z.url().optional(),

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

const parsedEnv = envSchema.parse(process.env);

const storageEnvKeys = [
  parsedEnv.B2_S3_ENDPOINT,
  parsedEnv.B2_REGION,
  parsedEnv.B2_BUCKET_NAME,
  parsedEnv.B2_APPLICATION_KEY_ID,
  parsedEnv.B2_APPLICATION_KEY,
  parsedEnv.B2_PUBLIC_BASE_URL,
];
const configuredStorageValues = storageEnvKeys.filter((value) => value !== undefined);

if (configuredStorageValues.length > 0 && configuredStorageValues.length !== storageEnvKeys.length) {
  throw new Error("As variáveis do Backblaze B2 devem ser configuradas em conjunto.");
}

export const env = parsedEnv;