import { AppDataSource } from "./data-source";

export async function connectDatabase(): Promise<void> {
  if (AppDataSource.isInitialized) {
    return;
  }

  await AppDataSource.initialize();
}