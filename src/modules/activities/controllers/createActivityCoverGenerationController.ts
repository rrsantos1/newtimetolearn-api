import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { AppDataSource } from "../../../shared/database/data-source";

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

  const rows = await AppDataSource.query<Array<{ id: string }>>( `
    INSERT INTO public.activity_cover_generation_jobs (user_id, prompt)
    VALUES ($1, $2)
    RETURNING id
  `, [request.user.sub, parsed.data.prompt]);

  return reply.status(202).send({
    success: true,
    data: { jobId: rows[0].id, status: "PENDING" },
  });
}
