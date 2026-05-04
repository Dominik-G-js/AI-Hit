import type { PerformanceBand, RoundStats, ShotRecord, WeaponId } from "./types";

export const TARGET_RADIUS = 1.2;

export function calculateRing(distance: number, targetRadius = TARGET_RADIUS): number {
  if (!Number.isFinite(distance) || distance < 0 || distance > targetRadius) {
    return 0;
  }

  if (distance === targetRadius) {
    return 1;
  }

  const normalizedDistance = Math.min(distance / targetRadius, 1);
  return Math.max(1, Math.ceil((1 - normalizedDistance) * 10));
}

export function getPerformanceBand(stats: Pick<RoundStats, "accuracy" | "avgDistance" | "bestRing">): PerformanceBand {
  const distance = stats.avgDistance ?? TARGET_RADIUS;

  if (stats.accuracy >= 88 && distance <= 0.32 && stats.bestRing >= 9) {
    return "elite";
  }

  if (stats.accuracy >= 68 && stats.bestRing >= 7) {
    return "good";
  }

  if (stats.accuracy >= 38) {
    return "rough";
  }

  return "terrible";
}

export function summarizeRound(weapon: WeaponId, shots: ShotRecord[], durationMs: number): RoundStats {
  const totalShots = shots.length;
  const hits = shots.filter((shot) => shot.hit).length;
  const hitDistances = shots
    .filter((shot) => shot.hit && shot.distance !== null)
    .map((shot) => shot.distance as number);

  const accuracy = totalShots === 0 ? 0 : Math.round((hits / totalShots) * 1000) / 10;
  const avgDistance =
    hitDistances.length === 0
      ? null
      : Math.round((hitDistances.reduce((sum, distance) => sum + distance, 0) / hitDistances.length) * 1000) / 1000;

  const stats: RoundStats = {
    weapon,
    shots: totalShots,
    hits,
    misses: totalShots - hits,
    accuracy,
    avgDistance,
    bestRing: shots.reduce((best, shot) => Math.max(best, shot.ring), 0),
    score: shots.reduce((score, shot) => score + shot.score, 0),
    durationMs: Math.max(0, Math.round(durationMs)),
    performanceBand: "terrible",
  };

  stats.performanceBand = getPerformanceBand(stats);
  return stats;
}

export function buildLocalCommentary(stats: RoundStats): string {
  switch (stats.performanceBand) {
    case "elite":
      return `Kurva, ${stats.accuracy}% přesnost a kruh ${stats.bestRing}. Výborně, ale nečum na sebe jak legenda, ještě pořád jsi jen střelec s egem.`;
    case "good":
      return `${stats.accuracy}% přesnost. Slušné, ale ty ulítlé rány byly debilní výmluva za disciplínu, ne střelba.`;
    case "rough":
      return `${stats.accuracy}% přesnost. Něco trefuješ, zbytek je bordel. Dej ruce dohromady, protože tohle je střelecký průser s pár světlými momenty.`;
    case "terrible":
      return `${stats.accuracy}% přesnost. Doprdele, terč stojí před tebou a ty to kropíš jako panika. Zpomal, dýchej a přestaň to takhle posírat.`;
  }
}
