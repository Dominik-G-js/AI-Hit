import type { WeaponDefinition, WeaponId } from "./types";

export const WEAPONS: Record<WeaponId, WeaponDefinition> = {
  pistol: {
    id: "pistol",
    label: "Pistole",
    magazineSize: 12,
    fireDelayMs: 280,
    automatic: false,
    spread: 0.006,
    recoil: 0.025,
    damageKick: 1,
  },
  assault: {
    id: "assault",
    label: "Assault rifle",
    magazineSize: 30,
    fireDelayMs: 82,
    automatic: true,
    spread: 0.015,
    recoil: 0.014,
    damageKick: 0.62,
  },
};

export function getWeapon(id: WeaponId): WeaponDefinition {
  return WEAPONS[id];
}
