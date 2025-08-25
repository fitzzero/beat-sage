import type { InstanceMob } from "@prisma/client";

export type MobRow = Pick<
  InstanceMob,
  | "id"
  | "instanceId"
  | "mobId"
  | "healthCurrent"
  | "status"
  | "distance"
  | "xpPerDamage"
  | "damagePerHit"
>;

export function advanceMobs(mobs: MobRow[]): MobRow[] {
  return mobs.map((mob) => ({
    ...mob,
    distance: Math.max(0, Number(mob.distance) - 1),
  }));
}

export function applyContactDamage(
  mobs: MobRow[],
  memberIds: string[],
  getMana: (characterId: string) => {
    current: number;
    maximum: number;
    rate: number;
    maxRate: number;
    experience: number;
  },
  setMana: (
    characterId: string,
    next: {
      current: number;
      maximum: number;
      rate: number;
      maxRate: number;
      experience: number;
    }
  ) => void
): boolean {
  if (memberIds.length === 0) return false;
  let anyDamage = false;
  for (const mob of mobs) {
    if (mob.distance === 0 && mob.status === "Alive") {
      const target = memberIds[0];
      const mm = getMana(target);
      const dmg = Math.max(1, Math.floor(Number(mob.damagePerHit || 1)));
      const next = { ...mm, current: Math.max(0, mm.current - dmg) };
      setMana(target, next);
      anyDamage = true;
    }
  }
  return anyDamage;
}
