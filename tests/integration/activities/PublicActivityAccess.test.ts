import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../../src/app";
import { AppDataSource } from "../../../src/shared/database/data-source";

describe("Acesso público e execução anônima de atividades - integração HTTP", () => {
  let app: FastifyInstance;

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

  it("deve disponibilizar o catálogo público sem autenticação", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/activities/public",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      data: {
        items: expect.any(Array),
        pagination: {
          page: 1,
          limit: 12,
        },
      },
    });
  });

  it("deve responder 404 para uma atividade pública inexistente sem exigir login", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/activities/public/atividade-inexistente-para-teste",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      success: false,
      error: {
        code: "ACTIVITY_NOT_FOUND",
      },
    });
  });

  it("deve exigir autenticação para favoritar uma atividade", async () => {
    const response = await app.inject({
      method: "PUT",
      url: "/api/v1/activities/atividade-publica/favorite",
      payload: { favorite: true },
    });

    expect(response.statusCode).toBe(401);
  });

  it("deve exigir autenticação para alterar a visibilidade de uma atividade", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/v1/activities/atividade-publica/visibility",
      payload: { visibility: "PUBLIC" },
    });

    expect(response.statusCode).toBe(401);
  });

  it.each([
    ["/api/v1/activities/atividade-publica/attempts", "word search / crossword / quiz"],
    ["/api/v1/activities/atividade-publica/memory/attempts", "memory"],
    ["/api/v1/activities/atividade-publica/listening/attempts", "listening"],
    ["/api/v1/activities/atividade-publica/multiple-choice/attempts", "multiple choice"],
    ["/api/v1/activities/atividade-publica/word-matching/attempts", "word matching"],
    ["/api/v1/activities/atividade-publica/sentence-completion/attempts", "sentence completion"],
  ])("não deve aceitar tentativa anônima em %s (%s)", async (url) => {
    const response = await app.inject({
      method: "POST",
      url,
      payload: {},
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      success: false,
      error: {
        code: "UNAUTHORIZED",
      },
    });
  });

});
