import "reflect-metadata";
import { DataSource } from "typeorm";
import { env } from "../config/env";
import { Role } from "../../modules/users/entities/Role";
import { User } from "../../modules/users/entities/User";
import { UserRole } from "../../modules/users/entities/UserRole";
import { EmailVerificationToken } from "../../modules/users/entities/EmailVerificationToken";
import { PasswordResetToken } from "../../modules/auth/entities/PasswordResetToken";
import { EmailChangeRequest } from "../../modules/auth/entities/EmailChangeRequest";
import { Activity } from "../../modules/activities/entities/Activity";
import { ActivityVersion } from "../../modules/activities/entities/ActivityVersion";
import { ActivityAttempt } from "../../modules/activities/entities/ActivityAttempt";

if (!env.DATABASE_URL) {
  throw new Error("DATABASE_URL não foi configurada.");
}

export const AppDataSource = new DataSource({
  type: "postgres",
  url: env.DATABASE_URL,
  ssl: env.DB_SSL === "true"
    ? { rejectUnauthorized: true }
    : false,
  entities: [
    User,
    Role,
    UserRole,
    EmailVerificationToken,
    PasswordResetToken,
    EmailChangeRequest,
    Activity,
    ActivityVersion,
    ActivityAttempt,
  ],
  synchronize: false,
  migrationsRun: false,
  logging: env.NODE_ENV === "development",
});
