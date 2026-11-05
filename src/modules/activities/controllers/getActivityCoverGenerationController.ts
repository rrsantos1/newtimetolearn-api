import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { makeActivityCoverGenerationJobRepository } from "../factories/make-activity-cover-generation-job-repository";

const paramsSchema = z.object({ jobId: z.string().uuid() });

export async function getActivityCoverGenerationController(
  request: FastifyRequest<{ Params: { jobId: string } }>,
  reply: FastifyReply,
) {
  const parsed = paramsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply.status(400).send({
      success: false,
      error: { code: "INVALID_JOB_ID", message: "Identificador da geração inválido." },
    });
  }

  const job = await makeActivityCoverGenerationJobRepository().findByIdAndUserId(
    parsed.data.jobId,
    request.user.sub,
  );

  if (!job) {
    return reply.status(404).send({
      success: false,
      error: { code: "GENERATION_JOB_NOT_FOUND", message: "Solicitação de geração não encontrada." },
    });
  }

  return reply.send({
    success: true,
    data: {
      jobId: job.id,
      status: job.status,
      message: job.errorMessage,
      errorCode: job.errorCode,
      asset: job.status === "COMPLETED" && job.assetStatus === "APPROVED"
        ? {
            id: job.mediaAssetId,
            status: job.assetStatus,
            publicUrl: job.publicUrl,
            altText: job.altText,
            fileName: job.fileName,
            storageKey: job.storageKey,
          }
        : null,
    },
  });
}
