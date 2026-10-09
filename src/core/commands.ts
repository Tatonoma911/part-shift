/**
 * Everything a player can do, as plain data. Input code and the multiplayer
 * server both go through World.apply(), so a command can be sent over the
 * network as JSON and replayed on the authoritative simulation.
 */
export type Command =
  | { type: 'placeCommand'; x: number; y: number }
  | { type: 'queueDig'; x: number; y: number }
  | { type: 'cancelDig'; x: number; y: number }
  | { type: 'toggleMark'; x: number; y: number }
  | { type: 'build'; building: string; x: number; y: number }
  | { type: 'setRecruit'; building: number; on: boolean }
  /** Target: "u:<unit id>" for an enemy, "s:<x>,<y>" for an opened nest. */
  | { type: 'attack'; target: string }
  | { type: 'cancelOrder' };

/** Why a command was refused; the keys match the writer's texts (text/ru.json). */
export type RefuseReason =
  | 'build.not_enough_energy'
  | 'build.invalid_cell'
  | 'build.cell_occupied'
  | 'build.enemies_near'
  | 'build.unreachable'
  | 'cell.dig_unreachable'
  | 'invalid';

export type ApplyResult = { ok: true } | { ok: false; reason: RefuseReason };
