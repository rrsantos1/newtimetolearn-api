import { describe, expect, it } from "vitest";

import { wordSearchContentSchema } from "../../src/modules/activities/schemas/content/wordSearchContent.schema";

describe("wordSearchContentSchema", () => {
  it("deve aceitar palavras válidas em português", () => {
    const result = wordSearchContentSchema.safeParse({
      words: ["Árvore", "Guarda-chuva", "Pôr do sol"],
    });

    expect(result.success).toBe(true);
  });

  it("deve rejeitar palavras com números", () => {
    const result = wordSearchContentSchema.safeParse({
      words: ["Casa1", "Árvore", "Coração"],
    });

    expect(result.success).toBe(false);
  });

  it("deve rejeitar palavras com pontuação", () => {
    const result = wordSearchContentSchema.safeParse({
      words: ["Casa!", "Árvore", "Coração"],
    });

    expect(result.success).toBe(false);
  });

  it("deve rejeitar palavras com menos de duas letras normalizadas", () => {
    const result = wordSearchContentSchema.safeParse({
      words: ["A", "Árvore", "Coração"],
    });

    expect(result.success).toBe(false);
  });

  it("deve rejeitar palavras duplicadas após normalização", () => {
    const result = wordSearchContentSchema.safeParse({
      words: ["Árvore", "ARVORE", "Coração"],
    });

    expect(result.success).toBe(false);
  });

  it("deve rejeitar menos de três palavras", () => {
    const result = wordSearchContentSchema.safeParse({
      words: ["Árvore", "Coração"],
    });

    expect(result.success).toBe(false);
  });

  it("deve rejeitar mais de trinta palavras", () => {
    const result = wordSearchContentSchema.safeParse({
      words: Array.from({ length: 31 }, (_, index) => `Palavra${index}X`),
    });

    expect(result.success).toBe(false);
  });

  it("deve rejeitar palavras com mais de cinquenta caracteres", () => {
    const result = wordSearchContentSchema.safeParse({
      words: ["A".repeat(51), "Árvore", "Coração"],
    });

    expect(result.success).toBe(false);
  });
});