import type { FastifyReply, FastifyRequest } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../../../src/shared/errors/AppError";
import { setActivityFavoriteController } from "../../../src/modules/activities/controllers/setActivityFavoriteController";
import { makeSetActivityFavoriteService } from "../../../src/modules/activities/factories/make-set-activity-favorite-service";

vi.mock("../../../src/modules/activities/factories/make-set-activity-favorite-service", () => ({
  makeSetActivityFavoriteService: vi.fn(),
}));

interface MockReply {
  status: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
}

function createRequest(
  params: unknown = { slug: "atividade-favorita" },
  body: unknown = { favorite: true },
): FastifyRequest {
  return {
    params,
    body,
    user: { sub: "teacher-123" },
    id: "request-123",
    log: { error: vi.fn() },
  } as unknown as FastifyRequest;
}

function createReply(): MockReply {
  const reply: MockReply = {
    status: vi.fn(),
    send: vi.fn(),
  };
  reply.status.mockReturnValue(reply);
  reply.send.mockReturnValue(reply);
  return reply;
}

describe("setActivityFavoriteController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve atualizar o favorito do usuário autenticado", async () => {
    const data = { isFavorite: true };
    const execute = vi.fn().mockResolvedValue(data);
    vi.mocked(makeSetActivityFavoriteService).mockReturnValue({
      execute,
    } as unknown as ReturnType<typeof makeSetActivityFavoriteService>);

    const reply = createReply();
    await setActivityFavoriteController(
      createRequest(),
      reply as unknown as FastifyReply,
    );

    expect(execute).toHaveBeenCalledWith({
      userId: "teacher-123",
      slug: "atividade-favorita",
      favorite: true,
    });
    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({ success: true, data });
  });

  it("deve rejeitar parâmetros ou corpo inválidos", async () => {
    const reply = createReply();

    await setActivityFavoriteController(
      createRequest({ slug: "" }, { favorite: "yes" }),
      reply as unknown as FastifyReply,
    );

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(makeSetActivityFavoriteService).not.toHaveBeenCalled();
  });

  it("deve converter AppError para a resposta HTTP correspondente", async () => {
    vi.mocked(makeSetActivityFavoriteService).mockReturnValue({
      execute: vi.fn().mockRejectedValue(
        new AppError("ACTIVITY_NOT_FOUND", 404, "Atividade não encontrada."),
      ),
    } as unknown as ReturnType<typeof makeSetActivityFavoriteService>);

    const reply = createReply();
    await setActivityFavoriteController(
      createRequest(),
      reply as unknown as FastifyReply,
    );

    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: "ACTIVITY_NOT_FOUND",
        message: "Atividade não encontrada.",
      },
      requestId: "request-123",
    });
  });
});
