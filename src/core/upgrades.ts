/**
 * Building upgrade rules (design/data/buildings.json `upgrades`). The core command and the building card
 * both read them from here, so the price the card shows is the price the world charges.
 */
import buildingsJson from '../data/design/buildings.json';

type LevelRule = { cost?: number; seconds?: number };
type UpgradeRules = {
  maxLevel: number;
  defaultCostFactorByLevel: Record<string, number>;
  defaultSecondsFactorByLevel: Record<string, number>;
  perBuilding: Record<string, { maxLevel?: number; levels?: Record<string, LevelRule> }>;
};

const UP = (buildingsJson as unknown as { upgrades: UpgradeRules }).upgrades;

/** Highest level a building type reaches (command centre has its own cap). */
export function maxLevelOf(type: string): number {
  return UP.perBuilding[type]?.maxLevel ?? UP.maxLevel;
}

/** Price of going to `level` (2 or 3) from a base price (the building's cost, or a station's tier price). */
export function upgradeCost(type: string, level: number, base: number): { cost: number; seconds: number } {
  const rule = UP.perBuilding[type]?.levels?.[String(level)];
  return {
    cost: rule?.cost ?? Math.round(base * (UP.defaultCostFactorByLevel[String(level)] ?? 1)),
    seconds: rule?.seconds ?? 0,
  };
}
