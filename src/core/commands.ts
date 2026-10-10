/**
 * Everything a player can do, as plain data. Input code and the multiplayer
 * server both go through World.apply(), so a command can be sent over the
 * network as JSON and replayed on the authoritative simulation.
 */
export type Command =
  | { type: 'placeCommand'; x: number; y: number }
  /** force: the player confirmed digging a cell the scanner knows is dangerous. */
  | { type: 'queueDig'; x: number; y: number; force?: boolean }
  | { type: 'cancelDig'; x: number; y: number }
  | { type: 'toggleMark'; x: number; y: number; clear?: boolean }
  | { type: 'build'; building: string; x: number; y: number; hero?: string }
  | { type: 'setRecruit'; building: number; on: boolean }
  /** Upgrade a completed building to the next level (buildings.json levels[]). */
  | { type: 'upgradeBuilding'; building: number }
  /** Boost: temporarily accelerate a building's effect (buildings.json boost). */
  | { type: 'boostBuilding'; building: number }
  /** Demolish: remove the building, refund demolishRefund fraction of energy spent. */
  | { type: 'demolish'; building: number }
  /** Rebuild ruined building on its ruin for half price. */
  | { type: 'rebuild'; building: number }
  /** Target: "u:<unit id>" for an enemy, "s:<x>,<y>" for an opened nest. */
  | { type: 'attack'; target: string }
  | { type: 'cancelOrder' }
  /** Spend a scanner charge (assist mode "scanner"). */
  | { type: 'scan' }
  /** Take one card of the open cache offer (boons.json). */
  | { type: 'pickBoon'; id: string };

/** Why a command was refused; the keys match the writer's texts (text/ru.json). */
export type RefuseReason =
  | 'build.not_enough_energy'
  | 'build.invalid_cell'
  | 'build.cell_occupied'
  | 'build.enemies_near'
  | 'build.unreachable'
  | 'building.upgrade.max_level'
  | 'building.upgrade.not_complete'
  | 'building.upgrade.not_enough_energy'
  | 'building.upgrade.enemies_near'
  | 'building.boost.on_cooldown'
  | 'building.boost.not_enough_energy'
  | 'building.demolish.forbidden'
  | 'building.demolish.not_enough_energy'
  | 'building.rebuild.not_ruined'
  | 'building.rebuild.not_enough_energy'
  | 'cell.dig_unreachable'
  | 'assist.known_danger'
  | 'assist.no_charges'
  | 'invalid';

export type ApplyResult = { ok: true } | { ok: false; reason: RefuseReason };
