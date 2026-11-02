export interface AppErrorDiagnostic {
  name: string;
  message: string;
  code?: string;
}

export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
    public readonly diagnostic?: AppErrorDiagnostic,
  ) {
    super(message);
    this.name = "AppError";
  }
}