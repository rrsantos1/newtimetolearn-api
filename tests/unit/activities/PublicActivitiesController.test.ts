import type { FastifyReply, FastifyRequest } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listPublicActivitiesController } from "../../../src/modules/activities/controllers/listPublicActivitiesController";
import { makeListActivitiesService } from "../../../src/modules/activities/factories/make-list-activities-service";
import { ActivityType } from "../../../src/modules/activities/types/ActivityType";

vi.mock("../../../src/modules/activities/factories/make-list-activities-service", () => ({
  makeListActivitiesService: vi.fn(),
}));

interface MockReply {
  status: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
}

function createRequest(query: unknown = {}): FastifyRequest {
  return {
    query,
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

describe("listPublicActivitiesController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve listar atividades públicas com os filtros recebidos", async () => {
    const data = {
      items: [],
      pagination: { page: 1, limit: 12, total: 0, totalPages: 0 },
    };
    const execute = vi.fn().mockResolvedValue(data);
    vi.mocked(makeListActivitiesService).mockReturnValue({
      execute,
    } as unknown as ReturnType<typeof makeListActivitiesService>);

    const reply = createReply();
    await listPublicActivitiesController(
      createRequest({
        page: "2",
        limit: "9",
        search: "animais",
        type: ActivityType.QUIZ,
        difficulty: "EASY",
      }),
      reply as unknown as FastifyReply,
    );

    expect(execute).toHaveBeenCalledWith({
      page: 2,
      limit: 9,
      search: "animais",
      type: ActivityType.QUIZ,
      difficulty: "EASY",
      scope: "public",
    });
    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({ success: true, data });
  });

  it("deve rejeitar um tipo de atividade inválido", async () => {
    const reply = createReply();

    await listPublicActivitiesController(
      createRequest({ type: "atividade-inexistente" }),
      reply as unknown as FastifyReply,
    );

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Os filtros são inválidos.",
      },
      requestId: "request-123",
    });
    expect(makeListActivitiesService).not.toHaveBeenCalled();
  });

  it("deve retornar 500 quando ocorrer uma falha inesperada", async () => {
    vi.mocked(makeListActivitiesService).mockReturnValue({
      execute: vi.fn().mockRejectedValue(new Error("Falha ao consultar catálogo")),
    } as unknown as ReturnType<typeof makeListActivitiesService>);

    const request = createRequest();
    const reply = createReply();

    await listPublicActivitiesController(
      request,
      reply as unknown as FastifyReply,
    );

    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Ocorreu um erro interno.",
      },
      requestId: "request-123",
    });
  });
});
