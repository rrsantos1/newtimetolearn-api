import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const run = promisify(execFile);
const MAX_BYTES = 40 * 1024 * 1024;
const MAX_PAGES = 120;

export interface PreviewPage {
  pageNumber: number;
  buffer: Buffer;
  thumbnailBuffer: Buffer;
}

function resolveExecutable(environmentVariable: string, fallback: string): string {
  const configuredPath = process.env[environmentVariable]?.trim();
  if (configuredPath) return configuredPath;

  if (process.platform === "win32") {
    const programFiles = process.env.ProgramFiles ?? "C:\\Program Files";
    const candidates = [
      join(programFiles, "LibreOffice", "program", "soffice.exe"),
      join("C:\\Program Files (x86)", "LibreOffice", "program", "soffice.exe"),
    ];

    const installedPath = candidates.find((candidate) => existsSync(candidate));
    if (environmentVariable === "LIBREOFFICE_PATH" && installedPath) return installedPath;
  }

  return fallback;
}

const LIBREOFFICE_COMMAND = resolveExecutable(
  "LIBREOFFICE_PATH",
  process.platform === "win32" ? "soffice" : "libreoffice",
);
const PDFINFO_COMMAND = resolveExecutable("PDFINFO_PATH", "pdfinfo");
const PDFTOPPM_COMMAND = resolveExecutable("PDFTOPPM_PATH", "pdftoppm");

export class PresentationPreviewGenerator {
  async generate(file: Buffer, contentType: string): Promise<PreviewPage[]> {
    if (file.length === 0 || file.length > MAX_BYTES) {
      throw new Error("MARKETPLACE_FILE_SIZE_INVALID");
    }

    const extension =
      contentType === "application/pdf"
        ? "pdf"
        : contentType === "application/vnd.ms-powerpoint"
          ? "ppt"
          : contentType === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            ? "pptx"
            : "";

    if (!extension) throw new Error("MARKETPLACE_FILE_TYPE_INVALID");

    const dir = await mkdtemp(join(tmpdir(), "ttl-marketplace-"));

    try {
      const input = join(dir, `source.${extension}`);
      await writeFile(input, file, { flag: "wx" });

      const pdf = extension === "pdf" ? input : join(dir, "source.pdf");

      if (extension !== "pdf") {
        await run(
          LIBREOFFICE_COMMAND,
          ["--headless", "--convert-to", "pdf", "--outdir", dir, input],
          { timeout: 120000, maxBuffer: 4 * 1024 * 1024 },
        );
      }

      const pdfInfo = await run(PDFINFO_COMMAND, [pdf], {
        timeout: 15000,
        maxBuffer: 1024 * 1024,
      });
      const pageCount = Number(pdfInfo.stdout.match(/^Pages:\s+(\d+)$/m)?.[1] ?? 0);

      if (pageCount < 1 || pageCount > MAX_PAGES) {
        throw new Error("MARKETPLACE_PAGE_COUNT_INVALID");
      }

      await run(
        PDFTOPPM_COMMAND,
        ["-jpeg", "-jpegopt", "quality=78", "-r", "105", "-f", "1", "-l", String(MAX_PAGES), pdf, join(dir, "slide")],
        { timeout: 120000, maxBuffer: 4 * 1024 * 1024 },
      );

      const names = (await readdir(dir))
        .filter((name) => /^slide-\d+\.jpg$/.test(name))
        .sort((a, b) => Number(a.match(/\d+/)?.[0] ?? 0) - Number(b.match(/\d+/)?.[0] ?? 0));

      if (names.length === 0 || names.length > MAX_PAGES) {
        throw new Error("MARKETPLACE_PAGE_COUNT_INVALID");
      }

      const result: PreviewPage[] = [];

      for (let index = 0; index < names.length; index += 1) {
        const name = names[index];
        if (!name) continue;

        const source = await readFile(join(dir, name));
        const meta = await sharp(source).metadata();
        const width = meta.width ?? 1200;
        const height = meta.height ?? 900;
        const watermark = Buffer.from(
          `<svg width="${width}" height="${height}"><g transform="rotate(-25 ${width / 2} ${height / 2})"><text x="50%" y="50%" text-anchor="middle" font-family="Arial" font-size="${Math.max(36, width / 12)}" font-weight="800" fill="#dc2626" fill-opacity=".60">TIMETOLEARN • PRÉVIA</text></g><text x="50%" y="96%" text-anchor="middle" font-family="Arial" font-size="${Math.max(16, width / 60)}" font-weight="700" fill="#b91c1c" fill-opacity=".75">Material protegido • Uso demonstrativo</text></svg>`,
        );

        const optimizedBuffer = await sharp(source)
          .composite([{ input: watermark }])
          .resize({
            width: 1600,
            height: 1600,
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({ quality: 72, mozjpeg: true })
          .toBuffer();
        const thumbnailBuffer = await sharp(optimizedBuffer)
          .resize({
            width: 480,
            height: 480,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 76, effort: 4 })
          .toBuffer();

        result.push({
          pageNumber: index + 1,
          buffer: optimizedBuffer,
          thumbnailBuffer,
        });
      }

      return result;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}
