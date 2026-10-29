import bcrypt from "bcryptjs";
import type { ILoginRepository } from "../repositories/interfaces/ILoginRepository";
import { AuthError } from "../errors/AuthError";
import { RoleCode } from "../../users/types/RoleCode";

const JWT_EXPIRATION_SECONDS = {
  "15m": 900,
  "30m": 1800,
  "1h": 3600,
  "2h": 7200,
  "4h": 14400,
  "1d": 86400,
} as const;

export interface LoginInput {
  email: string;
  password: string;
}

export interface AccessTokenPayload {
  sub: string;
  roles: RoleCode[];
}

export type SignAccessToken = (
  payload: AccessTokenPayload,
) => string;

export class LoginService {
  constructor(
    private readonly loginRepository: ILoginRepository,
    private readonly signAccessToken: SignAccessToken,
    private readonly tokenExpiration: keyof typeof JWT_EXPIRATION_SECONDS,
  ) {}

  async execute(input: LoginInput) {
    const user = await this.loginRepository.findByEmail(input.email);

    if (!user) {
      throw new AuthError(
        "INVALID_CREDENTIALS",
        401,
        "Credenciais inválidas",
      );
    }

    const passwordMatches = await bcrypt.compare(
      input.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new AuthError(
        "INVALID_CREDENTIALS",
        401,
        "Credenciais inválidas",
      );
    }

    if (user.status === "PENDING_VERIFICATION") {
      throw new AuthError(
        "EMAIL_NOT_VERIFIED",
        403,
        "E-mail pendente de verificação",
      );
    }

    if (user.status === "BLOCKED") {
      throw new AuthError(
        "ACCOUNT_BLOCKED",
        403,
        "Conta bloqueada. Entre em contato com o suporte.",
      );
    }

    const expiresIn = JWT_EXPIRATION_SECONDS[this.tokenExpiration];

    const accessToken = this.signAccessToken({
      sub: user.id,
      roles: user.roles,
    });

    return {
      accessToken,
      tokenType: "Bearer" as const,
      expiresIn,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roles: user.roles,
      },
    };
  }
}