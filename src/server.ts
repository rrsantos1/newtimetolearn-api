import "reflect-metadata";
import "dotenv/config";

import { buildApp } from "./app";
import { AppDataSource } from "./shared/database/data-source";

async function startServer(): Promise<void> {
  const app = buildApp();
  const port = Number(process.env.PORT ?? 3001);
  const host = process.env.HOST ?? "0.0.0.0";

  try {
    await AppDataSource.initialize();
    app.log.info("Conexão com o banco de dados estabelecida.");

    await app.listen({ port, host });
  } catch (error: unknown) {
    app.log.error(error, "Falha ao iniciar a aplicação.");

    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }

    await app.close().catch(() => undefined);
    process.exitCode = 1;
  }
}

void startServer();