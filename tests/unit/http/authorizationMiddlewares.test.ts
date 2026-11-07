import type { FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, it, vi } from "vitest";
import { authorizeRoles } from "../../../src/shared/http/middlewares/authorizeRoles";
import { authMiddleware } from "../../../src/shared/http/middlewares/authMiddleware";
import { RoleCode } from "../../../src/modules/users/types/RoleCode";

function makeReply() {
  const send = vi.fn();
  const status = vi.fn().mockReturnValue({ send });
  return {
    reply: { status } as unknown as FastifyReply,
    status,
    send,
  };
}

describe("authorization middlewares", () => {
  it("allows a user when at least one assigned role is authorized", async () => {
    const request = {
      id: "request-1",
      user: { roles: [RoleCode.TEACHER, RoleCode.ADMIN] },
    } as unknown as FastifyRequest;
    const { reply, status, send } = makeReply();

    await authorizeRoles(RoleCode.ADMIN)(request, reply);

    expect(status).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("returns 401 when role authorization runs without an authenticated user", async () => {
    const request = { id: "request-2", user: undefined } as unknown as FastifyRequest;
    const { reply, status, send } = makeReply();

    await authorizeRoles(RoleCode.ADMIN)(request, reply);

    expect(status).toHaveBeenCalledWith(401);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.objectContaining({ code: "UNAUTHORIZED" }),
      requestId: "request-2",
    }));
  });

  it("returns 403 when the authenticated user has no allowed role", async () => {
    const request = {
      id: "request-3",
      user: { roles: [RoleCode.STUDENT] },
    } as unknown as FastifyRequest;
    const { reply, status, send } = makeReply();

    await authorizeRoles(RoleCode.TEACHER, RoleCode.ADMIN)(request, reply);

    expect(status).toHaveBeenCalledWith(403);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.objectContaining({ code: "FORBIDDEN" }),
      requestId: "request-3",
    }));
  });

  it("does not reject an authenticated user when JWT verification succeeds", async () => {
    const jwtVerify = vi.fn().mockResolvedValue(undefined);
    const request = { id: "request-4", jwtVerify } as unknown as FastifyRequest;
    const { reply, status, send } = makeReply();

    await authMiddleware(request, reply);

    expect(jwtVerify).toHaveBeenCalledOnce();
    expect(status).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("returns 401 when JWT verification fails", async () => {
    const jwtVerify = vi.fn().mockRejectedValue(new Error("invalid token"));
    const request = { id: "request-5", jwtVerify } as unknown as FastifyRequest;
    const { reply, status, send } = makeReply();

    await authMiddleware(request, reply);

    expect(status).toHaveBeenCalledWith(401);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.objectContaining({ code: "UNAUTHORIZED" }),
      requestId: "request-5",
    }));
  });
});
