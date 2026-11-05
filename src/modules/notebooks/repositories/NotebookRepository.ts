import { AppDataSource } from "../../../shared/database/data-source";
import { TeacherStudentRelationship } from "../../teacher-students/entities/TeacherStudentRelationship";
import { TeacherStudentStatus } from "../../teacher-students/types/TeacherStudentStatus";
import { NotebookDay } from "../entities/NotebookDay";
import { NotebookEntry, type NotebookEntryKind } from "../entities/NotebookEntry";
import { NotebookNote } from "../entities/NotebookNote";

export class NotebookRepository {
  async findActiveRelationship(relationshipId: string): Promise<TeacherStudentRelationship | null> {
    return AppDataSource.getRepository(TeacherStudentRelationship).findOne({
      where: { id: relationshipId, status: TeacherStudentStatus.ACTIVE },
    });
  }

  async listDays(relationshipId: string): Promise<Array<NotebookDay & { entries: NotebookEntry[] }>> {
    const days = await AppDataSource.getRepository(NotebookDay).find({
      where: { relationshipId },
      order: { dayDate: "DESC" },
    });
    const dayIds = days.map((day) => day.id);
    if (dayIds.length === 0) return [];

    const entries = await AppDataSource.getRepository(NotebookEntry)
      .createQueryBuilder("entry")
      .where("entry.dayId IN (:...dayIds)", { dayIds })
      .andWhere("entry.deletedAt IS NULL")
      .orderBy("entry.position", "ASC")
      .addOrderBy("entry.createdAt", "ASC")
      .getMany();

    return days.map((day) => ({
      ...day,
      entries: entries.filter((entry) => entry.dayId === day.id),
    }));
  }

  async createEntry(
    relationshipId: string,
    authorId: string,
    kind: NotebookEntryKind,
    content: Record<string, unknown>,
  ): Promise<{ entry: NotebookEntry; day: NotebookDay; isFirstEntry: boolean }> {
    return AppDataSource.transaction(async (manager) => {
      const dayRepository = manager.getRepository(NotebookDay);
      const dayDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

      await manager.query(
        `INSERT INTO notebook_days (relationship_id, day_date)
         VALUES ($1, $2)
         ON CONFLICT (relationship_id, day_date) DO NOTHING`,
        [relationshipId, dayDate],
      );

      const day = await dayRepository.findOne({
        where: { relationshipId, dayDate },
        lock: { mode: "pessimistic_write" },
      });
      if (!day) throw new Error("NOTEBOOK_DAY_CREATE_FAILED");

      const entryRepository = manager.getRepository(NotebookEntry);
      const count = await entryRepository.count({ where: { dayId: day.id } });
      const entry = entryRepository.create({
        dayId: day.id,
        createdBy: authorId,
        kind,
        content,
        position: count,
      });
      await entryRepository.save(entry);

      return { entry, day, isFirstEntry: count === 0 };
    });
  }

  async reorderEntries(relationshipId: string, dayId: string, entryIds: string[]): Promise<void> {
    await AppDataSource.transaction(async (manager) => {
      const day = await manager.getRepository(NotebookDay).findOne({
        where: { id: dayId, relationshipId },
        lock: { mode: "pessimistic_write" },
      });
      if (!day) throw new Error("NOTEBOOK_DAY_NOT_FOUND");

      const repository = manager.getRepository(NotebookEntry);
      const entries = await repository.find({ where: { dayId, deletedAt: null }, order: { position: "ASC" } });
      const currentIds = new Set(entries.map((entry) => entry.id));
      if (
        entryIds.length !== entries.length ||
        new Set(entryIds).size !== entryIds.length ||
        entryIds.some((id) => !currentIds.has(id))
      ) {
        throw new Error("INVALID_NOTEBOOK_ENTRY_ORDER");
      }

      for (const [position, id] of entryIds.entries()) {
        await repository.update({ id, dayId }, { position });
      }
    });
  }

  async updateEntry(
    relationshipId: string,
    entryId: string,
    expectedKind: NotebookEntryKind,
    content: Record<string, unknown> | undefined,
    dayDate: string | undefined,
  ): Promise<NotebookEntry> {
    return AppDataSource.transaction(async (manager) => {
      const entryRepository = manager.getRepository(NotebookEntry);
      const entry = await entryRepository
        .createQueryBuilder("entry")
        .innerJoin(NotebookDay, "day", "day.id = entry.day_id")
        .where("entry.id = :entryId", { entryId })
        .andWhere("day.relationship_id = :relationshipId", { relationshipId })
        .andWhere("entry.deleted_at IS NULL")
        .setLock("pessimistic_write")
        .getOne();
      if (!entry) throw new Error("NOTEBOOK_ENTRY_NOT_FOUND");
      if (entry.kind !== expectedKind) throw new Error("NOTEBOOK_ENTRY_KIND_MISMATCH");

      if (content) entry.content = content;

      if (dayDate) {
        const oldDay = await manager.getRepository(NotebookDay).findOne({
          where: { id: entry.dayId, relationshipId },
          lock: { mode: "pessimistic_write" },
        });
        if (!oldDay) throw new Error("NOTEBOOK_DAY_NOT_FOUND");

        if (oldDay.dayDate !== dayDate) {
          await manager.query(
            `INSERT INTO notebook_days (relationship_id, day_date)
             VALUES ($1, $2)
             ON CONFLICT (relationship_id, day_date) DO NOTHING`,
            [relationshipId, dayDate],
          );
          const newDay = await manager.getRepository(NotebookDay).findOne({
            where: { relationshipId, dayDate },
            lock: { mode: "pessimistic_write" },
          });
          if (!newDay) throw new Error("NOTEBOOK_DAY_CREATE_FAILED");

          const newPosition = await entryRepository.count({ where: { dayId: newDay.id, deletedAt: null } });
          entry.dayId = newDay.id;
          entry.position = newPosition;
          await entryRepository.save(entry);

          const remaining = await entryRepository.find({
            where: { dayId: oldDay.id, deletedAt: null },
            order: { position: "ASC" },
          });
          for (const [position, remainingEntry] of remaining.entries()) {
            await entryRepository.update({ id: remainingEntry.id }, { position });
          }
          return entry;
        }
      }

      return entryRepository.save(entry);
    });
  }

  async softDeleteEntry(
    relationshipId: string,
    entryId: string,
    userId: string,
  ): Promise<void> {
    await AppDataSource.transaction(async (manager) => {
      const entryRepository = manager.getRepository(NotebookEntry);
      const entry = await entryRepository
        .createQueryBuilder("entry")
        .innerJoin(NotebookDay, "day", "day.id = entry.day_id")
        .where("entry.id = :entryId", { entryId })
        .andWhere("day.relationship_id = :relationshipId", { relationshipId })
        .andWhere("entry.deleted_at IS NULL")
        .setLock("pessimistic_write")
        .getOne();
      if (!entry) throw new Error("NOTEBOOK_ENTRY_NOT_FOUND");

      entry.deletedAt = new Date();
      entry.deletedBy = userId;
      await entryRepository.save(entry);

      const remaining = await entryRepository.find({
        where: { dayId: entry.dayId, deletedAt: null },
        order: { position: "ASC" },
      });
      for (const [position, remainingEntry] of remaining.entries()) {
        await entryRepository.update({ id: remainingEntry.id }, { position });
      }
    });
  }

  async findAttachmentEntry(relationshipId: string, entryId: string): Promise<NotebookEntry | null> {
    return AppDataSource.getRepository(NotebookEntry)
      .createQueryBuilder("entry")
      .innerJoin(NotebookDay, "day", "day.id = entry.day_id")
      .where("entry.id = :entryId", { entryId })
      .andWhere("day.relationship_id = :relationshipId", { relationshipId })
      .andWhere("entry.kind IN (:...kinds)", { kinds: ["IMAGE", "FILE"] })
      .andWhere("entry.deleted_at IS NULL")
      .getOne();
  }

  async listNotes(relationshipId: string): Promise<NotebookNote[]> {
    return AppDataSource.getRepository(NotebookNote).find({
      where: { relationshipId },
      order: { createdAt: "ASC" },
    });
  }

  async createNote(
    relationshipId: string,
    authorId: string,
    message: string,
    parentId: string | null,
  ): Promise<NotebookNote> {
    const repository = AppDataSource.getRepository(NotebookNote);
    if (parentId) {
      const parent = await repository.findOne({ where: { id: parentId, relationshipId } });
      if (!parent) throw new Error("NOTE_PARENT_NOT_FOUND");
    }
    return repository.save(repository.create({ relationshipId, authorId, message, parentId }));
  }
}
