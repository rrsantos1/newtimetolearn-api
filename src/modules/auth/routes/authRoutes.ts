import type { FastifyInstance } from "fastify";
import { registerController } from "../controllers/registerController";
import { resendVerificationController } from "../controllers/resendVerificationController";
import { verifyEmailController } from "../controllers/verifyEmailController";
import { loginController } from "../controllers/loginController";
import { forgotPasswordController } from "../controllers/forgotPasswordController";
import { resetPasswordController } from "../controllers/resetPasswordController";
import { authMiddleware } from "../../../shared/http/middlewares/authMiddleware";
import { requestEmailChangeController } from "../controllers/requestEmailChangeController";
import { confirmEmailChangeController } from "../controllers/confirmEmailChangeController";
import { changePasswordController } from "../controllers/changePasswordController";

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/register", registerController);

  app.post("/verify-email", verifyEmailController);

  app.post(
    "/resend-verification",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "15 minutes",
        },
      },
    },
    resendVerificationController,
  );

  app.post(
    "/login",
    {
        config: {
            rateLimit: {
                max: 10,
                timeWindow: "15 minutes",
            },
        },
    },
    loginController,
  );

  app.post(
    "/forgot-password",
    {
        config: {
        rateLimit: {
            max: 5,
            timeWindow: "15 minutes",
        },
        },
    },
    forgotPasswordController,
  );

  app.post(
    "/reset-password",
    {
        config: {
        rateLimit: {
            max: 5,
            timeWindow: "15 minutes",
        },
        },
    },
    resetPasswordController,
  );

  app.post(
    "/request-email-change",
    {
        preHandler: authMiddleware,
        config: {
            rateLimit: {
                max: 5,
                timeWindow: "15 minutes",
            },
        },
    },
    requestEmailChangeController,
  );

  app.post(
    "/confirm-email-change",
    {
        preHandler: authMiddleware,
        config: {
            rateLimit: {
                max: 5,
                timeWindow: "15 minutes",
            },
        },
    },
    confirmEmailChangeController,
  );

  app.post(
    "/change-password",
    {
      preHandler: authMiddleware,
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "15 minutes",
        },
      },
    },
    changePasswordController,
  );
}