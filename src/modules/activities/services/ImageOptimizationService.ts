import sharp from "sharp";

const MAX_INPUT_PIXELS = 50_000_000;
const MAX_ORIGINAL_WIDTH = 2560;
const THUMBNAIL_WIDTH = 480;

export interface OptimizedImage {
  imageBuffer: Buffer;
  contentType: "image/webp" | "image/gif";
  thumbnailBuffer: Buffer;
  isAnimated: boolean;
}

export async function optimizeImage(
  inputBuffer: Buffer,
  contentType: string,
): Promise<OptimizedImage> {
  try {
    const metadata = await sharp(inputBuffer, {
      animated: true,
      limitInputPixels: MAX_INPUT_PIXELS,
      failOn: "error",
    }).metadata();

    const isAnimated = (metadata.pages ?? 1) > 1;
    const thumbnailBuffer = await sharp(inputBuffer, {
      page: 0,
      limitInputPixels: MAX_INPUT_PIXELS,
      failOn: "error",
    })
      .rotate()
      .resize({
        width: THUMBNAIL_WIDTH,
        height: THUMBNAIL_WIDTH,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 76, effort: 4 })
      .toBuffer();

    if (isAnimated) {
      return {
        imageBuffer: inputBuffer,
        contentType: contentType === "image/gif" ? "image/gif" : "image/webp",
        thumbnailBuffer,
        isAnimated: true,
      };
    }

    const imageBuffer = await sharp(inputBuffer, {
      limitInputPixels: MAX_INPUT_PIXELS,
      failOn: "error",
    })
      .rotate()
      .resize({
        width: MAX_ORIGINAL_WIDTH,
        height: MAX_ORIGINAL_WIDTH,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();

    return {
      imageBuffer,
      contentType: "image/webp",
      thumbnailBuffer,
      isAnimated: false,
    };
  } catch {
    throw new Error("INVALID_IMAGE_CONTENT");
  }
}
