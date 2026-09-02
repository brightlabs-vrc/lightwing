import { describe, expect, test } from "vitest";
import { computeElo } from "./events";

describe("computeElo", () => {
  test("equal Elo ratings results in symmetric gain/loss with K=32", () => {
    const winnerElo = 1200;
    const loserElo = 1200;
    const result = computeElo(winnerElo, loserElo);

    // Expected winner probability = 1 / (1 + 10^0) = 0.5
    // Winner gain = Math.round(32 * (1 - 0.5)) = +16 -> 1216
    // Loser loss = Math.round(32 * (0 - 0.5)) = -16 -> 1184
    expect(result.winnerElo).toBe(1216);
    expect(result.loserElo).toBe(1184);
  });

  test("higher rated winner gains fewer points", () => {
    const winnerElo = 1600;
    const loserElo = 1200;
    const result = computeElo(winnerElo, loserElo);

    // expectedWinner = 1 / (1 + 10^(-400/400)) = 1 / (1 + 0.1) ~ 0.90909
    // winner Elo gain = Math.round(32 * (1 - 0.90909)) = Math.round(2.909) = +3 -> 1603
    // loser Elo change = Math.round(32 * (0 - 0.09091)) = Math.round(-2.909) = -3 -> 1197
    expect(result.winnerElo).toBe(1603);
    expect(result.loserElo).toBe(1197);
    expect(result.winnerElo - winnerElo).toBeLessThan(16);
  });

  test("underdog winner gains significantly more points", () => {
    const winnerElo = 1200;
    const loserElo = 1600;
    const result = computeElo(winnerElo, loserElo);

    // expectedWinner = 1 / (1 + 10^(400/400)) = 1 / (1 + 10) = 1/11 ~ 0.090909
    // winner Elo gain = Math.round(32 * (1 - 0.090909)) = Math.round(29.09) = +29 -> 1229
    // loser Elo loss = Math.round(32 * (0 - 0.909091)) = Math.round(-29.09) = -29 -> 1571
    expect(result.winnerElo).toBe(1229);
    expect(result.loserElo).toBe(1571);
    expect(result.winnerElo - winnerElo).toBeGreaterThan(16);
  });

  test("extreme rating gap gives maximum point shift up to K factor", () => {
    const winnerElo = 800;
    const loserElo = 2800;
    const result = computeElo(winnerElo, loserElo);

    // expectedWinner is practically 0
    // Winner gets full +32, Loser loses -32
    expect(result.winnerElo).toBe(832);
    expect(result.loserElo).toBe(2768);
  });

  test("extreme favorite winning yields 0 rating change due to rounding", () => {
    const winnerElo = 2800;
    const loserElo = 800;
    const result = computeElo(winnerElo, loserElo);

    // expectedWinner is practically 1
    // Winner gain = Math.round(32 * ~0) = 0
    // Loser loss = Math.round(32 * ~0) = 0
    expect(result.winnerElo).toBe(2800);
    expect(result.loserElo).toBe(800);
  });
});
