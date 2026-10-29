import type { EntityManager } from "typeorm";
import type { User } from "../../../users/entities/User";
import type { EmailChangeRequest } from "../../entities/EmailChangeRequest";

export type ConfirmEmailChangeResult =
  | "CONFIRMED"
  | "USER_NOT_FOUND"
  | "USER_NOT_ACTIVE"
  | "INVALID_TOKEN"
  | "EMAIL_ALREADY_IN_USE";

export interface IEmailChangeRepository {
  findUserByIdForUpdate(
    manager: EntityManager,
    userId: string,
  ): Promise<User | null>;

  findUserByEmail(
    manager: EntityManager,
    email: string,
  ): Promise<User | null>;

  findPendingRequestsForUpdate(
    manager: EntityManager,
    userId: string,
  ): Promise<EmailChangeRequest[]>;

  createRequest(
    manager: EntityManager,
    data: Pick<
      EmailChangeRequest,
      "userId" | "newEmail" | "tokenHash" | "expiresAt"
    >,
  ): Promise<EmailChangeRequest>;

  consumeRequests(
    manager: EntityManager,
    userId: string,
    consumedAt: Date,
  ): Promise<void>;

  findRequestByTokenHash(
    manager: EntityManager,
    tokenHash: string,
  ): Promise<EmailChangeRequest | null>;

  updateUserEmail(
    manager: EntityManager,
    user: User,
    email: string,
  ): Promise<User>;

  saveRequest(
    manager: EntityManager,
    request: EmailChangeRequest,
  ): Promise<EmailChangeRequest>;

  confirmEmailChange(
    manager: EntityManager,
    userId: string,
    tokenHash: string,
  ): Promise<ConfirmEmailChangeResult>;

  deleteRequest(
    manager: EntityManager,
    requestId: string,
  ): Promise<void>;

  consumePreviousRequests(
    manager: EntityManager,
    userId: string,
    exceptRequestId: string,
    consumedAt: Date,
  ): Promise<void>;

  markRequestAsSent(
    manager: EntityManager,
    requestId: string,
    sentAt: Date,
  ): Promise<void>;

  findLatestSentRequestForUpdate(
    manager: EntityManager,
    userId: string,
  ): Promise<EmailChangeRequest | null>;
}