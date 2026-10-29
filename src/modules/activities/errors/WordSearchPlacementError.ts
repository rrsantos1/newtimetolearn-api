export class WordSearchPlacementError extends Error {
  constructor() {
    super(
      "Não foi possível posicionar todas as palavras em uma grade de até 20x20. Tente reduzir a quantidade de palavras ou utilizar palavras mais curtas.",
    );

    this.name = "WordSearchPlacementError";
  }
}