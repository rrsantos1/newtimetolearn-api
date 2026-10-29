import "reflect-metadata";
import "dotenv/config";

import { AppDataSource } from "../src/shared/database/data-source";

async function checkDatabase(): Promise<void> {
  try {
    await AppDataSource.initialize();

    const result: Array<{ current_database: string }> =
      await AppDataSource.query(
        "SELECT current_database() AS current_database",
      );

    process.stdout.write(
      `Conexão estabelecida: ${result[0]?.current_database ?? "desconhecido"}\n`,
    );
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

checkDatabase().catch((error: unknown) => {
  process.stderr.write(
    `Falha na conexão: ${error instanceof Error ? error.message : "Erro desconhecido"}\n`,
  );

  process.exitCode = 1;
});