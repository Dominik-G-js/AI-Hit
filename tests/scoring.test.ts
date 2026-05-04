import { describe, expect, it } from "vitest";
import { calculateRing, getPerformanceBand, summarizeRound, TARGET_RADIUS } from "../src/game/scoring";
import type { ShotRecord } from "../src/game/types";

describe("calculateRing", () => {
  it("scores the center as ring 10", () => {
    expect(calculateRing(0)).toBe(10);
  });

  it("scores the target edge as ring 1", () => {
    expect(calculateRing(TARGET_RADIUS)).toBe(1);
  });

  it("scores outside the target as a miss", () => {
    expect(calculateRing(TARGET_RADIUS + 0.01)).toBe(0);
  });
});

describe("summarizeRound", () => {
  it("handles an empty round without NaN values", () => {
    const stats = summarizeRound("pistol", [], 0);

    expect(stats.shots).toBe(0);
    expect(stats.hits).toBe(0);
    expect(stats.accuracy).toBe(0);
    expect(stats.avgDistance).toBeNull();
    expect(stats.performanceBand).toBe("terrible");
  });

  it("summarizes mixed hits and misses", () => {
    const shots: ShotRecord[] = [
      { hit: true, distance: 0, ring: 10, score: 10, firedAtMs: 10 },
      { hit: true, distance: 0.6, ring: calculateRing(0.6), score: calculateRing(0.6), firedAtMs: 20 },
      { hit: false, distance: null, ring: 0, score: 0, firedAtMs: 30 },
    ];

    const stats = summarizeRound("assault", shots, 1450);

    expect(stats.shots).toBe(3);
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.accuracy).toBe(66.7);
    expect(stats.avgDistance).toBe(0.3);
    expect(stats.bestRing).toBe(10);
    expect(stats.score).toBe(15);
    expect(stats.durationMs).toBe(1450);
  });
});

describe("getPerformanceBand", () => {
  it("classifies elite rounds", () => {
    expect(getPerformanceBand({ accuracy: 92, avgDistance: 0.21, bestRing: 10 })).toBe("elite");
  });

  it("classifies rough rounds", () => {
    expect(getPerformanceBand({ accuracy: 42, avgDistance: 0.8, bestRing: 4 })).toBe("rough");
  });

  it("classifies terrible rounds", () => {
    expect(getPerformanceBand({ accuracy: 20, avgDistance: null, bestRing: 2 })).toBe("terrible");
  });
});
