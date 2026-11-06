import type { FastifyReply, FastifyRequest } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPublicActivityBySlugController } from "../../../src/modules/activities/controllers/getPublicActivityBySlugController";
import { makeGetActivityBySlugService } from "../../../src/modules/activities/factories/make-get-activity-by-slug-service";

vi.mock("../../../src/modules/activities/factories/make-get-activity-by-slug-service", () => ({
  makeGetActivityBySlugService: vi.fn(),
}));

interface MockReply {
  status: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
}

function createRequest(params: unknown = { slug: "atividade-publica" }): FastifyRequest {
  return {
    params,
    id: "request-123",
    log: { warn: vi.fn() },
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

describe("getPublicActivityBySlugController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve consultar a atividade explicitamente no modo público", async () => {
    const data = { slug: "atividade-publica", version: { name: "Atividade" } };
    const execute = vi.fn().mockResolvedValue(data);
    vi.mocked(makeGetActivityBySlugService).mockReturnValue({
      execute,
    } as unknown as ReturnType<typeof makeGetActivityBySlugService>);

    const reply = createReply();
    await getPublicActivityBySlugController(
      createRequest(),
      reply as unknown as FastifyReply,
    );

    expect(execute).toHaveBeenCalledWith({
      slug: "atividade-publica",
      userId: "",
      isAdmin: false,
      publicOnly: true,
    });
    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({ success: true, data });
  });

  it("deve rejeitar um slug inválido", async () => {
    const reply = createReply();

    await getPublicActivityBySlugController(
      createRequest({ slug: "" }),
      reply as unknown as FastifyReply,
    );

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(makeGetActivityBySlugService).not.toHaveBeenCalled();
  });

  it("deve responder 404 quando a atividade pública não estiver disponível", async () => {
    vi.mocked(makeGetActivityBySlugService).mockReturnValue({
      execute: vi.fn().mockRejectedValue(new Error("Não encontrada")),
    } as unknown as ReturnType<typeof makeGetActivityBySlugService>);

    const reply = createReply();
    await getPublicActivityBySlugController(
      createRequest(),
      reply as unknown as FastifyReply,
    );

    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: "ACTIVITY_NOT_FOUND",
        message: "Atividade pública não encontrada.",
      },
      requestId: "request-123",
    });
  });
});
