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
  | { type: 'toggleMark'; x: number; y: number }
  | { type: 'build'; building: string; x: number; y: number }
  | { type: 'setRecruit'; building: number; on: boolean }
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
  | 'cell.dig_unreachable'
  | 'assist.known_danger'
  | 'assist.no_charges'
  | 'invalid';

export type ApplyResult = { ok: true } | { ok: false; reason: RefuseReason };
