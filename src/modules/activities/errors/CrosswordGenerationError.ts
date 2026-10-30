export class CrosswordGenerationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INVALID_BOARD"
      | "INCOMPLETE_GENERATION"
      | "INVALID_PLACEMENT",
  ) {
    super(message);
    this.name = "CrosswordGenerationError";
  }
}
