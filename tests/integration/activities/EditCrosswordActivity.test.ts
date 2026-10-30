import type { FastifyInstance } from "fastify";
import { In } from "typeorm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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

describe("PATCH /api/v1/activities/:slug/crossword - integração HTTP", () => {
  let app: FastifyInstance;
  const createdUserIds: string[] = [];
  const createdActivityIds: string[] = [];

  const validPayload = {
    name: "Cruzadinha de animais",
    description: "Respostas sobre animais.",
    difficulty: ActivityDifficulty.EASY,
    timeLimitSeconds: 600,
    words: [
      { word: "CASA", clue: "Lugar onde se mora" },
      { word: "SALA", clue: "Cômodo da casa" },
      { word: "ASA", clue: "Parte usada para voar" },
    ],
  };

  async function createUserWithRole(roleCode: RoleCode): Promise<User> {
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

    const role = await roleRepository.findOneByOrFail({ code: roleCode });
    await userRoleRepository.save(
      userRoleRepository.create({ userId: user.id, roleId: role.id }),
    );
    return user;
  }

  function createToken(userId: string, role: RoleCode): string {
    return app.jwt.sign({ sub: userId, roles: [role] });
  }

  function createSlug(): string {
    return `cruzadinha-edicao-${crypto.randomUUID()}`;
  }

  async function createDraftActivity(teacherId: string, slug: string) {
    const activityRepository = AppDataSource.getRepository(Activity);
    const versionRepository = AppDataSource.getRepository(ActivityVersion);
    const activity = await activityRepository.save(
      activityRepository.create({
        teacherId,
        type: ActivityType.CROSSWORD,
        slug,
        status: ActivityStatus.DRAFT,
        visibility: ActivityVisibility.AUTHENTICATED,
        executionCount: 0,
        currentPublishedVersionId: null,
        deletedAt: null,
      }),
    );
    createdActivityIds.push(activity.id);

    const version = await versionRepository.save(
      versionRepository.create({
        activityId: activity.id,
        versionNumber: 1,
        name: "Rascunho original",
        description: null,
        difficulty: ActivityDifficulty.EASY,
        timeLimitSeconds: 900,
        content: {
          words: [
            { word: "CASA", clue: "Lugar onde se mora" },
            { word: "SALA", clue: "Cômodo da casa" },
            { word: "ASA", clue: "Parte usada para voar" },
          ],
        },
        status: ActivityVersionStatus.DRAFT,
        revision: 1,
        submittedAt: null,
        publishedAt: null,
        generatedData: { grid: [], clues: [] },
        reviewFeedback: null,
        reviewedAt: null,
      }),
    );

    return { activity, version };
  }

  async function editActivity(
    slug: string,
    token: string,
    payload: typeof validPayload = validPayload,
  ) {
    return app.inject({
      method: "PATCH",
      url: `/api/v1/activities/${slug}/crossword`,
      headers: { authorization: `Bearer ${token}` },
      payload,
    });
  }

  async function getVersions(activityId: string): Promise<ActivityVersion[]> {
    return AppDataSource.getRepository(ActivityVersion).find({
      where: { activityId },
      order: { versionNumber: "ASC" },
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
        const versionRepository = AppDataSource.getRepository(ActivityVersion);
        const activityRepository = AppDataSource.getRepository(Activity);
        const userRoleRepository = AppDataSource.getRepository(UserRole);
        const userRepository = AppDataSource.getRepository(User);

        if (createdActivityIds.length > 0) {
          await activityRepository
            .createQueryBuilder()
            .update(Activity)
            .set({ currentPublishedVersionId: null })
            .where("id IN (:...ids)", { ids: createdActivityIds })
            .execute();
          await versionRepository
            .createQueryBuilder()
            .delete()
            .where("activity_id IN (:...ids)", { ids: createdActivityIds })
            .execute();
          await activityRepository.delete({ id: In(createdActivityIds) });
        }

        if (createdUserIds.length > 0) {
          await userRoleRepository.delete({ userId: In(createdUserIds) });
          await userRepository.delete({ id: In(createdUserIds) });
        }
      }
    } finally {
      await app.close();
      if (AppDataSource.isInitialized) {
        await AppDataSource.destroy();
      }
    }
  });

  it("retorna 401 sem autenticação", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/activities/${createSlug()}/crossword`,
      payload: validPayload,
    });

    expect(response.statusCode).toBe(401);
  });

  it("atualiza o rascunho e regenera a grade e as pistas", async () => {
    const teacher = await createUserWithRole(RoleCode.TEACHER);
    const token = createToken(teacher.id, RoleCode.TEACHER);
    const slug = createSlug();
    const { activity, version } = await createDraftActivity(teacher.id, slug);

    const response = await editActivity(slug, token);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      data: {
        activity: { slug },
        version: {
          id: version.id,
          versionNumber: 1,
          revision: 2,
          name: validPayload.name,
          status: ActivityVersionStatus.DRAFT,
        },
        preview: {
          grid: expect.any(Array),
          clues: expect.any(Array),
        },
      },
    });

    const versions = await getVersions(activity.id);
    expect(versions).toHaveLength(1);
    expect(versions[0]?.revision).toBe(2);
    expect(versions[0]?.content).toMatchObject({ words: validPayload.words });
    expect(versions[0]?.generatedData).toMatchObject({
      grid: expect.any(Array),
      clues: expect.any(Array),
    });
  });

  it("bloqueia edição quando uma versão aguarda revisão", async () => {
    const teacher = await createUserWithRole(RoleCode.TEACHER);
    const token = createToken(teacher.id, RoleCode.TEACHER);
    const slug = createSlug();
    const { activity, version } = await createDraftActivity(teacher.id, slug);

    await AppDataSource.getRepository(ActivityVersion).update(version.id, {
      status: ActivityVersionStatus.PENDING_REVIEW,
      submittedAt: new Date(),
    });

    const response = await editActivity(slug, token);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      success: false,
      error: { code: "ACTIVITY_VERSION_PENDING_REVIEW" },
    });
    expect(await getVersions(activity.id)).toHaveLength(1);
  });

  it("não permite que outro professor edite a cruzadinha", async () => {
    const owner = await createUserWithRole(RoleCode.TEACHER);
    const otherTeacher = await createUserWithRole(RoleCode.TEACHER);
    const token = createToken(otherTeacher.id, RoleCode.TEACHER);
    const slug = createSlug();
    await createDraftActivity(owner.id, slug);

    const response = await editActivity(slug, token);

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      success: false,
      error: { code: "ACTIVITY_NOT_FOUND" },
    });
  });

  it("retorna 400 para respostas duplicadas após normalização", async () => {
    const teacher = await createUserWithRole(RoleCode.TEACHER);
    const token = createToken(teacher.id, RoleCode.TEACHER);
    const slug = createSlug();
    await createDraftActivity(teacher.id, slug);

    const response = await editActivity(slug, token, {
      ...validPayload,
      words: [
        { word: "ÁGUA", clue: "Líquido essencial" },
        { word: "AGUA", clue: "Outra pista" },
        { word: "CASA", clue: "Lugar onde se mora" },
      ],
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR" },
    });
  });
});
