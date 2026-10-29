import type { FastifyInstance } from "fastify";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import { buildApp } from "../../../src/app";
import { RoleCode } from "../../../src/modules/users/types/RoleCode";
import { AppDataSource } from "../../../src/shared/database/data-source";
import { User } from "../../../src/modules/users/entities/User";
import { Role } from "../../../src/modules/users/entities/Role";
import { UserRole } from "../../../src/modules/users/entities/UserRole";
import { Activity } from "../../../src/modules/activities/entities/Activity";
import { ActivityVersion } from "../../../src/modules/activities/entities/ActivityVersion";
import { UserStatus } from "../../../src/modules/users/types/UserStatus";

describe("POST /api/v1/activities/ - integração HTTP", () => {
  let app: FastifyInstance;

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

  const validPayload = {
    name: "Sistema Solar",
    description: "Encontre as palavras relacionadas ao Sistema Solar.",
    difficulty: "EASY" as const,
    words: ["PLANETA", "ESTRELA", "SATELITE"],
  };

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
    }

    app = buildApp();
    await app.ready();
    });

    afterAll(async () => {
    await app.close();

    if (AppDataSource.isInitialized) {
        await AppDataSource.destroy();
    }
  });

  function createToken(role: RoleCode): string {
    return app.jwt.sign({
      sub: "00000000-0000-4000-8000-000000000001",
      roles: [role],
    });
  }

  it("retorna 401 quando a requisição não possui autenticação", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/activities/",
      payload: {},
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

  it("retorna 403 quando um aluno tenta criar uma atividade", async () => {
    const token = createToken(RoleCode.STUDENT);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/activities/",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {},
    });

    expect(response.statusCode).toBe(403);

    expect(response.json()).toMatchObject({
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Você não tem permissão para executar esta ação.",
      },
    });
  });

  it("retorna 400 quando um professor envia dados inválidos", async () => {
    const token = createToken(RoleCode.TEACHER);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/activities/",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {},
    });

    expect(response.statusCode).toBe(400);

    expect(response.json()).toMatchObject({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
      },
    });
  });

  it("cria um caça-palavras e persiste a atividade e sua primeira versão", async () => {
    const teacher = await createUserWithRole(RoleCode.TEACHER);
    const token = app.jwt.sign({
        sub: teacher.id,
        roles: [RoleCode.TEACHER],
    });

    const response = await app.inject({
        method: "POST",
        url: "/api/v1/activities/",
        headers: {
        authorization: `Bearer ${token}`,
        },
        payload: validPayload,
    });

    expect(response.statusCode).toBe(201);

    const body = response.json();

    expect(body.success).toBe(true);
    expect(body.data.activity).toMatchObject({
        teacherId: teacher.id,
        type: "word_search",
        status: "DRAFT",
        visibility: "AUTHENTICATED",
    });

    expect(body.data.version).toMatchObject({
        versionNumber: 1,
        name: validPayload.name,
        difficulty: validPayload.difficulty,
        timeLimitSeconds: 900,
        status: "DRAFT",
    });

    const activityId = body.data.activity.id;

    const savedActivity = await AppDataSource
        .getRepository(Activity)
        .findOneByOrFail({ id: activityId });

    expect(savedActivity.teacherId).toBe(teacher.id);
    expect(savedActivity.status).toBe("DRAFT");

    const savedVersion = await AppDataSource
        .getRepository(ActivityVersion)
        .findOneByOrFail({
        activityId,
        versionNumber: 1,
        });

    expect(savedVersion.content).toMatchObject({
        words: validPayload.words,
    });

    expect(savedVersion.generatedData).toMatchObject({
        grid: expect.any(Array),
        wordPositions: expect.any(Array),
    });
  });
});