import { env } from "../../../shared/config/env";
import { makeStorageProvider } from "../../../shared/storage/storageFactory";
import type { IMediaAssetRepository } from "../repositories/interfaces/IMediaAssetRepository";

const ORPHAN_MIN_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_DELETIONS_PER_RUN = 500;

export interface CleanupOrphanMediaFilesResult {
  scanned: number;
  referenced: number;
  deleted: number;
  skippedRecent: number;
}

export class CleanupOrphanMediaFilesService {
  constructor(private readonly repository: IMediaAssetRepository) {}

  async execute(): Promise<CleanupOrphanMediaFilesResult> {
    if (!env.B2_BUCKET_NAME) throw new Error("STORAGE_NOT_CONFIGURED");

    const [objects, storedKeys] = await Promise.all([
      makeStorageProvider().listObjects(env.B2_BUCKET_NAME, "media/"),
      this.repository.listStoredKeys(),
    ]);
    const referencedKeys = new Set(storedKeys);
    const cutoff = Date.now() - ORPHAN_MIN_AGE_MS;
    const orphanCandidates = objects.filter((object) => {
      if (referencedKeys.has(object.key)) return false;
      if (!object.lastModified || object.lastModified.getTime() > cutoff) return false;
      return true;
    }).slice(0, MAX_DELETIONS_PER_RUN);

    let skippedRecent = 0;
    for (const object of objects) {
      if (!referencedKeys.has(object.key)
        && (!object.lastModified || object.lastModified.getTime() > cutoff)) {
        skippedRecent += 1;
      }
    }

    const storage = makeStorageProvider();
    let deleted = 0;
    for (const object of orphanCandidates) {
      await storage.deleteObject(object.key, env.B2_BUCKET_NAME);
      deleted += 1;
    }

    return {
      scanned: objects.length,
      referenced: objects.length - objects.filter((object) => !referencedKeys.has(object.key)).length,
      deleted,
      skippedRecent,
    };
  }
}
