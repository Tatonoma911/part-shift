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
  /** Аккорд: a tapped clue whose «Опасно» marks match its number digs the other free neighbours. */
  | { type: 'chord'; x: number; y: number }
  | { type: 'useMedkit'; x: number; y: number }
  | { type: 'build'; building: string; x: number; y: number; hero?: string }
  | { type: 'setRecruit'; building: number; on: boolean }
  /** Upgrade a completed building to the next level (buildings.json levels[]). */
  | { type: 'upgradeBuilding'; building: number }
  /** Boost a building using a hero ability (buildings.json boost). */
  | { type: 'heroBoost'; building: number }
  /** Cancel a building under construction; refunds full cost. */
  | { type: 'cancelBuild'; building: number }
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
  | { type: 'pickBoon'; id: string }
  /**
   * Answer the boss call. choice 0 = refuse (free, boss risk); choice 1 = comply (costs energy, delays boss).
   * A Контроль call from events.json (controlCall.id is an event id) takes 'a'/'b' (or 0/1) and applies that option.
   */
  | { type: 'answerCall'; choice?: 0 | 1 | 'a' | 'b'; id?: string }
  /** Call a raid now (spends callEarlyEnergy from GameState.raid). */
  | { type: 'callRaidEarly' };

/** Why a command was refused; the keys match the writer's texts (text/ru.json). */
export type RefuseReason =
  | 'build.not_enough_energy'
  | 'build.invalid_cell'
  | 'build.cell_occupied'
  | 'build.enemies_near'
  | 'build.unreachable'
  | 'chord.not_ready'
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
  | 'building.cancel.complete'
  | 'building.cancel.not_enough_energy'
  | 'raid.not_ready'
  | 'raid.not_enough_energy'
  | 'call.no_active'
  | 'call.unavailable'
  | 'cell.dig_unreachable'
  | 'assist.known_danger'
  | 'assist.no_charges'
  | 'invalid';

export type ApplyResult = { ok: true } | { ok: false; reason: RefuseReason };
