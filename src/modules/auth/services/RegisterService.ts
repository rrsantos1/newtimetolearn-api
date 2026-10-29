import bcrypt from "bcryptjs";
import { AppDataSource } from "../../../shared/database/data-source";
import { EmailService } from "../../../shared/email/EmailService";
import { UserStatus } from "../../users/types/UserStatus";
import { AuthError } from "../errors/AuthError";
import type { RegisterInput } from "../schemas/registerSchema";
import type { IRegisterRepository } from "../repositories/interfaces/IRegisterRepository";
import { EmailVerificationTokenService } from "./EmailVerificationTokenService";
import { isUniqueConstraintViolation } from "../../../shared/database/isUniqueConstraintViolation";

export class RegisterService {
  constructor(
    private readonly repository: IRegisterRepository,
    private readonly emailService: EmailService,
    private readonly tokenService: EmailVerificationTokenService,
  ) {}

  async execute(input: RegisterInput): Promise<{ message: string }> {
    const passwordHash = await bcrypt.hash(input.password, 12);
    const generatedToken = this.tokenService.generate();

    let user;

    try {
      user = await AppDataSource.transaction(async (manager) => {
        await this.repository.findUserByEmail(manager, input.email);

        const role = await this.repository.findRoleByCode(
          manager,
          input.role,
        );

        if (!role) {
          throw new AuthError(
            "ROLE_NOT_FOUND",
            500,
            "Não foi possível concluir o cadastro.",
          );
        }

        const newUser = await this.repository.createUser(manager, {
          name: input.name,
          email: input.email,
          passwordHash,
          status: UserStatus.PENDING_VERIFICATION,
          emailVerifiedAt: null,
        });

        await this.repository.assignRole(manager, newUser.id, role.id);

        await this.repository.createVerificationToken(manager, {
          userId: newUser.id,
          tokenHash: generatedToken.tokenHash,
          expiresAt: generatedToken.expiresAt,
          consumedAt: null,
        });

        return newUser;
      });
    } catch (error: unknown) {
      if (isUniqueConstraintViolation(error, "uq_users_email")) {
        throw new AuthError(
          "EMAIL_ALREADY_REGISTERED",
          409,
          "Este e-mail já está cadastrado.",
        );
      }

      throw error;
    }

    try {
      await this.emailService.sendVerificationEmail({
        email: user.email,
        name: user.name,
        token: generatedToken.token,
      });
    } catch {
      throw new AuthError(
        "VERIFICATION_EMAIL_FAILED",
        503,
        "A conta foi criada, mas não foi possível enviar o e-mail. Solicite um novo envio.",
      );
    }

    return {
      message: "Cadastro realizado. Confira seu e-mail para ativar a conta.",
    };
  }
}