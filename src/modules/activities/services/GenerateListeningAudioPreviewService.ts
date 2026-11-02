import { env } from "../../../shared/config/env";
import { AppError } from "../../../shared/errors/AppError";

const supportedVoices = [
  "alloy", "ash", "ballad", "coral", "echo", "fable", "nova",
  "onyx", "sage", "shimmer", "verse", "marin", "cedar",
] as const;

export type ListeningPreviewVoice = (typeof supportedVoices)[number];

export interface GenerateListeningAudioPreviewInput {
  text: string;
  language: string;
  voice: ListeningPreviewVoice;
}

export class GenerateListeningAudioPreviewService {
  async execute(input: GenerateListeningAudioPreviewInput): Promise<{ audioDataUrl: string; disclosure: string }> {
    if (!env.OPENAI_API_KEY) {
      throw new AppError("OPENAI_NOT_CONFIGURED", 503, "A integração de áudio com a OpenAI não está configurada.");
    }
    if (!input.text.trim()) {
      throw new AppError("LISTENING_TEXT_REQUIRED", 422, "Informe o texto antes de gerar o áudio.");
    }
    if (input.text.length > 4096) {
      throw new AppError("LISTENING_TEXT_TOO_LONG", 422, "O texto pode ter no máximo 4.096 caracteres.");
    }

    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.OPENAI_TTS_MODEL,
        voice: input.voice,
        input: input.text,
        instructions: `Leia o texto naturalmente no idioma ${input.language}.`,
        response_format: "mp3",
      }),
      signal: AbortSignal.timeout(90_000),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new AppError("OPENAI_RATE_LIMIT", 429, "O serviço de áudio está ocupado. Aguarde e tente novamente.");
      }
      if (response.status === 401 || response.status === 403) {
        throw new AppError("OPENAI_CONFIGURATION_ERROR", 503, "A configuração de acesso ao serviço de áudio precisa ser verificada.");
      }
      throw new AppError("AUDIO_GENERATION_FAILED", 502, "Não foi possível gerar o áudio neste momento.");
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    if (audioBuffer.byteLength === 0 || audioBuffer.byteLength > 20 * 1024 * 1024) {
      throw new AppError("AUDIO_SIZE_INVALID", 502, "O áudio gerado está vazio ou excede o tamanho permitido.");
    }

    return {
      audioDataUrl: `data:audio/mpeg;base64,${audioBuffer.toString("base64")}`,
      disclosure: "Prévia de áudio gerada por inteligência artificial; a voz não é humana. O áudio será gerado novamente e salvo ao gerar a narração da atividade.",
    };
  }
}
