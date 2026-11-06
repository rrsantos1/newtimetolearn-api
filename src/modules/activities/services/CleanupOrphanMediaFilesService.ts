import { env } from "../../../shared/config/env";
import { makeStorageProvider } from "../../../shared/storage/storageFactory";
import type { StorageUsageRepository } from "../../../shared/storage/repositories/StorageUsageRepository";

const ORPHAN_MIN_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_DELETIONS_PER_RUN = 500;

export interface CleanupOrphanMediaFilesResult {
  scanned: number;
  referenced: number;
  deleted: number;
  skippedRecent: number;
  eligibleForDeletion: number;
  dryRun: boolean;
}

export class CleanupOrphanMediaFilesService {
  constructor(private readonly repository: StorageUsageRepository) {}

  async execute(dryRun = true): Promise<CleanupOrphanMediaFilesResult> {
    if (!env.B2_BUCKET_NAME || !env.B2_QUARANTINE_BUCKET_NAME) {
      throw new Error("STORAGE_NOT_CONFIGURED");
    }

    const storage = makeStorageProvider();
    const [referencedObjects, publicObjects, privateObjects] = await Promise.all([
      this.repository.listReferencedObjects(),
      Promise.all([
        storage.listObjects(env.B2_BUCKET_NAME, "media/"),
        storage.listObjects(env.B2_BUCKET_NAME, "audio/listening/"),
      ]),
      Promise.all([
        storage.listObjects(env.B2_QUARANTINE_BUCKET_NAME, "notebooks/"),
        storage.listObjects(env.B2_QUARANTINE_BUCKET_NAME, "quarantine/"),
      ]),
    ]);

    const objects = [
      ...publicObjects.flat().map((object) => ({
        ...object,
        bucketName: env.B2_BUCKET_NAME,
      })),
      ...privateObjects.flat().map((object) => ({
        ...object,
        bucketName: env.B2_QUARANTINE_BUCKET_NAME,
      })),
    ];
    const referencedKeys = new Set(
      referencedObjects.map((object) => `${object.bucketName}:${object.storageKey}`),
    );
    const cutoff = Date.now() - ORPHAN_MIN_AGE_MS;
    const orphanCandidates = objects.filter((object) => {
      if (referencedKeys.has(`${object.bucketName}:${object.key}`)) return false;
      return object.lastModified !== null && object.lastModified.getTime() <= cutoff;
    }).slice(0, MAX_DELETIONS_PER_RUN);

    const skippedRecent = objects.filter((object) =>
      !referencedKeys.has(`${object.bucketName}:${object.key}`)
      && (!object.lastModified || object.lastModified.getTime() > cutoff),
    ).length;

    let deleted = 0;
    if (!dryRun) {
      for (const object of orphanCandidates) {
        await storage.deleteObject(object.key, object.bucketName);
        deleted += 1;
      }
    }

    return {
      scanned: objects.length,
      referenced: objects.length - objects.filter((object) =>
        !referencedKeys.has(`${object.bucketName}:${object.key}`),
      ).length,
      deleted,
      skippedRecent,
      eligibleForDeletion: orphanCandidates.length,
      dryRun,
    };
  }
}
