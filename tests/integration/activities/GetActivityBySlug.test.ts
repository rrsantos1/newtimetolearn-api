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
import { RoleCode } from "../../../src/modules/users/types/RoleCode";
import { Role } from "../../../src/modules/users/entities/Role";
import { User } from "../../../src/modules/users/entities/User";
import { UserRole } from "../../../src/modules/users/entities/UserRole";
import { UserStatus } from "../../../src/modules/users/types/UserStatus";
import { AppDataSource } from "../../../src/shared/database/data-source";

describe("GET /api/v1/activities/:slug - integração HTTP", () => {
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
    visibility?: ActivityVisibility;
    versions: TestVersionInput[];
    currentPublishedVersionIndex?: number;
    deletedAt?: Date | null;
    type?: ActivityType;
    content?: Record<string, unknown>;
    generatedData?: Record<string, unknown> | null;
  }

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
    return `atividade-teste-${crypto.randomUUID()}`;
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
        type: input.type ?? ActivityType.WORD_SEARCH,
        slug: input.slug,
        status: input.status,
        visibility:
          input.visibility ?? ActivityVisibility.AUTHENTICATED,
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
          content: input.content ?? {
            words: [`PALAVRA${versionNumber}`],
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
          generatedData: input.generatedData ?? {
            grid: [["P", "A", "L", "A", "V", "R", "A"]],
            wordPositions: [],
          },
        }),
      );

      versions.push(version);
    }

    if (
      input.currentPublishedVersionIndex !== undefined
    ) {
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

    return {
      activity,
      versions,
    };
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
          // 1. Remove a referência da atividade para a versão publicada.
          await activityRepository
            .createQueryBuilder()
            .update(Activity)
            .set({ currentPublishedVersionId: null })
            .where("id IN (:...ids)", {
              ids: createdActivityIds,
            })
            .execute();

          // 2. Exclui as versões das atividades de teste.
          await versionRepository
            .createQueryBuilder()
            .delete()
            .where("activity_id IN (:...ids)", {
              ids: createdActivityIds,
            })
            .execute();

          // 3. Exclui as atividades de teste.
          await activityRepository.delete({
            id: In(createdActivityIds),
          });
        }

        if (createdUserIds.length > 0) {
          // 4. Remove os vínculos com os papéis.
          await userRoleRepository.delete({
            userId: In(createdUserIds),
          });

          // 5. Exclui os usuários de teste.
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
      method: "GET",
      url: `/api/v1/activities/${createSlug()}`,
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

  it("permite que um aluno consulte uma atividade publicada", async () => {
    const owner = await createUserWithRole(RoleCode.TEACHER);
    const student = await createUserWithRole(RoleCode.STUDENT);
    const token = createToken(student.id, RoleCode.STUDENT);
    const slug = createSlug();

    await createActivityWithVersions({
      teacherId: owner.id,
      slug,
      status: ActivityStatus.PUBLISHED,
      versions: [
        {
          name: "Caça-palavras publicado",
          status: ActivityVersionStatus.PUBLISHED,
        },
      ],
      currentPublishedVersionIndex: 0,
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/activities/${slug}`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      data: {
        slug,
        isOwner: false,
        version: {
          name: "Caça-palavras publicado",
          status: ActivityVersionStatus.PUBLISHED,
        },
      },
    });
  });



  it("não expõe respostas de uma cruzadinha publicada ao aluno", async () => {
    const owner = await createUserWithRole(RoleCode.TEACHER);
    const student = await createUserWithRole(RoleCode.STUDENT);
    const token = createToken(student.id, RoleCode.STUDENT);
    const slug = createSlug();

    await createActivityWithVersions({
      teacherId: owner.id,
      slug,
      type: ActivityType.CROSSWORD,
      status: ActivityStatus.PUBLISHED,
      versions: [
        {
          name: "Cruzadinha publicada",
          status: ActivityVersionStatus.PUBLISHED,
        },
      ],
      currentPublishedVersionIndex: 0,
      content: {
        title: "Animais",
        words: [
          { word: "GATO", clue: "Felino doméstico" },
          { word: "CÃO", clue: "Melhor amigo do homem" },
        ],
      },
      generatedData: {
        grid: [
          ["G", "A", "T", "O"],
          ["", "", "", ""],
          ["C", "A", "O", ""],
        ],
        clues: [
          { number: 1, clue: "Felino doméstico", direction: "across", row: 0, col: 0, word: "GATO" },
          { number: 2, clue: "Melhor amigo do homem", direction: "across", row: 2, col: 0, word: "CAO" },
        ],
      },
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/activities/${slug}`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(JSON.stringify(body)).not.toContain('"word":"GATO"');
    expect(JSON.stringify(body)).not.toContain('"word":"CAO"');
    expect(body.data.version.content.words).toEqual([
      { clue: "Felino doméstico" },
      { clue: "Melhor amigo do homem" },
    ]);
    expect(body.data.version.generatedData.clues).toEqual([
      { number: 1, clue: "Felino doméstico", direction: "across", row: 0, col: 0, length: 4 },
      { number: 2, clue: "Melhor amigo do homem", direction: "across", row: 2, col: 0, length: 3 },
    ]);
    expect(body.data.version.generatedData.grid).toEqual([
      ["", "", "", ""],
      [null, null, null, null],
      ["", "", "", null],
    ]);
  });

  it("preserva o gabarito da cruzadinha para o professor proprietário", async () => {
    const owner = await createUserWithRole(RoleCode.TEACHER);
    const token = createToken(owner.id, RoleCode.TEACHER);
    const slug = createSlug();

    await createActivityWithVersions({
      teacherId: owner.id,
      slug,
      type: ActivityType.CROSSWORD,
      status: ActivityStatus.PUBLISHED,
      versions: [
        {
          name: "Minha cruzadinha",
          status: ActivityVersionStatus.PUBLISHED,
        },
      ],
      currentPublishedVersionIndex: 0,
      content: {
        title: "Animais",
        words: [
          { word: "GATO", clue: "Felino doméstico" },
          { word: "CÃO", clue: "Melhor amigo do homem" },
        ],
      },
      generatedData: {
        grid: [["G", "A", "T", "O"]],
        clues: [
          { number: 1, clue: "Felino doméstico", direction: "across", row: 0, col: 0, word: "GATO" },
        ],
      },
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/activities/${slug}`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.data.isOwner).toBe(true);
    expect(body.data.version.content.words).toEqual([
      { word: "GATO", clue: "Felino doméstico" },
      { word: "CÃO", clue: "Melhor amigo do homem" },
    ]);
    expect(body.data.version.generatedData.grid).toEqual([
      ["G", "A", "T", "O"],
    ]);
    expect(body.data.version.generatedData.clues[0].word).toBe("GATO");
  });

  it("não permite que um aluno consulte uma atividade não publicada", async () => {
    const owner = await createUserWithRole(RoleCode.TEACHER);
    const student = await createUserWithRole(RoleCode.STUDENT);
    const token = createToken(student.id, RoleCode.STUDENT);
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

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/activities/${slug}`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

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

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/activities/${createSlug()}`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(404);

    expect(response.json()).toMatchObject({
      success: false,
      error: {
        code: "ACTIVITY_NOT_FOUND",
        message: "Atividade não encontrada.",
      },
    });
  });

  it("permite que o professor consulte seu próprio rascunho", async () => {
    const teacher = await createUserWithRole(RoleCode.TEACHER);
    const token = createToken(teacher.id, RoleCode.TEACHER);
    const slug = createSlug();

    const { activity, versions } = await createActivityWithVersions({
      teacherId: teacher.id,
      slug,
      status: ActivityStatus.DRAFT,
      versions: [
        {
          name: "Meu caça-palavras",
          status: ActivityVersionStatus.DRAFT,
        },
      ],
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/activities/${slug}`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toMatchObject({
      success: true,
      data: {
        slug,
        type: ActivityType.WORD_SEARCH,
        status: ActivityStatus.DRAFT,
        visibility: ActivityVisibility.AUTHENTICATED,
        executionCount: 0,
        isOwner: true,
        version: {
          versionNumber: 1,
          name: "Meu caça-palavras",
          status: ActivityVersionStatus.DRAFT,
          content: {
            words: ["PALAVRA1"],
          },
        },
      },
    });

    expect(response.json().data).not.toHaveProperty("versions");
    expect(response.json().data.version).not.toHaveProperty("activityId");

    expect(activity.teacherId).toBe(teacher.id);
    expect(versions).toHaveLength(1);
  });

  it("retorna a versão publicada para outro professor, mesmo que exista um rascunho mais recente", async () => {
    const owner = await createUserWithRole(RoleCode.TEACHER);
    const otherTeacher = await createUserWithRole(RoleCode.TEACHER);
    const token = createToken(otherTeacher.id, RoleCode.TEACHER);
    const slug = createSlug();

    const { versions } = await createActivityWithVersions({
      teacherId: owner.id,
      slug,
      status: ActivityStatus.PUBLISHED,
      visibility: ActivityVisibility.AUTHENTICATED,
      versions: [
        {
          name: "Versão publicada",
          status: ActivityVersionStatus.PUBLISHED,
        },
        {
          name: "Rascunho mais recente",
          status: ActivityVersionStatus.DRAFT,
        },
      ],
      currentPublishedVersionIndex: 0,
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/activities/${slug}`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toMatchObject({
      success: true,
      data: {
        slug,
        status: ActivityStatus.PUBLISHED,
        isOwner: false,
        version: {
          versionNumber: 1,
          name: "Versão publicada",
          status: ActivityVersionStatus.PUBLISHED,
          content: {
            words: ["PALAVRA1"],
          },
        },
      },
    });

    expect(response.json().data.version.name).not.toBe(
      "Rascunho mais recente",
    );

    expect(versions[1]?.status).toBe(ActivityVersionStatus.DRAFT);
  });

  it("não permite que um professor consulte o rascunho de outro professor", async () => {
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

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/activities/${slug}`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(404);

    expect(response.json()).toMatchObject({
      success: false,
      error: {
        code: "ACTIVITY_NOT_FOUND",
      },
    });
  });

  it("permite que o administrador consulte uma atividade não publicada", async () => {
    const teacher = await createUserWithRole(RoleCode.TEACHER);
    const admin = await createUserWithRole(RoleCode.ADMIN);
    const token = createToken(admin.id, RoleCode.ADMIN);
    const slug = createSlug();

    await createActivityWithVersions({
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

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/activities/${slug}`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);

    expect(response.json()).toMatchObject({
      success: true,
      data: {
        slug,
        status: ActivityStatus.DRAFT,
        isOwner: false,
        version: {
          versionNumber: 1,
          name: "Atividade em revisão",
          status: ActivityVersionStatus.PENDING_REVIEW,
        },
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

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/activities/${slug}`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(404);

    expect(response.json()).toMatchObject({
      success: false,
      error: {
        code: "ACTIVITY_NOT_FOUND",
      },
    });
  });

  it("não disponibiliza a atividade a outro professor quando a versão apontada não está publicada", async () => {
    const owner = await createUserWithRole(RoleCode.TEACHER);
    const otherTeacher = await createUserWithRole(RoleCode.TEACHER);
    const token = createToken(otherTeacher.id, RoleCode.TEACHER);
    const slug = createSlug();

    await createActivityWithVersions({
      teacherId: owner.id,
      slug,
      status: ActivityStatus.PUBLISHED,
      versions: [
        {
          name: "Versão ainda em rascunho",
          status: ActivityVersionStatus.DRAFT,
        },
      ],
      currentPublishedVersionIndex: 0,
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/activities/${slug}`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(404);

    expect(response.json()).toMatchObject({
      success: false,
      error: {
        code: "ACTIVITY_NOT_FOUND",
      },
    });
  });
});