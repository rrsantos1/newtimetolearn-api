import { describe, expect, it } from "vitest";
import { wordMatchingContentSchema } from "../../src/modules/activities/schemas/content/wordMatchingContentSchema";
import { sentenceCompletionContentSchema } from "../../src/modules/activities/schemas/content/sentenceCompletionContentSchema";

describe("drag-drop activity content schemas", () => {
  it("accepts unique word-matching pairs", () => {
    const parsed = wordMatchingContentSchema.safeParse({
      pairs: [
        { id: "pair-1", source: { type: "text", value: "Brasil" }, target: { type: "text", value: "Brasília" } },
        { id: "pair-2", source: { type: "text", value: "França" }, target: { type: "text", value: "Paris" } },
        { id: "pair-3", source: { type: "text", value: "Japão" }, target: { type: "text", value: "Tóquio" } },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects duplicate sources in word matching", () => {
    const parsed = wordMatchingContentSchema.safeParse({
      pairs: [
        { id: "pair-1", source: { type: "text", value: "Brasil" }, target: { type: "text", value: "Brasília" } },
        { id: "pair-2", source: { type: "text", value: "Brasil" }, target: { type: "text", value: "Rio de Janeiro" } },
        { id: "pair-3", source: { type: "text", value: "Japão" }, target: { type: "text", value: "Tóquio" } },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts sentence completion with unique expected words", () => {
    const parsed = sentenceCompletionContentSchema.safeParse({
      words: [
        { id: "word-1", text: "Sol" },
        { id: "word-2", text: "sistema solar" },
        { id: "word-3", text: "Lua" },
      ],
      sentences: [
        { id: "sentence-1", text: "O {{blank-1}} é uma estrela.", blanks: [{ id: "blank-1", expectedWordId: "word-1" }] },
        { id: "sentence-2", text: "A Terra faz parte do {{blank-2}}.", blanks: [{ id: "blank-2", expectedWordId: "word-2" }] },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a blank that points to a missing word", () => {
    const parsed = sentenceCompletionContentSchema.safeParse({
      words: [{ id: "word-1", text: "Sol" }],
      sentences: [
        { id: "sentence-1", text: "O {{blank-1}} brilha.", blanks: [{ id: "blank-1", expectedWordId: "missing-word" }] },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects using the same correct word in multiple blanks", () => {
    const parsed = sentenceCompletionContentSchema.safeParse({
      words: [{ id: "word-1", text: "Sol" }],
      sentences: [
        { id: "sentence-1", text: "O {{blank-1}} e o {{blank-2}}.", blanks: [
          { id: "blank-1", expectedWordId: "word-1" },
          { id: "blank-2", expectedWordId: "word-1" },
        ] },
      ],
    });
    expect(parsed.success).toBe(false);
  });
  it("accepts word-matching pairs with text and image items", () => {
    const parsed = wordMatchingContentSchema.safeParse({
      pairs: [
        { id: "pair-1", source: { type: "text", value: "Cachorro" }, target: { type: "image", storageKey: "media/dog.jpg", altText: "Cachorro" } },
        { id: "pair-2", source: { type: "image", storageKey: "media/cat.jpg" }, target: { type: "text", value: "Gato" } },
        { id: "pair-3", source: { type: "text", value: "Pássaro" }, target: { type: "text", value: "Ave" } },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects word-matching activities with fewer than three pairs", () => {
    const parsed = wordMatchingContentSchema.safeParse({
      pairs: [
        { id: "pair-1", source: { type: "text", value: "Brasil" }, target: { type: "text", value: "Brasília" } },
        { id: "pair-2", source: { type: "text", value: "França" }, target: { type: "text", value: "Paris" } },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects duplicate pair identifiers", () => {
    const parsed = wordMatchingContentSchema.safeParse({
      pairs: [
        { id: "pair-1", source: { type: "text", value: "Brasil" }, target: { type: "text", value: "Brasília" } },
        { id: "pair-1", source: { type: "text", value: "França" }, target: { type: "text", value: "Paris" } },
        { id: "pair-3", source: { type: "text", value: "Japão" }, target: { type: "text", value: "Tóquio" } },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects duplicate sentence and blank identifiers", () => {
    const parsed = sentenceCompletionContentSchema.safeParse({
      words: [{ id: "word-1", text: "Sol" }, { id: "word-2", text: "Lua" }],
      sentences: [
        { id: "sentence-1", text: "O {{blank-1}} brilha.", blanks: [{ id: "blank-1", expectedWordId: "word-1" }] },
        { id: "sentence-1", text: "A {{blank-1}} aparece.", blanks: [{ id: "blank-1", expectedWordId: "word-2" }] },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects sentence text with a missing or unexpected blank marker", () => {
    const parsed = sentenceCompletionContentSchema.safeParse({
      words: [{ id: "word-1", text: "Sol" }],
      sentences: [
        { id: "sentence-1", text: "O Sol brilha em {{blank-2}}.", blanks: [{ id: "blank-1", expectedWordId: "word-1" }] },
      ],
    });
    expect(parsed.success).toBe(false);
  });

});
