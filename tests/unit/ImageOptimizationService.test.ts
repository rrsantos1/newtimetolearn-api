import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { optimizeImage } from "../../src/modules/activities/services/ImageOptimizationService";

describe("optimizeImage", () => {
  it("converte imagens estáticas para WebP e gera miniaturas menores", async () => {
    const source = await sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 3,
        background: { r: 245, g: 120, b: 40 },
      },
    }).png().toBuffer();

    const result = await optimizeImage(source, "image/png");
    const optimizedMetadata = await sharp(result.imageBuffer).metadata();
    const thumbnailMetadata = await sharp(result.thumbnailBuffer).metadata();

    expect(result.contentType).toBe("image/webp");
    expect(result.isAnimated).toBe(false);
    expect(optimizedMetadata.format).toBe("webp");
    expect(optimizedMetadata.width).toBe(1200);
    expect(thumbnailMetadata.format).toBe("webp");
    expect(thumbnailMetadata.width).toBeLessThanOrEqual(480);
    expect(result.thumbnailBuffer.byteLength).toBeLessThan(result.imageBuffer.byteLength);
  });

  it("não amplia imagens pequenas na geração da miniatura", async () => {
    const source = await sharp({
      create: {
        width: 64,
        height: 48,
        channels: 3,
        background: { r: 20, g: 80, b: 160 },
      },
    }).png().toBuffer();

    const result = await optimizeImage(source, "image/png");
    const thumbnailMetadata = await sharp(result.thumbnailBuffer).metadata();

    expect(thumbnailMetadata.width).toBe(64);
    expect(thumbnailMetadata.height).toBe(48);
  });

  it("rejeita conteúdo que não pode ser decodificado", async () => {
    await expect(
      optimizeImage(Buffer.from("conteudo inválido"), "image/png"),
    ).rejects.toThrow("INVALID_IMAGE_CONTENT");
  });
});
