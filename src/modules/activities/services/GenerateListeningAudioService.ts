import { createHash, randomUUID } from "node:crypto";
import { AppDataSource } from "../../../shared/database/data-source";
import { env } from "../../../shared/config/env";
import { makeStorageProvider } from "../../../shared/storage/storageFactory";
import { AppError } from "../../../shared/errors/AppError";
import { ActivityVersion } from "../entities/ActivityVersion";
import type { IActivityRepository } from "../repositories/interfaces/IActivityRepository";
import type { IActivityVersionRepository } from "../repositories/interfaces/IActivityVersionRepository";
import { listeningDraftContentSchema } from "../schemas/content/listeningContentSchema";
import { ActivityType } from "../types/ActivityType";
import { ActivityVersionStatus } from "../types/ActivityVersionStatus";

const supportedVoices = [
  "alloy", "ash", "ballad", "coral", "echo", "fable", "nova",
  "onyx", "sage", "shimmer", "verse", "marin", "cedar",
] as const;

export type ListeningVoice = (typeof supportedVoices)[number];

export interface GenerateListeningAudioInput {
  slug: string;
  passageId: string;
  teacherId: string;
  voice: ListeningVoice;
  instructions?: string;
}

export class GenerateListeningAudioService {
  constructor(
    private readonly activityRepository: IActivityRepository,
    private readonly activityVersionRepository: IActivityVersionRepository,
  ) {}

  async execute(input: GenerateListeningAudioInput) {
    if (!env.OPENAI_API_KEY) {
      throw new AppError("OPENAI_NOT_CONFIGURED", 503, "A integração de áudio com a OpenAI não está configurada.");
    }
    if (!env.B2_BUCKET_NAME || !env.B2_PUBLIC_BASE_URL) {
      throw new AppError("AUDIO_STORAGE_NOT_CONFIGURED", 503, "O armazenamento de áudio não está configurado.");
    }

    const activity = await this.activityRepository.findBySlugWithVersions(input.slug);
    if (!activity || activity.deletedAt !== null || activity.teacherId !== input.teacherId) {
      throw new AppError("ACTIVITY_NOT_FOUND", 404, "Atividade não encontrada.");
    }
    if (activity.type !== ActivityType.LISTENING) {
      throw new AppError("ACTIVITY_TYPE_NOT_SUPPORTED", 422, "Esta atividade não é um Listening.");
    }

    const versions = [...(activity.versions ?? [])].sort(
      (first, second) => second.versionNumber - first.versionNumber,
    );
    const version = versions[0];
    if (!version || version.status !== ActivityVersionStatus.DRAFT) {
      throw new AppError("LISTENING_NOT_EDITABLE", 409, "Gere o áudio somente para a versão em rascunho do Listening.");
    }

    const parsedContent = listeningDraftContentSchema.safeParse(version.content);
    if (!parsedContent.success) {
      throw new AppError("LISTENING_CONTENT_INVALID", 422, "O conteúdo do Listening é inválido.");
    }

    const passage = parsedContent.data.passages.find((item) => item.id === input.passageId);
    if (!passage) {
      throw new AppError("LISTENING_PASSAGE_NOT_FOUND", 404, "Texto do Listening não encontrado.");
    }

    const text = passage.text.trim();
    if (!text) {
      throw new AppError("LISTENING_TEXT_REQUIRED", 422, "Informe o texto antes de gerar o áudio.");
    }
    if (text.length > 4096) {
      throw new AppError("LISTENING_TEXT_TOO_LONG", 422, "Cada texto pode ter no máximo 4.096 caracteres para gerar a narração.");
    }

    const textHash = createHash("sha256").update(text, "utf8").digest("hex");
    if (
      passage.audio.status === "READY"
      && passage.audio.storageKey
      && passage.audio.textHash === textHash
      && passage.audio.voice === input.voice
      && passage.audio.model === env.OPENAI_TTS_MODEL
    ) {
      return {
        passageId: passage.id,
        audio: passage.audio,
        reused: true,
      };
    }

    const instructions = [
      `Leia o texto naturalmente no idioma ${parsedContent.data.language}.`,
      input.instructions?.trim(),
    ].filter(Boolean).join(" ").slice(0, 1000);

    const speechResponse = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.OPENAI_TTS_MODEL,
        voice: input.voice,
        input: text,
        instructions,
        response_format: "mp3",
      }),
      signal: AbortSignal.timeout(90_000),
    });

    if (!speechResponse.ok) {
      if (speechResponse.status === 429) {
        throw new AppError("OPENAI_RATE_LIMIT", 429, "O serviço de áudio está ocupado. Aguarde e tente novamente.");
      }
      if (speechResponse.status === 401 || speechResponse.status === 403) {
        throw new AppError("OPENAI_CONFIGURATION_ERROR", 503, "A configuração de acesso ao serviço de áudio precisa ser verificada.");
      }
      throw new AppError("AUDIO_GENERATION_FAILED", 502, "Não foi possível gerar o áudio neste momento.");
    }

    const audioBuffer = Buffer.from(await speechResponse.arrayBuffer());
    if (audioBuffer.byteLength === 0 || audioBuffer.byteLength > 20 * 1024 * 1024) {
      throw new AppError("AUDIO_SIZE_INVALID", 502, "O arquivo de áudio gerado está vazio ou excede o tamanho permitido.");
    }

    const storage = makeStorageProvider();
    const storageKey = `audio/listening/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.mp3`;
    await storage.uploadObject({
      bucketName: env.B2_BUCKET_NAME,
      storageKey,
      contentType: "audio/mpeg",
      body: audioBuffer,
    });

    const publicUrl = `${env.B2_PUBLIC_BASE_URL.replace(/\\/+$/, "")}/${storageKey}`;
    let savedVersion: ActivityVersion;

    try {
      savedVersion = await AppDataSource.transaction(async (manager) => {
        const currentVersion = await manager.getRepository(ActivityVersion).findOne({
          where: { id: version.id, activityId: activity.id },
        });
        if (!currentVersion || currentVersion.status !== ActivityVersionStatus.DRAFT) {
          throw new AppError("LISTENING_VERSION_CHANGED", 409, "A versão do Listening mudou durante a geração do áudio. Atualize a página e tente novamente.");
        }

        const currentContent = listeningDraftContentSchema.safeParse(currentVersion.content);
        if (!currentContent.success) {
          throw new AppError("LISTENING_CONTENT_INVALID", 422, "O conteúdo do Listening foi alterado e precisa ser revisado.");
        }

        const passageIndex = currentContent.data.passages.findIndex((item) => item.id === input.passageId);
        const currentPassage = currentContent.data.passages[passageIndex];
        if (!currentPassage || createHash("sha256").update(currentPassage.text.trim(), "utf8").digest("hex") !== textHash) {
          throw new AppError("LISTENING_TEXT_CHANGED", 409, "O texto mudou durante a geração do áudio. Gere novamente para a versão atual.");
        }

        const passages = [...currentContent.data.passages];
        passages[passageIndex] = {
          ...currentPassage,
          audio: {
            storageKey,
            publicUrl,
            status: "READY",
            model: env.OPENAI_TTS_MODEL,
            voice: input.voice,
            textHash,
            durationSeconds: null,
          },
        };
        currentVersion.content = { ...currentContent.data, passages };
        return this.activityVersionRepository.save(manager, currentVersion);
      });
    } catch (error: unknown) {
      await storage.deleteObject(storageKey, env.B2_BUCKET_NAME).catch((deleteError: unknown) => {
        console.warn("Não foi possível remover o áudio após falha ao salvar os metadados.", deleteError);
      });
      throw error;
    }

    const previousStorageKey = passage.audio.storageKey;
    if (previousStorageKey && previousStorageKey !== storageKey) {
      await storage.deleteObject(previousStorageKey, env.B2_BUCKET_NAME).catch((error: unknown) => {
        console.warn("Áudio anterior não pôde ser removido do armazenamento.", error);
      });
    }

    const savedContent = listeningDraftContentSchema.parse(savedVersion.content);
    const savedPassage = savedContent.passages.find((item) => item.id === input.passageId);
    if (!savedPassage) {
      throw new AppError("LISTENING_PASSAGE_NOT_FOUND", 404, "Texto do Listening não encontrado após salvar o áudio.");
    }

    return {
      passageId: savedPassage.id,
      audio: savedPassage.audio,
      reused: false,
    };
  }
}
