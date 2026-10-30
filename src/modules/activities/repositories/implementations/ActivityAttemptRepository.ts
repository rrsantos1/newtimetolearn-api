import { AppDataSource } from "../../../../shared/database/data-source";
import { ActivityAttempt } from "../../entities/ActivityAttempt";
import type {
  CreateActivityAttemptInput,
  IActivityAttemptRepository,
  ListActivityAttemptsResult,
} from "../interfaces/IActivityAttemptRepository";

export class ActivityAttemptRepository implements IActivityAttemptRepository {
  private readonly repository = AppDataSource.getRepository(ActivityAttempt);

  async create(input: CreateActivityAttemptInput): Promise<ActivityAttempt> {
    const attempt = this.repository.create(input);
    return this.repository.save(attempt);
  }

  async getRanking(activityId: string): Promise<ActivityAttempt[]> {
    return this.repository.find({
      where: { activityId },
      order: {
        score: "DESC",
        elapsedSeconds: "ASC",
        createdAt: "ASC",
      },
      take: 5,
    });
  }

  async listByActivity(
    activityId: string,
    page: number,
    limit: number,
  ): Promise<ListActivityAttemptsResult> {
    const [items, total] = await this.repository.findAndCount({
      where: { activityId },
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total };
  }
}
