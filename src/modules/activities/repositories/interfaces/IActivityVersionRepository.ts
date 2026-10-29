import type { EntityManager } from "typeorm";
import { ActivityVersion } from "../../entities/ActivityVersion";
import { ActivityVersionStatus } from "../../types/ActivityVersionStatus";

export interface IActivityVersionRepository {
  findById(id: string): Promise<ActivityVersion | null>;

  findByActivityIdAndVersionNumber(
    activityId: string,
    versionNumber: number,
  ): Promise<ActivityVersion | null>;

  findByActivityId(
    activityId: string,
  ): Promise<ActivityVersion[]>;

  findByActivityIdAndStatus(
    activityId: string,
    status: ActivityVersionStatus,
  ): Promise<ActivityVersion | null>;

  findLatestByActivityId(
    activityId: string,
  ): Promise<ActivityVersion | null>;

  save(
    manager: EntityManager,
    version: ActivityVersion,
  ): Promise<ActivityVersion>;
}