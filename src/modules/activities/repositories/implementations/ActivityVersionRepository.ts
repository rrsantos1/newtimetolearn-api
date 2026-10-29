import type { EntityManager } from "typeorm";
import { AppDataSource } from "../../../../shared/database/data-source";
import { ActivityVersion } from "../../entities/ActivityVersion";
import { ActivityVersionStatus } from "../../types/ActivityVersionStatus";
import { IActivityVersionRepository } from "../interfaces/IActivityVersionRepository";

export class ActivityVersionRepository
  implements IActivityVersionRepository
{
  private readonly repository = AppDataSource.getRepository(ActivityVersion);

  async findById(id: string): Promise<ActivityVersion | null> {
    return this.repository.findOne({
      where: { id },
    });
  }

  async findByActivityIdAndVersionNumber(
    activityId: string,
    versionNumber: number,
  ): Promise<ActivityVersion | null> {
    return this.repository.findOne({
      where: {
        activityId,
        versionNumber,
      },
    });
  }

  async findByActivityId(
    activityId: string,
  ): Promise<ActivityVersion[]> {
    return this.repository.find({
      where: { activityId },
      order: { versionNumber: "DESC" },
    });
  }

  async findByActivityIdAndStatus(
    activityId: string,
    status: ActivityVersionStatus,
  ): Promise<ActivityVersion | null> {
    return this.repository.findOne({
      where: {
        activityId,
        status,
      },
    });
  }

  async findLatestByActivityId(
    activityId: string,
  ): Promise<ActivityVersion | null> {
    return this.repository.findOne({
      where: { activityId },
      order: { versionNumber: "DESC" },
    });
  }

  async save(
    manager: EntityManager,
    version: ActivityVersion,
  ): Promise<ActivityVersion> {
    return manager.getRepository(ActivityVersion).save(version);
  }
}