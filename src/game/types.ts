export type WeaponId = "pistol" | "assault";

export type TargetMode = "ready" | "returning" | "near" | "sending";

export type PerformanceBand = "elite" | "good" | "rough" | "terrible";

export interface WeaponDefinition {
  id: WeaponId;
  label: string;
  magazineSize: number;
  fireDelayMs: number;
  automatic: boolean;
  spread: number;
  recoil: number;
  damageKick: number;
}

export interface ShotRecord {
  hit: boolean;
  distance: number | null;
  ring: number;
  score: number;
  firedAtMs: number;
}

export interface RoundStats {
  weapon: WeaponId;
  shots: number;
  hits: number;
  misses: number;
  accuracy: number;
  avgDistance: number | null;
  bestRing: number;
  score: number;
  durationMs: number;
  performanceBand: PerformanceBand;
}

export interface NpcCommentaryResponse {
  text: string;
  source: "groq" | "fallback";
  reason?: "missing_groq_api_key" | "groq_error" | "invalid_request";
}
