import type { FastifyInstance } from "fastify";
import { env } from "../../../shared/config/env";
import {
  LoginService,
  type AccessTokenPayload,
} from "../services/LoginService";
import { LoginRepository } from "../repositories/implementations/LoginRepository";

export function makeLoginService(app: FastifyInstance): LoginService {
  const loginRepository = new LoginRepository();

  return new LoginService(
    loginRepository,
    (payload: AccessTokenPayload) =>
      app.jwt.sign(payload, {
        expiresIn: env.JWT_EXPIRES_IN,
      }),
    env.JWT_EXPIRES_IN,
  );
}
