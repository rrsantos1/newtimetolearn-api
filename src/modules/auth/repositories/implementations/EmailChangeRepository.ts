

import type { EntityManager } from "typeorm";
import { User } from "../../../users/entities/User";
import { EmailChangeRequest } from "../../entities/EmailChangeRequest";
import { ConfirmEmailChangeResult, IEmailChangeRepository } from "../interfaces/IEmailChangeRepository";
import { AppDataSource } from "../../../../shared/database/data-source";
import { UserStatus } from "../../../users/types/UserStatus";

export class EmailChangeRepository implements IEmailChangeRepository {
  async findUserByIdForUpdate(
    manager: EntityManager,
    userId: string,
  ): Promise<User | null> {
    return manager
      .getRepository(User)
      .createQueryBuilder("user")
      .setLock("pessimistic_write")
      .where("user.id = :userId", { userId })
      .getOne();
  }

  async findUserByEmail(
    manager: EntityManager,
    email: string,
  ): Promise<User | null> {
    return manager
      .getRepository(User)
      .createQueryBuilder("user")
      .where("LOWER(user.email) = LOWER(:email)", { email })
      .getOne();
  }

  async findPendingRequestsForUpdate(
    manager: EntityManager,
    userId: string,
  ): Promise<EmailChangeRequest[]> {
    return manager
      .getRepository(EmailChangeRequest)
      .createQueryBuilder("request")
      .setLock("pessimistic_write")
      .where("request.userId = :userId", { userId })
      .andWhere("request.consumedAt IS NULL")
      .orderBy("request.createdAt", "DESC")
      .getMany();
  }

  async createRequest(
    manager: EntityManager,
    data: Pick<
      EmailChangeRequest,
      "userId" | "newEmail" | "tokenHash" | "expiresAt"
    >,
  ): Promise<EmailChangeRequest> {
    const repository = manager.getRepository(EmailChangeRequest);
    const request = repository.create(data);
    return repository.save(request);
  }

  async consumeRequests(
    manager: EntityManager,
    userId: string,
    consumedAt: Date,
  ): Promise<void> {
    await manager
      .getRepository(EmailChangeRequest)
      .createQueryBuilder()
      .update(EmailChangeRequest)
      .set({ consumedAt })
      .where("userId = :userId", { userId })
      .andWhere("consumedAt IS NULL")
      .execute();
  }

  async findRequestByTokenHash(
    manager: EntityManager,
    tokenHash: string,
  ): Promise<EmailChangeRequest | null> {
    return manager
      .getRepository(EmailChangeRequest)
      .findOneBy({ tokenHash });
  }

  async updateUserEmail(
    manager: EntityManager,
    user: User,
    email: string,
  ): Promise<User> {
    user.email = email;
    return manager.getRepository(User).save(user);
  }

  async saveRequest(
    manager: EntityManager,
    request: EmailChangeRequest,
  ): Promise<EmailChangeRequest> {
    return manager.getRepository(EmailChangeRequest).save(request);
  }
  
  async confirmEmailChange(
    manager: EntityManager,
    userId: string,
    tokenHash: string,
  ): Promise<ConfirmEmailChangeResult> {
    const initialRequest = await this.findRequestByTokenHash(
        manager,
        tokenHash,
    );

    if (!initialRequest || initialRequest.userId !== userId) {
        return "INVALID_TOKEN";
    }

    const user = await this.findUserByIdForUpdate(manager, userId);

    if (!user) {
        return "USER_NOT_FOUND";
    }

    if (user.status !== UserStatus.ACTIVE) {
        return "USER_NOT_ACTIVE";
    }

    const emailRequest = await manager
        .getRepository(EmailChangeRequest)
        .createQueryBuilder("request")
        .setLock("pessimistic_write")
        .where("request.id = :id", { id: initialRequest.id })
        .getOne();

    if (
        !emailRequest ||
        emailRequest.userId !== userId ||
        emailRequest.consumedAt !== null ||
        emailRequest.sentAt === null ||
        emailRequest.expiresAt.getTime() <= Date.now()
    ) {
        return "INVALID_TOKEN";
    }

    const existingUser = await this.findUserByEmail(
        manager,
        emailRequest.newEmail,
    );

    if (existingUser && existingUser.id !== userId) {
        return "EMAIL_ALREADY_IN_USE";
    }

    await this.updateUserEmail(manager, user, emailRequest.newEmail);

    emailRequest.consumedAt = new Date();
    await this.saveRequest(manager, emailRequest);

    return "CONFIRMED";
  }

  async deleteRequest(
    manager: EntityManager,
    requestId: string,
  ): Promise<void> {
    await manager
        .getRepository(EmailChangeRequest)
        .delete({ id: requestId });
  }

  async consumePreviousRequests(
    manager: EntityManager,
    userId: string,
    exceptRequestId: string,
    consumedAt: Date,
  ): Promise<void> {
    await manager
        .getRepository(EmailChangeRequest)
        .createQueryBuilder()
        .update(EmailChangeRequest)
        .set({ consumedAt })
        .where("user_id = :userId", { userId })
        .andWhere("id != :requestId", { requestId: exceptRequestId })
        .andWhere("consumed_at IS NULL")
        .andWhere("sent_at IS NOT NULL")
        .execute();
  }

  async markRequestAsSent(
    manager: EntityManager,
    requestId: string,
    sentAt: Date,
  ): Promise<void> {
    await manager
        .getRepository(EmailChangeRequest)
        .createQueryBuilder()
        .update(EmailChangeRequest)
        .set({ sentAt })
        .where("id = :requestId", { requestId })
        .andWhere("consumed_at IS NULL")
        .execute();
  }

  async findLatestSentRequestForUpdate(
    manager: EntityManager,
    userId: string,
  ): Promise<EmailChangeRequest | null> {
    return manager
        .getRepository(EmailChangeRequest)
        .createQueryBuilder("request")
        .setLock("pessimistic_write")
        .where("request.userId = :userId", { userId })
        .andWhere("request.sentAt IS NOT NULL")
        .andWhere("request.consumedAt IS NULL")
        .orderBy("request.createdAt", "DESC")
        .addOrderBy("request.id", "DESC")
        .getOne();
  }
}