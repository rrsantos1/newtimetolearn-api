import { QueryFailedError } from "typeorm";

interface PostgresError {
  code?: string;
  constraint?: string;
}

export function isUniqueConstraintViolation(
  error: unknown,
  constraint: string,
): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const driverError = (
    error as QueryFailedError & { driverError?: PostgresError }
  ).driverError;

  return (
    driverError?.code === "23505" &&
    driverError.constraint === constraint
  );
}