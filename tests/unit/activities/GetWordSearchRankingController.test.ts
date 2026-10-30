import type { FastifyReply, FastifyRequest } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../../../src/shared/errors/AppError";
import { getWordSearchRankingController } from "../../../src/modules/activities/controllers/getWordSearchRankingController";
import { makeGetWordSearchRankingService } from "../../../src/modules/activities/factories/make-get-word-search-ranking-service";

vi.mock("../../../src/modules/activities/factories/make-get-word-search-ranking-service", () => ({
  makeGetWordSearchRankingService: vi.fn(),
}));

interface MockReply {
  status: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
}

function createRequest(params: unknown = { slug: "animais-brasileiros" }): FastifyRequest {
  return {
    params,
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

describe("getWordSearchRankingController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve retornar o ranking com status 200", async () => {
    const ranking = [
      {
        position: 1,
        studentName: "Ana",
        score: 95,
        elapsedSeconds: 38,
        createdAt: new Date("2026-10-29T10:00:00.000Z"),
      },
    ];
    vi.mocked(makeGetWordSearchRankingService).mockReturnValue({
      execute: vi.fn().mockResolvedValue(ranking),
    } as unknown as ReturnType<typeof makeGetWordSearchRankingService>);

    const reply = createReply();

    await getWordSearchRankingController(
      createRequest() ,
      reply as unknown as FastifyReply,
    );

    expect(makeGetWordSearchRankingService).toHaveBeenCalledOnce();
    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({
      success: true,
      data: { ranking },
    });
  });

  it("deve retornar 400 quando o slug for inválido", async () => {
    const reply = createReply();

    await getWordSearchRankingController(
      createRequest({ slug: "" }),
      reply as unknown as FastifyReply,
    );

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "O identificador da atividade é inválido.",
      },
      requestId: "request-123",
    });
    expect(makeGetWordSearchRankingService).not.toHaveBeenCalled();
  });

  it("deve converter AppError para a resposta HTTP correspondente", async () => {
    vi.mocked(makeGetWordSearchRankingService).mockReturnValue({
      execute: vi.fn().mockRejectedValue(
        new AppError("ACTIVITY_NOT_FOUND", 404, "Caça-palavras publicado não encontrado."),
      ),
    } as unknown as ReturnType<typeof makeGetWordSearchRankingService>);

    const reply = createReply();

    await getWordSearchRankingController(
      createRequest(),
      reply as unknown as FastifyReply,
    );

    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: "ACTIVITY_NOT_FOUND",
        message: "Caça-palavras publicado não encontrado.",
      },
      requestId: "request-123",
    });
  });

  it("deve retornar 500 para erros inesperados", async () => {
    vi.mocked(makeGetWordSearchRankingService).mockReturnValue({
      execute: vi.fn().mockRejectedValue(new Error("Erro inesperado")),
    } as unknown as ReturnType<typeof makeGetWordSearchRankingService>);

    const reply = createReply();
    const request = createRequest();

    await getWordSearchRankingController(
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
