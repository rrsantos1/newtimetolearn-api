import { config } from "dotenv";

config({ path: ".env.test", override: true });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL não foi definida em .env.test.");
}

const databaseName = new URL(databaseUrl).pathname.replace(/^\/+/, "");

if (databaseName !== "newtimetolearn_test") {
  throw new Error(
    "Os testes de integração só podem executar no banco newtimetolearn_test.",
  );
}