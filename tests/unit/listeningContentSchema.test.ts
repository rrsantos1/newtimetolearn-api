import { describe, expect, it } from "vitest";
import { listeningDraftContentSchema } from "../../src/modules/activities/schemas/content/listeningContentSchema";

describe("listeningDraftContentSchema", () => {
  it("applies defaults to a passage and its audio metadata", () => {
    const result = listeningDraftContentSchema.parse({
      passages: [{ id: "passage-1", text: "Olá mundo", blanks: [] }],
    });

    expect(result.language).toBe("pt-BR");
    expect(result.passages[0]?.audio).toMatchObject({
      storageKey: null,
      publicUrl: null,
      status: "PENDING",
    });
  });

  it("accepts a blank whose offsets match the source text", () => {
    const result = listeningDraftContentSchema.safeParse({
      passages: [{
        id: "passage-1",
        text: "Olá mundo",
        blanks: [{
          id: "blank-1",
          startOffset: 4,
          endOffset: 9,
          expectedAnswer: "mundo",
        }],
      }],
    });

    expect(result.success).toBe(true);
  });

  it("rejects overlapping blanks", () => {
    const result = listeningDraftContentSchema.safeParse({
      passages: [{
        id: "passage-1",
        text: "Olá mundo",
        blanks: [
          { id: "blank-1", startOffset: 0, endOffset: 5, expectedAnswer: "Olá m" },
          { id: "blank-2", startOffset: 4, endOffset: 9, expectedAnswer: "mundo" },
        ],
      }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a ready audio without a storage key", () => {
    const result = listeningDraftContentSchema.safeParse({
      passages: [{
        id: "passage-1",
        text: "Olá mundo",
        blanks: [],
        audio: { status: "READY", storageKey: null },
      }],
    });

    expect(result.success).toBe(false);
  });
});
