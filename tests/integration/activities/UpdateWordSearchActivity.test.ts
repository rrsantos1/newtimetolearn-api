import type { FastifyInstance } from "fastify";
import { In } from "typeorm";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import { buildApp } from "../../../src/app";
import { Activity } from "../../../src/modules/activities/entities/Activity";
import { ActivityVersion } from "../../../src/modules/activities/entities/ActivityVersion";
import { ActivityDifficulty } from "../../../src/modules/activities/types/ActivityDifficulty";
import { ActivityStatus } from "../../../src/modules/activities/types/ActivityStatus";
import { ActivityType } from "../../../src/modules/activities/types/ActivityType";
import { ActivityVersionStatus } from "../../../src/modules/activities/types/ActivityVersionStatus";
import { ActivityVisibility } from "../../../src/modules/activities/types/ActivityVisibility";
import { Role } from "../../../src/modules/users/entities/Role";
import { User } from "../../../src/modules/users/entities/User";
import { UserRole } from "../../../src/modules/users/entities/UserRole";
import { RoleCode } from "../../../src/modules/users/types/RoleCode";
import { UserStatus } from "../../../src/modules/users/types/UserStatus";
import { AppDataSource } from "../../../src/shared/database/data-source";

describe("PATCH /api/v1/activities/:slug - integração HTTP", () => {
  let app: FastifyInstance;

  const createdUserIds: string[] = [];
  const createdActivityIds: string[] = [];

  interface TestVersionInput {
    name: string;
    status: ActivityVersionStatus;
    versionNumber?: number;
  }

  interface CreateActivityInput {
    teacherId: string;
    slug: string;
    status: ActivityStatus;
    versions: TestVersionInput[];
    currentPublishedVersionIndex?: number;
    deletedAt?: Date | null;
  }

  const validPayload = {
    name: "Sistema Solar Atualizado",
    description: "Encontre palavras sobre o Sistema Solar.",
    difficulty: ActivityDifficulty.EASY,
    timeLimitSeconds: 600,
    words: ["PLANETA", "ESTRELA", "SATELITE", "GALAXIA"],
  };

  async function createUserWithRole(
    roleCode: RoleCode,
  ): Promise<User> {
    const userRepository = AppDataSource.getRepository(User);
    const roleRepository = AppDataSource.getRepository(Role);
    const userRoleRepository = AppDataSource.getRepository(UserRole);

    const user = await userRepository.save(
      userRepository.create({
        name: `Usuário ${roleCode}`,
        email: `${roleCode.toLowerCase()}-${crypto.randomUUID()}@example.com`,
        passwordHash: "hash-de-teste",
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      }),
    );

    createdUserIds.push(user.id);

    const role = await roleRepository.findOneByOrFail({
      code: roleCode,
    });

    await userRoleRepository.save(
      userRoleRepository.create({
        userId: user.id,
        roleId: role.id,
      }),
    );

    return user;
  }

  function createToken(
    userId: string,
    role: RoleCode,
  ): string {
    return app.jwt.sign({
      sub: userId,
      roles: [role],
    });
  }

  function createSlug(): string {
    return `atividade-edicao-${crypto.randomUUID()}`;
  }

  async function createActivityWithVersions(
    input: CreateActivityInput,
  ): Promise<{
    activity: Activity;
    versions: ActivityVersion[];
  }> {
    const activityRepository = AppDataSource.getRepository(Activity);
    const versionRepository = AppDataSource.getRepository(ActivityVersion);

    const activity = await activityRepository.save(
      activityRepository.create({
        teacherId: input.teacherId,
        type: ActivityType.WORD_SEARCH,
        slug: input.slug,
        status: input.status,
        visibility: ActivityVisibility.AUTHENTICATED,
        executionCount: 0,
        currentPublishedVersionId: null,
        deletedAt: input.deletedAt ?? null,
      }),
    );

    createdActivityIds.push(activity.id);

    const versions: ActivityVersion[] = [];

    for (const [index, versionInput] of input.versions.entries()) {
      const versionNumber = versionInput.versionNumber ?? index + 1;

      const version = await versionRepository.save(
        versionRepository.create({
          activityId: activity.id,
          versionNumber,
          name: versionInput.name,
          description: `Descrição da versão ${versionNumber}`,
          difficulty: ActivityDifficulty.EASY,
          timeLimitSeconds: 900,
          content: {
            words: ["PLANETA", "ESTRELA", "SATELITE"],
          },
          status: versionInput.status,
          revision: 1,
          submittedAt:
            versionInput.status === ActivityVersionStatus.PENDING_REVIEW
              ? new Date()
              : null,
          publishedAt:
            versionInput.status === ActivityVersionStatus.PUBLISHED
              ? new Date()
              : null,
          generatedData: {
            grid: [["P", "L", "A", "N", "E", "T", "A"]],
            wordPositions: [],
          },
        }),
      );

      versions.push(version);
    }

    if (input.currentPublishedVersionIndex !== undefined) {
      const selectedVersion =
        versions[input.currentPublishedVersionIndex];

      if (!selectedVersion) {
        throw new Error(
          "O índice da versão publicada não corresponde a uma versão criada.",
        );
      }

      activity.currentPublishedVersionId = selectedVersion.id;

      await activityRepository.save(activity);
    }

    return { activity, versions };
  }

  async function getVersions(activityId: string): Promise<ActivityVersion[]> {
    return AppDataSource.getRepository(ActivityVersion).find({
      where: { activityId },
      order: { versionNumber: "ASC" },
    });
  }

  async function updateActivity(
    slug: string,
    token: string,
    payload: typeof validPayload = validPayload,
  ) {
    return app.inject({
      method: "PATCH",
      url: `/api/v1/activities/${slug}`,
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload,
    });
  }

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    try {
      if (AppDataSource.isInitialized) {
        const versionRepository =
          AppDataSource.getRepository(ActivityVersion);
        const activityRepository =
          AppDataSource.getRepository(Activity);
        const userRoleRepository =
          AppDataSource.getRepository(UserRole);
        const userRepository =
          AppDataSource.getRepository(User);

        if (createdActivityIds.length > 0) {
          await activityRepository
            .createQueryBuilder()
            .update(Activity)
            .set({ currentPublishedVersionId: null })
            .where("id IN (:...ids)", {
              ids: createdActivityIds,
            })
            .execute();

          await versionRepository
            .createQueryBuilder()
            .delete()
            .where("activity_id IN (:...ids)", {
              ids: createdActivityIds,
            })
            .execute();

          await activityRepository.delete({
            id: In(createdActivityIds),
          });
        }

        if (createdUserIds.length > 0) {
          await userRoleRepository.delete({
            userId: In(createdUserIds),
          });

          await userRepository.delete({
            id: In(createdUserIds),
          });
        }
      }
    } finally {
      await app.close();

      if (AppDataSource.isInitialized) {
        await AppDataSource.destroy();
      }
    }
  });

  it("retorna 401 quando a requisição não possui autenticação", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/activities/${createSlug()}`,
      payload: validPayload,
    });

    expect(response.statusCode).toBe(401);

    expect(response.json()).toMatchObject({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Autenticação necessária.",
      },
    });
  });

  it("retorna 403 quando um aluno tenta editar uma atividade", async () => {
    const student = await createUserWithRole(RoleCode.STUDENT);
    const token = createToken(student.id, RoleCode.STUDENT);

    const response = await updateActivity(createSlug(), token);

    expect(response.statusCode).toBe(403);

    expect(response.json()).toMatchObject({
      success: false,
      error: {
        code: "FORBIDDEN",
      },
    });
  });

  it("atualiza o rascunho existente sem criar outra versão", async () => {
    const teacher = await createUserWithRole(RoleCode.TEACHER);
    const token = createToken(teacher.id, RoleCode.TEACHER);
    const slug = createSlug();

    const { activity, versions } = await createActivityWithVersions({
      teacherId: teacher.id,
      slug,
      status: ActivityStatus.DRAFT,
      versions: [
        {
          name: "Sistema Solar",
          status: ActivityVersionStatus.DRAFT,
        },
      ],
    });

    const originalVersionId = versions[0]!.id;

    const response = await updateActivity(slug, token);

    expect(response.statusCode).toBe(200);

    const updatedVersions = await getVersions(activity.id);

    expect(updatedVersions).toHaveLength(1);
    expect(updatedVersions[0]!.id).toBe(originalVersionId);
    expect(updatedVersions[0]!.versionNumber).toBe(1);
    expect(updatedVersions[0]!.revision).toBe(2);
    expect(updatedVersions[0]!.name).toBe(validPayload.name);
    expect(updatedVersions[0]!.description).toBe(
      validPayload.description,
    );
    expect(updatedVersions[0]!.timeLimitSeconds).toBe(600);
    expect(updatedVersions[0]!.content).toMatchObject({
      words: validPayload.words,
    });
    expect(updatedVersions[0]!.generatedData).not.toBeNull();
  });

  it("cria uma nova versão em rascunho sem alterar a versão publicada", async () => {
    const teacher = await createUserWithRole(RoleCode.TEACHER);
    const token = createToken(teacher.id, RoleCode.TEACHER);
    const slug = createSlug();

    const { activity, versions } = await createActivityWithVersions({
      teacherId: teacher.id,
      slug,
      status: ActivityStatus.PUBLISHED,
      versions: [
        {
          name: "Sistema Solar Publicado",
          status: ActivityVersionStatus.PUBLISHED,
        },
      ],
      currentPublishedVersionIndex: 0,
    });

    const publishedVersion = versions[0]!;
    const publishedVersionId = activity.currentPublishedVersionId;

    const response = await updateActivity(slug, token);

    expect(response.statusCode).toBe(200);

    const updatedActivity = await AppDataSource
      .getRepository(Activity)
      .findOneByOrFail({ id: activity.id });

    const updatedVersions = await getVersions(activity.id);

    expect(updatedVersions).toHaveLength(2);

    expect(updatedVersions[0]).toMatchObject({
      id: publishedVersion.id,
      versionNumber: 1,
      status: ActivityVersionStatus.PUBLISHED,
      name: "Sistema Solar Publicado",
    });

    expect(updatedVersions[1]).toMatchObject({
      versionNumber: 2,
      revision: 1,
      status: ActivityVersionStatus.DRAFT,
      name: validPayload.name,
    });

    expect(updatedActivity.currentPublishedVersionId).toBe(
      publishedVersionId,
    );
    expect(updatedActivity.status).toBe(ActivityStatus.PUBLISHED);
  });

  it("atualiza o rascunho existente quando já há uma nova versão em edição", async () => {
    const teacher = await createUserWithRole(RoleCode.TEACHER);
    const token = createToken(teacher.id, RoleCode.TEACHER);
    const slug = createSlug();

    const { activity, versions } = await createActivityWithVersions({
      teacherId: teacher.id,
      slug,
      status: ActivityStatus.PUBLISHED,
      versions: [
        {
          name: "Versão publicada",
          status: ActivityVersionStatus.PUBLISHED,
        },
        {
          name: "Rascunho existente",
          status: ActivityVersionStatus.DRAFT,
        },
      ],
      currentPublishedVersionIndex: 0,
    });

    const existingDraftId = versions[1]!.id;

    const response = await updateActivity(slug, token);

    expect(response.statusCode).toBe(200);

    const updatedVersions = await getVersions(activity.id);

    expect(updatedVersions).toHaveLength(2);
    expect(updatedVersions[1]!.id).toBe(existingDraftId);
    expect(updatedVersions[1]!.versionNumber).toBe(2);
    expect(updatedVersions[1]!.revision).toBe(2);
    expect(updatedVersions[1]!.name).toBe(validPayload.name);
  });

  it("bloqueia a edição de uma versão pendente de revisão", async () => {
    const teacher = await createUserWithRole(RoleCode.TEACHER);
    const token = createToken(teacher.id, RoleCode.TEACHER);
    const slug = createSlug();

    const { activity, versions } = await createActivityWithVersions({
      teacherId: teacher.id,
      slug,
      status: ActivityStatus.DRAFT,
      versions: [
        {
          name: "Atividade em revisão",
          status: ActivityVersionStatus.PENDING_REVIEW,
        },
      ],
    });

    const originalVersion = versions[0]!;

    const response = await updateActivity(slug, token);

    expect(response.statusCode).toBe(409);

    const updatedVersions = await getVersions(activity.id);

    expect(updatedVersions).toHaveLength(1);
    expect(updatedVersions[0]!.id).toBe(originalVersion.id);
    expect(updatedVersions[0]!.status).toBe(
      ActivityVersionStatus.PENDING_REVIEW,
    );
    expect(updatedVersions[0]!.name).toBe("Atividade em revisão");
    expect(updatedVersions[0]!.revision).toBe(1);
  });

  it("não permite editar a atividade de outro professor", async () => {
    const owner = await createUserWithRole(RoleCode.TEACHER);
    const otherTeacher = await createUserWithRole(RoleCode.TEACHER);
    const token = createToken(otherTeacher.id, RoleCode.TEACHER);
    const slug = createSlug();

    await createActivityWithVersions({
      teacherId: owner.id,
      slug,
      status: ActivityStatus.DRAFT,
      versions: [
        {
          name: "Rascunho privado",
          status: ActivityVersionStatus.DRAFT,
        },
      ],
    });

    const response = await updateActivity(slug, token);

    expect(response.statusCode).toBe(404);

    expect(response.json()).toMatchObject({
      success: false,
      error: {
        code: "ACTIVITY_NOT_FOUND",
      },
    });
  });

  it("retorna 404 quando a atividade foi excluída logicamente", async () => {
    const teacher = await createUserWithRole(RoleCode.TEACHER);
    const token = createToken(teacher.id, RoleCode.TEACHER);
    const slug = createSlug();

    await createActivityWithVersions({
      teacherId: teacher.id,
      slug,
      status: ActivityStatus.DRAFT,
      deletedAt: new Date(),
      versions: [
        {
          name: "Atividade excluída",
          status: ActivityVersionStatus.DRAFT,
        },
      ],
    });

    const response = await updateActivity(slug, token);

    expect(response.statusCode).toBe(404);

    expect(response.json()).toMatchObject({
      success: false,
      error: {
        code: "ACTIVITY_NOT_FOUND",
      },
    });
  });

  it("retorna 404 quando o slug não corresponde a uma atividade existente", async () => {
    const teacher = await createUserWithRole(RoleCode.TEACHER);
    const token = createToken(teacher.id, RoleCode.TEACHER);

    const response = await updateActivity(createSlug(), token);

    expect(response.statusCode).toBe(404);

    expect(response.json()).toMatchObject({
      success: false,
      error: {
        code: "ACTIVITY_NOT_FOUND",
        message: "Atividade não encontrada.",
      },
    });
  });
});