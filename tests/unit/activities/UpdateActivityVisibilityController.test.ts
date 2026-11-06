import type { FastifyReply, FastifyRequest } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../../../src/shared/errors/AppError";
import { updateActivityVisibilityController } from "../../../src/modules/activities/controllers/updateActivityVisibilityController";
import { makeSetActivityVisibilityService } from "../../../src/modules/activities/factories/make-set-activity-visibility-service";
import { ActivityVisibility } from "../../../src/modules/activities/types/ActivityVisibility";

vi.mock("../../../src/modules/activities/factories/make-set-activity-visibility-service", () => ({
  makeSetActivityVisibilityService: vi.fn(),
}));

interface MockReply {
  status: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
}

function createRequest(
  params: unknown = { slug: "atividade-publicada" },
  body: unknown = { visibility: ActivityVisibility.PUBLIC },
): FastifyRequest {
  return {
    params,
    body,
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

describe("updateActivityVisibilityController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve atualizar a visibilidade da atividade", async () => {
    const data = {
      slug: "atividade-publicada",
      visibility: ActivityVisibility.PUBLIC,
    };
    const execute = vi.fn().mockResolvedValue(data);
    vi.mocked(makeSetActivityVisibilityService).mockReturnValue({
      execute,
    } as unknown as ReturnType<typeof makeSetActivityVisibilityService>);

    const reply = createReply();
    await updateActivityVisibilityController(
      createRequest(),
      reply as unknown as FastifyReply,
    );

    expect(execute).toHaveBeenCalledWith({
      slug: "atividade-publicada",
      visibility: ActivityVisibility.PUBLIC,
    });
    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({ success: true, data });
  });

  it("deve rejeitar uma visibilidade inválida", async () => {
    const reply = createReply();

    await updateActivityVisibilityController(
      createRequest({ slug: "atividade-publicada" }, { visibility: "WORLD" }),
      reply as unknown as FastifyReply,
    );

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(makeSetActivityVisibilityService).not.toHaveBeenCalled();
  });

  it("deve converter AppError para a resposta HTTP correspondente", async () => {
    vi.mocked(makeSetActivityVisibilityService).mockReturnValue({
      execute: vi.fn().mockRejectedValue(
        new AppError(
          "ACTIVITY_NOT_PUBLISHED",
          409,
          "Somente atividades aprovadas podem ser disponibilizadas publicamente.",
        ),
      ),
    } as unknown as ReturnType<typeof makeSetActivityVisibilityService>);

    const reply = createReply();
    await updateActivityVisibilityController(
      createRequest(),
      reply as unknown as FastifyReply,
    );

    expect(reply.status).toHaveBeenCalledWith(409);
    expect(reply.send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: "ACTIVITY_NOT_PUBLISHED",
        message: "Somente atividades aprovadas podem ser disponibilizadas publicamente.",
      },
      requestId: "request-123",
    });
  });
});
