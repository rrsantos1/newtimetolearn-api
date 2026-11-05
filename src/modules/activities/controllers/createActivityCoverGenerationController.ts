import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { makeActivityCoverGenerationJobRepository } from "../factories/make-activity-cover-generation-job-repository";

const bodySchema = z.object({
  prompt: z.string().trim().min(5).max(1000),
});

export async function createActivityCoverGenerationController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const parsed = bodySchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Descreva a imagem em até 1.000 caracteres." },
      requestId: request.id,
    });
  }

  const job = await makeActivityCoverGenerationJobRepository().create(
    request.user.sub,
    parsed.data.prompt,
  );

  if (!job) {
    return reply.status(500).send({
      success: false,
      error: { code: "GENERATION_JOB_CREATE_FAILED", message: "Não foi possível iniciar a geração da capa." },
      requestId: request.id,
    });
  }

  return reply.status(202).send({
    success: true,
    data: { jobId: job.id, status: "PENDING" },
  });
}
