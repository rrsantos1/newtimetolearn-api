import { AppDataSource } from "../../../../shared/database/data-source";
import { ListeningAttempt } from "../../entities/ListeningAttempt";
import type {
  CreateListeningAttemptInput,
  IListeningAttemptRepository,
} from "../interfaces/IListeningAttemptRepository";

export class ListeningAttemptRepository implements IListeningAttemptRepository {
  private readonly repository = AppDataSource.getRepository(ListeningAttempt);

  async create(input: CreateListeningAttemptInput): Promise<ListeningAttempt> {
    const attempt = this.repository.create(input);
    return this.repository.save(attempt);
  }

  async getRanking(activityId: string): Promise<ListeningAttempt[]> {
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

  async listByActivity(activityId: string, page: number, limit: number) {
    const [items, total] = await this.repository.findAndCount({
      where: { activityId },
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total };
  }
}
