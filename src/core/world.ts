/**
 * One match of «Срочный вызов» for 1–4 players (design/MVP_RULES.md v0.4).
 * Pure and deterministic: the renderer (or the multiplayer server) calls
 * tick() with real time, World advances in fixed steps and emits events
 * named after the sound list (audio/sounds.json).
 *
 * v0.4 rules: residents appear on a timer and both dig and fight (no separate
 * defenders), reactors make energy by themselves, schools train everyone,
 * every map has three maddened hero lairs and the call target in the boss
 * hatch, damage follows the five elements (design/ELEMENTS.md).
 */
import { deduce, type Knowledge } from './assist';
import type { ApplyResult, Command } from './commands';
import {
  buildings as buildingDefs,
  config,
  DEFAULT_DIFFICULTY,
  difficulties,
  elements,
  enemies as enemyDefs,
  heroes as heroDefs,
  heroRules,
  mapgen,
  partTier,
  parts as partDefs,
  residentStats,
  RESIDENT_SLOTS,
  sites as siteDefs,
  type AttackTech,
  type EnemyDef,
  type HeroDef,
  type SiteDef,
  type SlotId,
  type Tech,
  type UnitStats,
  buildingDamage,
  raidRules,
  boonRules,
  boons as boonDefs,
  armorPlateDef,
  hazards,
} from './data';
import { cellAt, cellKey, cheb, dist, inBounds, neighbors, parseKey, walkableForEnemy, walkableForPlayer } from './grid';
import { generateField } from './mapgen';
import { solvable } from './noguess';
import { findPath } from './pathfind';
import { rand, randIntOf } from './rng';
import type { AssistMode, Building, Cell, ClueChannel, GameState, PartInstance, Player, RuleOverrides, SiteState, Task, Unit, UnitKind } from './state';

export const STEP = 0.05;

/** How long a capsule peek shows the sensors (buildings.json watchtower.peek.showSeconds). */
const CAPSULE_PEEK_SECONDS = 20;

export type GameEvent = { type: string; x?: number; y?: number; amount?: number; owner?: number; text?: string; unit?: number; fork?: number; wave?: boolean;
  /** Damage-numbers UI (ДИ patch ui/code/damage-numbers/): */
  tech?: string; mult?: number; victim?: number; kind?: 'weak' | 'neutral' | 'resist' | 'super' | 'reaction' | 'mine' | 'status'; dot?: boolean;
};

export interface WorldOptions {
  seed: number;
  rules?: RuleOverrides;
  assist?: AssistMode;
  players?: number;
  width?: number;
  height?: number;
  /** Call target (heroes.json id); random from bossPool when omitted. */
  boss?: string;
  /** difficulty.json level; the designer's default when omitted. */
  difficulty?: string;
}

const CHANNEL_OF: Partial<Record<Cell['content'], ClueChannel>> = {
  nest: 'threat',
  heavy_nest: 'threat',
  hero_lair: 'threat',
  boss_hatch: 'demon',
  cache: 'finds',
  survivor: 'finds',
  blueprint: 'finds',
  armor_crate: 'finds',
  lore_record: 'finds',
  mine: 'threat',
  bonus_capsule: 'finds',
  medkit: 'finds',
};

/**
 * Hero abilities. heroes.json describes them in words only, so the numbers
 * from those descriptions live here until the designer moves them into the table.
 */
export const HERO_ABILITY: Record<string, { every: number; range: number; amount?: number; seconds?: number; count?: number }> = {
  serial_copies: { every: Infinity, range: 0, count: 3 },
  orb_thief: { every: 0.25, range: 1, amount: 5 },
  overgrowth: { every: 10, range: 3, count: 3, seconds: 8, amount: 40 },
  water_jet: { every: 6, range: 3, amount: 4 },
  cable_pull: { every: 7, range: 4, seconds: 1 },
  cryo_kick: { every: 6, range: 2, amount: 15, count: 2 },
  barricade: { every: 12, range: 4, amount: 10 },
  steam_clean: { every: 8, range: 2, amount: 6, seconds: 3 },
  alarm_flare: { every: 15, range: 6, seconds: 10 },
  drone_swarm: { every: 6, range: 3, count: 4 },
  ram_charge: { every: 8, range: 3, amount: 30 },
  halo_heal: { every: 2, range: 3, amount: 8 },
  splice_inject: { every: 10, range: 4, amount: 0.5 },
  steam_blast: { every: 6, range: 3.25, seconds: 3.2, amount: 4, count: 0.9 },
  neuro_override: { every: 15, range: 4, seconds: 6 },
};

const isSiteCell = (c: Cell) => c.content === 'nest' || c.content === 'heavy_nest' || c.content === 'hero_lair' || c.content === 'boss_hatch';
const isEnemy = (u: Unit) => u.owner < 0;
/** Allies are heroes at a fraction of their enemy strength; down, they return to the center after a while. */
const ALLY = heroRules.allyRules;
/** difficulty.json noGuess.maxAttempts; after that the board is accepted as is. */
const NO_GUESS_ATTEMPTS = 200;
const siteKey = (x: number, y: number) => `s:${x},${y}`;

/** config.json with the difficulty level and a match's dotted-path overrides applied. */
export function effectiveConfig(rules?: RuleOverrides, difficulty = DEFAULT_DIFFICULTY): typeof config {
  const out = structuredClone(config);
  const d = difficulties[difficulty] ?? difficulties[DEFAULT_DIFFICULTY];
  out.threat.secondsPerLevel = d.threatSecondsPerLevel;
  out.economy.startEnergy = d.startEnergy;
  out.boss.selfWakeSeconds = d.bossSelfWakeSeconds;
  for (const [path, value] of Object.entries(rules?.config ?? {})) {
    const keys = path.split('.');
    let node = out as unknown as Record<string, unknown>;
    for (const k of keys.slice(0, -1)) node = (node[k] ??= {}) as Record<string, unknown>;
    node[keys[keys.length - 1]] = value;
  }
  return out;
}

export function createState(opts: WorldOptions): GameState {
  const difficulty = difficulties[opts.difficulty ?? ''] ? opts.difficulty! : DEFAULT_DIFFICULTY;
  const config = effectiveConfig(opts.rules, difficulty);
  const players = opts.players ?? 1;
  const width = opts.width ?? config.board.width;
  const height = opts.height ?? config.board.height;
  const cells: Cell[] = [];
  for (let i = 0; i < width * height; i++) cells.push({ content: 'ground', revealed: false, resolved: false });
  const s: GameState = {
    version: 2,
    seed: opts.seed,
    rng: opts.seed >>> 0,
    time: 0,
    width,
    height,
    cells,
    generated: false,
    players: Array.from({ length: players }, (_, id) => ({
      id,
      energy: config.economy.startEnergy,
      alive: true,
      command: null,
      queue: [],
      autoQueue: [],
      order: null,
      spawnTimer: config.population.spawnSeconds,
      capBonus: 0,
      stats: { nests: 0, caches: 0, heroes: [], energy: 0, lost: 0, parts: 0, blueprints: 0, loreRecords: 0 },
      assist: {
        mode: opts.assist ?? 'full',
        charges: config.assist.scanner.maxCharges,
        recharge: config.assist.scanner.rechargeSeconds,
        scanLeft: 0,
      },
    })),
    units: [],
    buildings: [],
    sites: [],
    orbs: [],
    nextId: 1,
    boss: { hero: '', awake: false, warned: false, dead: false, hpScale: (1 + (players - 1) * 0.6) * difficulties[difficulty].callTargetHpFactor },
    outcome: 'playing',
    difficulty,
    rules: opts.rules,
  };
  const pool = heroRules.bossPool.heroes;
  s.boss.hero = opts.boss ?? pool[randIntOf(s, pool.length)];
  return s;
}

export class World {
  readonly s: GameState;
  private acc = 0;
  private events: GameEvent[] = [];
  /** Bumped whenever the opened field changes; the scanner result is cached per revision. */
  protected rev = 0;
  private known: { rev: number; map: Map<string, Knowledge> } | null = null;
  /** Game time of the last hit anyone landed (idle-nest hint). */
  private lastCombat = 0;
  private lastIdleHint = -Infinity;

  /** Rule tables for this match (design tables plus any overrides). */
  readonly cfg: typeof config;

  constructor(opts: WorldOptions | { state: GameState }) {
    this.s = 'state' in opts ? opts.state : createState(opts);
    this.s.difficulty ??= DEFAULT_DIFFICULTY;
    this.cfg = effectiveConfig(this.s.rules, this.s.difficulty);
  }

  get difficulty() {
    return difficulties[this.s.difficulty] ?? difficulties[DEFAULT_DIFFICULTY];
  }

  private get rules(): RuleOverrides {
    return this.s.rules ?? {};
  }

  private siteDef(kind: string): SiteDef {
    const base = siteDefs[kind];
    return kind === 'nest' && this.rules.nest ? { ...base, ...this.rules.nest } : base;
  }

  private enemyDef(kind: string): EnemyDef {
    const base = enemyDefs[kind];
    const a = this.rules.adaptant;
    if (kind !== 'adaptant' || !a) return base;
    const slotWeights = a.partSlot ? { arm: a.partSlot === 'arm' ? 1 : 0, leg: a.partSlot === 'leg' ? 1 : 0 } : base.part.slotWeights;
    return { ...base, partDropChance: a.partDropChance ?? base.partDropChance, part: { ...base.part, slotWeights } };
  }

  // ---------------------------------------------------------------- queries

  /** FFA "Последний центр": rival players fight each other (MVP_RULES §14.1). */
  get ffa(): boolean {
    return this.s.match?.mode === 'ffa';
  }

  /** Do units of these owners fight? Adaptants and the Demon (-1) fight everyone; players only in FFA. */
  hostile(a: number, b: number): boolean {
    if (a === b) return false;
    return a < 0 || b < 0 || this.ffa;
  }

  /** Owner of an attack target ("u:", "b:"; sites belong to the field, -1). */
  targetOwner(t: string): number {
    if (t.startsWith('u:')) return this.unit(Number(t.slice(2)))?.owner ?? -1;
    if (t.startsWith('b:')) return this.building(Number(t.slice(2)))?.owner ?? -1;
    return -1;
  }

  get started(): boolean {
    return this.s.players.some((p) => p.command !== null);
  }

  get threatLevel(): number {
    if (this.rules.threatEnabled === false) return 0;
    return Math.floor(this.s.time / this.cfg.threat.secondsPerLevel);
  }

  /** 0..1 progress toward the next threat level (the big arc timer). */
  get threatProgress(): number {
    return (this.s.time % this.cfg.threat.secondsPerLevel) / this.cfg.threat.secondsPerLevel;
  }

  /** The call target (heroes.json). */
  get bossHero(): HeroDef {
    return heroDefs[this.s.boss.hero];
  }

  cell(x: number, y: number): Cell {
    return cellAt(this.s, x, y);
  }

  player(id: number): Player {
    return this.s.players[id];
  }

  building(id: number | null | undefined): Building | undefined {
    return id == null ? undefined : this.s.buildings.find((b) => b.id === id);
  }

  unit(id: number | null | undefined): Unit | undefined {
    return id == null ? undefined : this.s.units.find((u) => u.id === id);
  }

  site(x: number, y: number): SiteState | undefined {
    return this.s.sites.find((t) => t.x === x && t.y === y);
  }

  /** Unresolved sites around a cell, per clue channel (8 neighbors). */
  clues(x: number, y: number): Record<ClueChannel, number> {
    const out = { threat: 0, demon: 0, finds: 0 };
    for (const n of neighbors(this.s, x, y)) {
      const ch = CHANNEL_OF[n.cell.content];
      if (ch && !n.cell.resolved) out[ch]++;
    }
    return out;
  }

  /** Everything the scanner can prove about covered cells right now. */
  knowledge(): Map<string, Knowledge> {
    if (!this.known || this.known.rev !== this.rev) this.known = { rev: this.rev, map: deduce(this.s) };
    return this.known.map;
  }

  /** What this player's helper currently shows (empty when off or between scans). */
  visibleKnowledge(playerId: number): Map<string, Knowledge> {
    const a = this.player(playerId).assist;
    if (a.mode === 'off' || (a.mode === 'scanner' && a.scanLeft <= 0)) return new Map();
    return this.knowledge();
  }

  isFrontier(x: number, y: number): boolean {
    return !this.cell(x, y).revealed && neighbors(this.s, x, y).some((n) => walkableForPlayer(this.s, n.x, n.y));
  }

  isQueued(playerId: number, x: number, y: number): boolean {
    const k = cellKey(x, y);
    const p = this.player(playerId);
    return p.queue.includes(k) || p.autoQueue.includes(k);
  }

  /** Cells where this player may build (own territory, not claimed by a rival). */
  inTerritory(playerId: number, x: number, y: number): boolean {
    const owns = (pid: number) =>
      this.s.buildings.some((b) => {
        if (b.owner !== pid || !b.complete) return false;
        const r = buildingDefs[b.type].territoryRadius ?? 0;
        return r > 0 && cheb(b.x, b.y, x, y) <= r;
      });
    if (!owns(playerId)) return false;
    return !this.s.players.some((p) => p.id !== playerId && p.alive && owns(p.id));
  }

  /** Residents a player may have at once (config.population.cap + survivors). */
  residentCap(playerId: number): number {
    return this.cfg.population.cap + this.player(playerId).capBonus;
  }

  /** School training level of a player's residents, 0..trainingLevelsMax. */
  trainingLevel(playerId: number): number {
    const lv = this.s.buildings
      .filter((b) => b.owner === playerId && b.complete)
      .reduce((n, b) => n + (buildingDefs[b.type].trainingLevel ?? 0), this.s.players[playerId]?.boons?.field_training ?? 0);
    return Math.min(this.cfg.school.trainingLevelsMax, lv);
  }

  /** Max HP of an enemy (or anyone): stats including parts. */
  maxHp(u: Unit): number {
    return this.stats(u).hp;
  }

  /** Stats including parts (and threat scaling baked into enemies at spawn). */
  stats(u: Unit): UnitStats {
    const out = { ...this.baseStats(u) };
    let haste = 1;
    for (const p of Object.values(u.parts)) {
      if (!p) continue;
      const t = partTier(p.id, p.tier);
      out.damage += t.damage ?? 0;
      out.defense += t.defense ?? 0;
      out.hp += t.hp ?? 0;
      out.speed += t.speed ?? 0;
      if (t.attackSpeedFactor) haste *= t.attackSpeedFactor;
    }
    out.attackSeconds /= haste;
    if (u.slow) out.speed *= 1 - u.slow.percent / 100;
    if (!isEnemy(u) && this.overgrownAt(u)) out.speed *= 1 - (HERO_ABILITY.overgrowth.amount ?? 40) / 100;
    if (u.poison) out.defense = Math.max(0, out.defense - u.poison.defense);
    if (u.bare) out.defense = 0;
    return out;
  }

  /** The element a unit hits this target with (residents and allies pick their best arm, ELEMENTS.md §2). */
  attackOf(u: Unit, target?: Unit): { tech: AttackTech; tier: number } {
    if (u.kind === 'resident' || u.kind === 'ally') {
      let best: { tech: AttackTech; tier: number } = { tech: 'kinetic', tier: 0 };
      let bestMul = target ? this.resistOf(target, 'kinetic') : 1;
      for (const slot of ['arm_right', 'arm_left'] as SlotId[]) {
        const p = u.parts[slot];
        if (!p) continue;
        const tech = partDefs[p.id].tech as AttackTech;
        if (!isTech(tech)) continue;
        const mul = target ? this.resistOf(target, tech) : 1;
        if (mul > bestMul || (mul === bestMul && best.tech === 'kinetic')) [best, bestMul] = [{ tech, tier: p.tier }, mul];
      }
      return best;
    }
    if (u.kind === 'hero') {
      const h = heroDefs[u.hero!];
      return { tech: h.enemy.attackTech, tier: Math.min(3, h.tier) };
    }
    const tier = Object.values(u.parts)[0]?.tier ?? 1;
    return { tech: u.attackTech ?? 'kinetic', tier };
  }

  /** Speed multiplier for digging a cell with this element (§3.4). Picks the best arm tech. */
  private digSpeedOf(u: Unit, cellElement: Tech | undefined): number {
    if (!cellElement) return u.kind === 'resident' ? 0.75 : 1.0;
    const cellWeakTo = ((this.cfg.dig.cellDurability as unknown) as { cellWeakTo?: Record<string, string[]> }).cellWeakTo ?? {};
    const weaknesses: string[] = cellWeakTo[cellElement] ?? [];
    let best = 0.75; // bare hand
    for (const slot of ['arm_right', 'arm_left'] as SlotId[]) {
      const p = u.parts[slot];
      if (!p) continue;
      const tech = partDefs[p.id].tech as AttackTech;
      if (!isTech(tech)) continue;
      const mul = weaknesses.includes(tech) ? 1.6 : tech === cellElement ? 0.35 : 1.0;
      if (mul > best) best = mul;
    }
    return best;
  }

  /** Damage multiplier for this element against this unit (resist tables, parts resist their own tech). */
  resistOf(v: Unit, tech: AttackTech): number {
    if (!isTech(tech)) return 1;
    if (v.kind === 'hero') return heroDefs[v.hero!].enemy.resist[tech] ?? 1;
    if (v.kind === 'adaptant') return enemyDefs.adaptant.resistByTech?.[v.tech ?? 'thermo']?.[tech] ?? 1;
    if (v.kind === 'heavy_adaptant') return enemyDefs.heavy_adaptant.resist?.[tech] ?? 1;
    let mul = 1;
    const pr = elements.partResist;
    for (const p of Object.values(v.parts)) if (p && partDefs[p.id].tech === tech) mul *= 1 - pr.perTier * p.tier;
    return Math.max(pr.floor, mul);
  }

  drainEvents(): GameEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  /** Events that happened elsewhere (the online client gets them from the server). */
  pushEvents(list: GameEvent[]): void {
    this.events.push(...list);
  }

  /** A player left an online match for good: their center falls (MVP_RULES §14.2). */
  forfeit(playerId: number): void {
    const p = this.s.players[playerId];
    const b = this.building(p?.command);
    if (b) b.hp = 0;
  }

  // --------------------------------------------------------------- commands

  apply(cmd: Command, playerId = 0): ApplyResult {
    const ok: ApplyResult = { ok: true };
    const bad = (reason: Extract<ApplyResult, { ok: false }>['reason'] = 'invalid'): ApplyResult => ({ ok: false, reason });
    const s = this.s;
    const p = s.players[playerId];
    if (!p || s.outcome !== 'playing') return bad();
    if (cmd.type === 'placeCommand') {
      if (p.command !== null || !inBounds(s, cmd.x, cmd.y)) return bad();
      const fixed = this.rules.commandFixed;
      if (fixed && (fixed.x !== cmd.x || fixed.y !== cmd.y)) return bad();
      this.placeRelativeSites(cmd.x, cmd.y);
      this.placeCommands([{ player: playerId, x: cmd.x, y: cmd.y }]);
      this.emit('command_placed', { x: cmd.x, y: cmd.y, owner: playerId });
      this.allyStart(p);
      return ok;
    }
    if (!p.alive || p.command === null) return bad();
    switch (cmd.type) {
      case 'queueDig': {
        if (!inBounds(s, cmd.x, cmd.y)) return bad();
        const c = this.cell(cmd.x, cmd.y);
        const k = cellKey(cmd.x, cmd.y);
        const harvestable = c.revealed && (c.content === 'rubble' || c.content === 'energy_vein') && (c.stock ?? 0) > 0;
        // A forced dig on an «Опасно» mark goes in carefully: a mine there gets defused (MVP_RULES §5.2).
        if (c.marked && cmd.force && !c.revealed && !p.queue.includes(k)) {
          c.defuse = c.markKind === 'danger';
          c.marked = false;
          c.markKind = undefined;
        }
        if ((c.revealed && !harvestable) || c.marked || p.queue.includes(k)) return bad();
        const known = this.visibleKnowledge(playerId).get(k);
        if (this.cfg.assist.blockSwipeOnKnownDanger && !cmd.force && (known === 'threat' || known === 'demon')) {
          return bad('assist.known_danger');
        }
        p.autoQueue = p.autoQueue.filter((q) => q !== k);
        p.queue.push(k);
        if (cmd.force && known) c.deliberate = true;
        return ok;
      }
      case 'cancelDig': {
        const k = cellKey(cmd.x, cmd.y);
        if (!this.isQueued(playerId, cmd.x, cmd.y)) return bad();
        p.queue = p.queue.filter((q) => q !== k);
        p.autoQueue = p.autoQueue.filter((q) => q !== k);
        return ok;
      }
      case 'toggleMark': {
        if (!inBounds(s, cmd.x, cmd.y)) return bad();
        const c = this.cell(cmd.x, cmd.y);
        if (c.revealed) return bad();
        // Long press cycles: none → «Опасно» → «Не уверен» → none (MVP_RULES §3.1а).
        if (cmd.clear || c.markKind === 'unsure') {
          c.marked = false;
          c.markKind = undefined;
        } else {
          c.marked = true;
          c.markKind = c.markKind === 'danger' ? 'unsure' : 'danger';
        }
        if (c.marked) {
          const k = cellKey(cmd.x, cmd.y);
          for (const pl of s.players) {
            pl.queue = pl.queue.filter((q) => q !== k);
            pl.autoQueue = pl.autoQueue.filter((q) => q !== k);
          }
        }
        this.emit(c.marked ? 'beacon_place' : 'beacon_remove', { x: cmd.x, y: cmd.y, owner: playerId });
        return ok;
      }
      case 'build': {
        const reason = this.canBuild(playerId, cmd.building, cmd.x, cmd.y);
        if (reason) {
          this.emit('build_refused', { x: cmd.x, y: cmd.y, owner: playerId, text: reason });
          return bad(reason);
        }
        const cost = this.buildCost(cmd.building, cmd.x, cmd.y);
        p.energy -= cost;
        const nb = this.addBuilding(playerId, cmd.building, cmd.x, cmd.y, false);
        nb.spent = cost;
        nb.level = 1;
        if (cmd.hero) nb.hero = cmd.hero;
        if (this.cell(cmd.x, cmd.y).ruin) {
          nb.rebuild = true;
          this.cell(cmd.x, cmd.y).ruin = undefined;
          this.rev++;
        }
        this.emit('build_place', { x: cmd.x, y: cmd.y, owner: playerId, text: cmd.building });
        return ok;
      }
      case 'upgradeBuilding': {
        const b = this.s.buildings.find((x) => x.id === cmd.building && x.owner === playerId);
        if (!b || !b.complete || b.ruined) return bad('building.upgrade.not_complete');
        const def = buildingDefs[b.type];
        const maxLv = 1 + (def.levels?.length ?? 0);
        const lv = b.level ?? 1;
        if (lv >= maxLv) return bad('building.upgrade.max_level');
        if (this.s.units.some((u) => isEnemy(u) && cheb(Math.round(u.x), Math.round(u.y), b.x, b.y) <= 2)) return bad('building.upgrade.enemies_near');
        const upgCost = def.levels?.[lv - 1]?.cost ?? def.cost * lv;
        if (p.energy < upgCost) return bad('building.upgrade.not_enough_energy');
        p.energy -= upgCost;
        b.level = lv + 1;
        b.spent = (b.spent ?? def.cost) + upgCost;
        this.emit('upgrade_chime', { x: b.x, y: b.y, owner: playerId, text: b.type });
        this.emit('building_upgraded', { x: b.x, y: b.y, owner: playerId, text: String(b.level) });
        return ok;
      }
      case 'heroBoost': {
        const b = this.s.buildings.find((x) => x.id === cmd.building && x.owner === playerId);
        if (!b || !b.complete || b.ruined) return bad('invalid');
        if ((b.boostCooldown ?? 0) > 0) return bad('building.boost.on_cooldown');
        const def = buildingDefs[b.type];
        const boostCost = def.boost?.cost ?? 30;
        if (p.energy < boostCost) return bad('building.boost.not_enough_energy');
        p.energy -= boostCost;
        b.boostCooldown = def.boost?.cooldown ?? 60;
        this.emit('aura_pulse', { x: b.x, y: b.y, owner: playerId, text: b.type });
        this.emit('building_boosted', { x: b.x, y: b.y, owner: playerId, text: b.type });
        return ok;
      }
      case 'cancelBuild': {
        const b = this.s.buildings.find((x) => x.id === cmd.building && x.owner === playerId);
        if (!b) return bad('invalid');
        if (b.complete) return bad('building.cancel.complete');
        const refund = b.spent ?? buildingDefs[b.type].cost;
        if (p.energy + refund < 0) return bad('building.cancel.not_enough_energy');
        for (const u of this.s.units) if (u.task.type === 'build' && u.task.building === b.id) this.setTask(u, { type: 'idle' });
        this.s.buildings = this.s.buildings.filter((x) => x !== b);
        this.cell(b.x, b.y).building = undefined;
        p.energy += refund;
        this.emit('build_cancelled', { x: b.x, y: b.y, owner: playerId, text: b.type });
        this.rev++;
        return ok;
      }
      case 'answerCall': {
        if (!s.controlCall) return bad('call.no_active');
        // Ensure options are set (generated when call starts; set here as fallback).
        if (!s.controlCall.options) {
          s.controlCall = { ...s.controlCall, options: [
            { cost: 0,  effect: 'refuse' },  // 0 = refuse: boss risk, free
            { cost: 25, effect: 'comply' },  // 1 = comply: pay energy, boss delayed
          ]};
        }
        const choice = (cmd as { type: 'answerCall'; choice?: 0 | 1 }).choice ?? 0;
        const callOpts = s.controlCall.options!;
        const opt = callOpts[choice] ?? callOpts[0];
        if (opt.cost > 0 && p.energy < opt.cost) return bad('build.not_enough_energy');
        if (opt.cost > 0) p.energy -= opt.cost;
        s.controlCall = { ...s.controlCall, fork: choice };
        this.emit('boss_call_fork', { fork: choice, owner: playerId });
        if (opt.effect === 'comply') {
          // Comply: Контроль backs off this call — boss doesn't wake.
          this.emit('call_complied', { owner: playerId });
        } else {
          // Refuse: Контроль wakes the boss.
          this.emit('boss_wake', { owner: playerId });
        }
        s.controlCall = null;
        return ok;
      }
      case 'callRaidEarly': {
        const rd = s.raid;
        if (!rd?.canCallEarly) return bad('raid.not_ready');
        if (p.energy < rd.callEarlyEnergy) return bad('raid.not_enough_energy');
        p.energy -= rd.callEarlyEnergy;
        s.raidCalledEarly = true;
        // Force the raid clock to fire immediately next tick.
        s.raidAt = 0;
        this.emit('raid_siren', { owner: playerId });
        return ok;
      }
      case 'demolish': {
        const b = this.s.buildings.find((x) => x.id === cmd.building && x.owner === playerId);
        if (!b) return bad('invalid');
        const def = buildingDefs[b.type];
        if (def.isKeep) return bad('building.demolish.forbidden');
        const refundFrac = def.demolishRefund ?? 0.5;
        const refund = Math.floor((b.spent ?? def.cost) * refundFrac);
        if (p.energy + refund < 0) return bad('building.demolish.not_enough_energy');
        // Remove units that were building this structure.
        for (const u of this.s.units) if (u.task.type === 'build' && u.task.building === b.id) this.setTask(u, { type: 'idle' });
        this.s.buildings = this.s.buildings.filter((x) => x !== b);
        this.cell(b.x, b.y).building = undefined;
        if (b.complete) this.cell(b.x, b.y).ruin = b.type;
        p.energy += refund;
        this.rev++;
        this.emit('building_demolished', { x: b.x, y: b.y, owner: playerId, text: b.type });
        return ok;
      }
      case 'rebuild': {
        const rb = this.s.buildings.find((x) => x.id === cmd.building && x.owner === playerId && x.ruined);
        if (!rb) return bad('building.rebuild.not_ruined');
        const def = buildingDefs[rb.type];
        const rebuildCost = Math.ceil(def.cost * 0.5);
        if (p.energy < rebuildCost) return bad('building.rebuild.not_enough_energy');
        p.energy -= rebuildCost;
        rb.ruined = false;
        rb.hp = Math.max(1, def.hp * 0.25);
        rb.built = 0;
        rb.complete = false;
        rb.rebuild = true;
        rb.spent = (rb.spent ?? def.cost) + rebuildCost;
        this.cell(rb.x, rb.y).building = rb.id;
        this.cell(rb.x, rb.y).ruin = undefined;
        this.rev++;
        this.emit('build_place', { x: rb.x, y: rb.y, owner: playerId, text: rb.type });
        return ok;
      }
      case 'attack': {
        // A tap on an opened lair or hatch means its hero.
        const lair = cmd.target.startsWith('s:') ? this.site(parseKey(cmd.target.slice(2)).x, parseKey(cmd.target.slice(2)).y) : undefined;
        if (lair && (lair.kind === 'hero_lair' || lair.kind === 'boss_hatch')) {
          const hero = lair.alive.map((id) => this.unit(id)).find((h) => h && h.hp > 0);
          if (!hero) return bad();
          if (p.order !== `u:${hero.id}`) this.startRally(hero.x, hero.y, playerId, true);
          p.order = `u:${hero.id}`;
          return ok;
        }
        if (!this.targetAlive(cmd.target)) return bad();
        // In multiplayer, only hostile targets can be ordered against (MVP_RULES §14.1).
        if (!this.hostile(playerId, this.targetOwner(cmd.target))) return bad();
        // In FFA, rival hero units cannot be ordered against (MVP_RULES §14.1).
        const foe = cmd.target.startsWith('u:') ? this.unit(Number(cmd.target.slice(2))) : undefined;
        if (foe && foe.owner >= 0 && foe.kind === 'hero') return bad();
        // Tapping the same target again keeps the order: players tap repeatedly to insist [Антон].
        if (p.order !== cmd.target) {
          const at = this.targetPos(cmd.target);
          this.startRally(at.x, at.y, playerId, true);
        }
        p.order = cmd.target;
        return ok;
      }
      case 'cancelOrder':
        p.order = null;
        return ok;
      case 'pickBoon': {
        const offer = p.boonOffer;
        if (!offer || !offer.ids.includes(cmd.id)) return bad();
        p.boonOffer = undefined;
        this.grantBoon(p, cmd.id);
        return ok;
      }
      case 'scan': {
        const a = p.assist;
        if (a.mode !== 'scanner') return bad();
        if (a.charges <= 0) return bad('assist.no_charges');
        a.charges--;
        a.scanLeft = this.cfg.assist.scanner.markDurationSeconds;
        this.emit('scan', { owner: playerId });
        return ok;
      }
    }
    return bad();
  }

  /** null when the building can go there, otherwise the refusal text key. */
  canBuild(playerId: number, type: string, x: number, y: number): Extract<ApplyResult, { ok: false }>['reason'] | null {
    const def = buildingDefs[type];
    const p = this.player(playerId);
    if (!def?.buildable || !inBounds(this.s, x, y)) return 'invalid';
    const c = this.cell(x, y);
    if (!c.revealed || c.content !== 'ground' || !this.inTerritory(playerId, x, y)) return 'build.invalid_cell';
    if (c.building !== undefined) return 'build.cell_occupied';
    if (p.energy < this.buildCost(type, x, y)) return 'build.not_enough_energy';
    if (this.s.units.some((u) => isEnemy(u) && cheb(Math.round(u.x), Math.round(u.y), x, y) <= 2)) return 'build.enemies_near';
    const cmd = this.building(p.command)!;
    if (!findPath(this.s.width, this.s.height, cmd, (ax, ay) => walkableForPlayer(this.s, ax, ay), (ax, ay) => ax === x && ay === y))
      return 'build.unreachable';
    return null;
  }

  /** Price of a building here: half on ruins (buildingDamage.ruins). */
  buildCost(type: string, x: number, y: number): number {
    const cost = buildingDefs[type].cost;
    return inBounds(this.s, x, y) && this.cell(x, y).ruin ? Math.ceil(cost * buildingDamage.ruins.rebuildCostFactor) : cost;
  }

  buildSeconds(b: Building): number {
    return buildingDefs[b.type].buildSeconds * (b.rebuild ? buildingDamage.ruins.rebuildSecondsFactor : 1);
  }

  /** Tutorial: sites go at fixed offsets from the chosen center; an offset off the board is mirrored. */
  private placeRelativeSites(cx: number, cy: number): void {
    const s = this.s;
    for (const site of this.rules.relativeSites ?? []) {
      const pick = (c: number, d: number, size: number) => {
        const v = c + d >= 0 && c + d < size ? c + d : c - d;
        return Math.max(0, Math.min(size - 1, v));
      };
      const x = pick(cx, site.dx, s.width);
      const y = pick(cy, site.dy, s.height);
      if (x === cx && y === cy) continue;
      const c = this.cell(x, y);
      c.content = site.type;
      if (site.type === 'nest') c.tech = this.rules.relativeTech ?? 'cryo';
      if (site.type === 'rubble') c.stock = 30;
    }
  }

  /** Puts command centers down, generates the field around them and opens the start. */
  placeCommands(list: { player: number; x: number; y: number }[]): void {
    const s = this.s;
    if (!s.generated) {
      const nests = s.players.length > 1 ? 6 * s.players.length : undefined;
      generateField(s, { commands: list, nests });
      // Стажёр and Смена never leave the player a 50/50 (MVP_RULES §15.2); tutorial boards are hand-laid.
      const noGuess = this.difficulty.noGuessBoard && s.players.length === 1 && !this.rules.relativeSites;
      for (let attempt = 1; noGuess && attempt < NO_GUESS_ATTEMPTS && !solvable(s, list); attempt++) {
        for (const c of s.cells) {
          if (c.revealed) continue;
          c.content = 'ground';
          for (const k of ['tech', 'stock', 'hero', 'heroTier'] as const) delete c[k];
        }
        generateField(s, { commands: list, nests });
      }
    }
    for (const { player, x, y } of list) {
      const b = this.addBuilding(player, 'command', x, y, true);
      s.players[player].command = b.id;
      for (const n of [{ x, y }, ...neighbors(s, x, y)]) this.reveal(n.x, n.y, player, false);
      const first = this.cfg.population.firstResidentImmediate ? this.cfg.population.initialResidents : 0;
      for (let i = 0; i < first; i++) this.spawnAllyFromPool(s.players[player], x, y);
    }
  }

  // ------------------------------------------------------------- simulation

  /** How far the clock is between two fixed steps (0..1), so views can draw movers between steps. */
  get stepAlpha(): number {
    return Math.min(1, this.acc / STEP);
  }

  tick(dt: number): void {
    this.acc = Math.min(this.acc + dt, 1);
    while (this.acc >= STEP) {
      this.acc -= STEP;
      this.step(STEP);
    }
  }

  step(dt: number): void {
    const s = this.s;
    if (s.outcome !== 'playing' || !this.started) return;
    const levelBefore = this.threatLevel;
    s.time += dt;
    if (this.threatLevel > levelBefore) this.emit('threat_level_up', { amount: this.threatLevel });
    this.heroClock();
    this.bossClock();
    this.raidClock();
    this.assistTimers(dt);
    this.population(dt);
    for (const u of [...s.units]) {
      if (u.hp <= 0) continue;
      this.effects(u, dt);
      if (u.hp <= 0 || (u.stun ?? 0) > 0) continue;
      if (u.kind === 'resident' || u.kind === 'ally') this.residentAi(u, dt);
      else this.enemyAi(u, dt);
    }
    this.nests(dt);
    this.towers(dt);
    this.boonClock(dt);
    this.allyClock(dt);
    this.production(dt);
    this.orbs(dt);
    this.hotGround(dt);
    this.hazardClock(dt);
    this.idleHint();
    this.cleanup();
    this.checkOutcome();
    this.syncDerivedFields();
  }

  private assistTimers(dt: number): void {
    const sc = this.cfg.assist.scanner;
    for (const p of this.s.players) {
      const a = p.assist;
      if (a.mode !== 'scanner') continue;
      a.scanLeft = Math.max(0, a.scanLeft - dt);
      if (a.charges >= sc.maxCharges) {
        a.recharge = sc.rechargeSeconds;
        continue;
      }
      a.recharge -= dt;
      if (a.recharge <= 0) {
        a.charges++;
        a.recharge = sc.rechargeSeconds;
      }
    }
  }

  /** Armed mines blow, opened medkits heal (hazards.json). */
  private hazardClock(dt: number): void {
    const s = this.s;
    for (let y = 0; y < s.height; y++) {
      for (let x = 0; x < s.width; x++) {
        const c = this.cell(x, y);
        if (c.fuse !== undefined) {
          c.fuse -= dt;
          if (c.fuse <= 0) this.mineBlast(x, y, c);
        }
        if (c.heal !== undefined) {
          c.heal -= dt;
          const m = hazards.medkit;
          for (const u of s.units) {
            if (isEnemy(u) || u.hp <= 0 || cheb(Math.round(u.x), Math.round(u.y), x, y) > m.radius) continue;
            const doctor = s.units.some((d) => d.kind === 'ally' && d.hero === 'doctor' && d.owner === u.owner && d.hp > 0);
            u.hp = Math.min(this.maxHp(u), u.hp + m.hpPerSecond * (doctor ? m.doctorFactor : 1) * dt);
          }
          if (c.heal <= 0) {
            c.heal = undefined;
            this.rev++;
            this.emit('medkit_empty', { x, y });
          }
        }
      }
    }
  }

  /** One blast per mine: element damage and status to our units and buildings around it (hazards.json mine.unmarkedDig). */
  private mineBlast(x: number, y: number, c: Cell): void {
    const s = this.s;
    const m = hazards.mine.unmarkedDig;
    c.fuse = undefined;
    c.resolved = true;
    this.rev++;
    const tech = c.tech ?? 'impact';
    const st = m.status[tech];
    const fx = typeof st === 'object' ? st : {};
    const sts = elements.statuses;
    let hits = 0;
    for (const u of s.units) {
      if (isEnemy(u) || u.hp <= 0 || cheb(Math.round(u.x), Math.round(u.y), x, y) > m.radius) continue;
      hits++;
      // Named statuses take the tier-2 numbers of elements.json.
      if (st === 'burn') u.burn = { dps: sts.burn.dpsByTier[1] ?? sts.burn.dpsByTier[0], left: sts.burn.seconds, source: -1 };
      if (st === 'poison') u.poison = { dps: sts.poison.dpsByTier[1] ?? sts.poison.dpsByTier[0], left: sts.poison.seconds, defense: sts.poison.defenseMinusByTier[1] ?? 0, source: -1 };
      const stun = fx.stunSeconds ?? fx.freezeSeconds;
      if (stun) u.stun = Math.max(u.stun ?? 0, stun);
      if (fx.defenseMinus) u.bare = Math.max(u.bare ?? 0, fx.seconds ?? 10);
      this.damage(u, m.damage);
    }
    if (m.hitsBuildings) {
      for (const b of s.buildings) {
        if (b.hp <= 0 || cheb(b.x, b.y, x, y) > m.radius || (b.type === 'command' && this.rules.commandInvulnerable)) continue;
        b.hp -= m.damage;
        if (b.type === 'command') this.emit('center_hit', { x: b.x, y: b.y, owner: b.owner });
      }
    }
    this.emit('mine_blast', { x, y, text: tech, amount: hits });
  }

  /** A bonus capsule gives one random bonus, once (hazards.json bonusCapsule.pool). */
  private openCapsule(player: Player, x: number, y: number): void {
    const s = this.s;
    const pool = hazards.bonusCapsule.pool;
    const ids = Object.keys(pool);
    const id = ids[randIntOf(s, ids.length)];
    const b = pool[id];
    this.cell(x, y).bonus = id;
    let amount = 0;
    if (b.energy) {
      amount = b.energy;
      this.earn(player, amount);
    }
    if (b.armorPlateNearestHero) {
      const near = s.units
        .filter((u) => u.owner === player.id && (u.kind === 'ally' || u.kind === 'resident') && u.hp > 0 && (u.armorPlates ?? 0) < armorPlateDef.maxPerHero)
        .sort((a, c) => dist(a.x, a.y, x, y) - dist(c.x, c.y, x, y));
      const u = near[0];
      if (u) {
        const give = Math.min(b.armorPlateNearestHero, armorPlateDef.maxPerHero - (u.armorPlates ?? 0));
        u.armorPlates = (u.armorPlates ?? 0) + give;
        u.base = { ...u.base, defense: u.base.defense + give * armorPlateDef.defenseAdd };
        u.hp += give * armorPlateDef.hpAdd;
        amount = give;
      }
    }
    if (b.buildingsHealPercent) {
      for (const bl of s.buildings) {
        if (bl.owner !== player.id || bl.hp <= 0) continue;
        const max = buildingDefs[bl.type].hp;
        bl.hp = Math.min(max, bl.hp + (max * b.buildingsHealPercent) / 100);
      }
      amount = b.buildingsHealPercent;
    }
    if (b.peekCharges) {
      // A Watchtower-style peek (buildings.json watchtower.peek): the sensors of the closed 3×3 around the capsule
      // show for a while without digging. Nothing gets marked: the player decides (MVP_RULES §3.1а).
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!inBounds(s, x + dx, y + dy)) continue;
          const n = this.cell(x + dx, y + dy);
          if (n.revealed) continue;
          n.peekUntil = s.time + CAPSULE_PEEK_SECONDS;
          amount++;
        }
      }
      this.rev++;
    }
    if (b.heroesDamageTakenFactor) {
      amount = b.seconds ?? 20;
      player.resistUntil = s.time + amount;
    }
    this.emit('bonus_opened', { x, y, owner: player.id, text: id, amount });
  }

  /** «Гнездо крепнет, пока ждёшь» (config.threat.warnings.idleNestHint). */
  private idleHint(): void {
    const h = this.cfg.threat.warnings?.idleNestHint;
    if (!h || this.rules.threatEnabled === false) return;
    const quiet = this.s.time - Math.max(this.lastCombat, this.lastIdleHint);
    if (quiet < h.afterSecondsWithoutCombat) return;
    const k = this.knowledge();
    const known =
      this.s.sites.filter((t) => !t.destroyed && (t.kind === 'nest' || t.kind === 'heavy_nest')).length +
      [...k.values()].filter((v) => v === 'threat').length;
    if (known < h.ifKnownNests) return;
    this.lastIdleHint = this.s.time;
    this.emit('hint', { text: h.text });
  }

  // -- reveal & clues

  private reveal(x: number, y: number, owner: number, pay = true): void {
    const s = this.s;
    const c = this.cell(x, y);
    if (c.revealed) return;
    this.rev++;
    c.revealed = true;
    const defusing = c.defuse === true;
    c.defuse = undefined;
    c.marked = false;
    c.markKind = undefined;
    const k = cellKey(x, y);
    for (const p of s.players) {
      p.queue = p.queue.filter((q) => q !== k);
      p.autoQueue = p.autoQueue.filter((q) => q !== k);
    }
    if (pay) {
      this.spawnOrb(owner, x, y, Math.round(this.cfg.economy.energyPerDugTile * this.allyFactor(owner, 'digEnergyFactor') * this.allyFactor(owner, 'energyProductionFactor', 'value')));
      this.emit('dig_done', { x, y, owner });
      this.addTempo(owner, 'dig');
    }
    const player = s.players[owner];
    switch (c.content) {
      case 'cache': {
        c.resolved = true;
        // With bonuses on, a cache pays a little Energy and offers 1 of 3 cards (META.md §8).
        const offer = this.rules.boonPool?.length ? this.boonOffer(player) : [];
        const energy = offer.length ? boonRules.cacheEnergyStillGranted : (siteDefs.cache.onReveal?.energy ?? this.cfg.economy.cacheEnergy);
        this.earn(player, energy);
        player.stats.caches++;
        this.emit('cache_open', { x, y, owner, amount: energy });
        this.addTempo(owner, 'cache');
        if (offer.length) {
          player.boonOffer = { ids: offer, at: s.time };
          this.emit('boon_offer', { x, y, owner, text: offer.join(',') });
        }
        break;
      }
      case 'survivor': {
        c.resolved = true;
        player.capBonus++;
        this.spawnResident(owner, x, y);
        this.emit('survivor_joined', { x, y, owner });
        this.addTempo(owner, 'survivor');
        break;
      }
      case 'mine':
        // Dug under an «Опасно» mark: the heroes defuse it (hazards.json mine.markedDig).
        if (defusing && hazards.mine.markedDig.defuse) {
          c.resolved = true;
          this.earn(player, hazards.mine.markedDig.energy);
          this.emit('mine_defused', { x, y, owner, text: c.tech, amount: hazards.mine.markedDig.energy });
          break;
        }
        // Dug blind: it arms and blows after the fuse.
        c.fuse = hazards.mine.unmarkedDig.armSeconds;
        this.emit('mine_armed', { x, y, owner, text: c.tech });
        break;
      case 'bonus_capsule':
        c.resolved = true;
        this.openCapsule(player, x, y);
        break;
      case 'medkit':
        c.resolved = true;
        c.heal = hazards.medkit.seconds;
        this.emit('medkit_open', { x, y, owner });
        break;
      case 'blueprint': {
        c.resolved = true;
        player.stats.blueprints++;
        this.emit('blueprint_found', { x, y, owner });
        break;
      }
      case 'lore_record': {
        c.resolved = true;
        player.stats.loreRecords++;
        this.emit('lore_found', { x, y, owner });
        break;
      }
      case 'armor_crate': {
        c.resolved = true;
        const plates = siteDefs.armor_crate.onReveal?.armorPlates ?? 3;
        // Give plates to nearby ally/resident units with the fewest plates (within 4 cells).
        const nearby = this.s.units
          .filter((u) => (u.kind === 'resident' || u.kind === 'ally') && u.owner === owner && u.hp > 0 && cheb(u.x, u.y, x, y) <= 4)
          .sort((a, b) => (a.armorPlates ?? 0) - (b.armorPlates ?? 0));
        let left = plates;
        for (const u of nearby) {
          if (left <= 0) break;
          const current = u.armorPlates ?? 0;
          const give = Math.min(left, armorPlateDef.maxPerHero - current);
          if (give <= 0) continue;
          u.armorPlates = current + give;
          u.base = { ...u.base, defense: u.base.defense + give * armorPlateDef.defenseAdd };
          const hpBonus = give * armorPlateDef.hpAdd;
          u.hp = Math.min(u.hp + hpBonus, this.maxHp(u) + hpBonus);
          left -= give;
        }
        this.emit('armor_crate_open', { x, y, owner, amount: plates - left });
        break;
      }
      case 'nest':
      case 'heavy_nest':
        this.openNest(x, y, c);
        break;
      case 'hero_lair':
        this.openHeroSite(x, y, 'hero_lair', c.hero!);
        break;
      case 'boss_hatch':
        this.wakeBoss();
        break;
    }
    // Quiet cell: its covered neighbors go to the low-priority auto queue (tutorial only).
    if (!isSiteCell(c) && c.content !== 'water' && this.cfg.dig.autoQueueZeroNeighbors) {
      const cl = this.clues(x, y);
      if (cl.threat + cl.demon + cl.finds === 0) {
        for (const n of neighbors(s, x, y)) {
          const nk = cellKey(n.x, n.y);
          if (!n.cell.revealed && !n.cell.marked && !player.queue.includes(nk) && !player.autoQueue.includes(nk)) player.autoQueue.push(nk);
        }
      }
    }
    // Cascade wave (§17.2): quiet ground cell triggers BFS reveal of neighbors, depth by tempo level.
    if (!isSiteCell(c) && c.content !== 'water') {
      const cl = this.clues(x, y);
      if (cl.threat + cl.demon + cl.finds === 0) {
        const tempoLevel = s.tempo?.level ?? 0;
        // Tempo 0→depth 1, 1→2, 2→4, 3→unlimited (9999)
        const waveDepth = tempoLevel === 0 ? 1 : tempoLevel === 1 ? 2 : tempoLevel === 2 ? 4 : 9999;
        this.cascadeWave(x, y, owner, waveDepth);
      }
    }
  }

  /** BFS cascade-reveal of quiet ground cells (§17.2). Cells opened by wave give 0.25 tempo points. */
  private cascadeWave(cx: number, cy: number, owner: number, maxDepth: number): void {
    const s = this.s;
    const frontier: Array<{ x: number; y: number; depth: number }> = [{ x: cx, y: cy, depth: 0 }];
    const visited = new Set<string>();
    visited.add(cellKey(cx, cy));
    while (frontier.length > 0) {
      const { x, y, depth } = frontier.shift()!;
      if (depth >= maxDepth) continue;
      for (const n of neighbors(s, x, y)) {
        const nk = cellKey(n.x, n.y);
        if (visited.has(nk)) continue;
        visited.add(nk);
        const nc = n.cell;
        // Wave only opens plain ground cells — no site cells, no water, no special content.
        if (nc.revealed || nc.content === 'water' || isSiteCell(nc) || nc.content !== 'ground') continue;
        nc.revealed = true;
        nc.dig = undefined;
        // Opened by the wave: off every dig queue, or «В очереди» counts open blocks.
        for (const pl of s.players) {
          pl.queue = pl.queue.filter((q) => q !== nk);
          pl.autoQueue = pl.autoQueue.filter((q) => q !== nk);
        }
        this.emit('dig_done', { x: n.x, y: n.y, owner, wave: true });
        this.addTempo(owner, 'wave');
        // Continue cascade only if this neighbor is also quiet.
        const ncl = this.clues(n.x, n.y);
        if (ncl.threat + ncl.demon + ncl.finds === 0) {
          frontier.push({ x: n.x, y: n.y, depth: depth + 1 });
        }
      }
    }
  }

  // -- population (MVP_RULES §4: a resident every spawnSeconds while below the cap)

  private spawnResident(owner: number, x: number, y: number): Unit {
    const u = this.newUnit('resident', owner, x, y, { ...residentStats });
    u.hp = this.stats(u).hp;
    this.emit('resident_born', { x, y, owner, unit: u.id });
    return u;
  }

  /** The command center, or the finished home closest to the first cell the player wants dug. */
  private spawnPoint(p: Player): { x: number; y: number } | null {
    const cmd = this.building(p.command);
    if (!cmd) return null;
    const goal = p.queue.length ? parseKey(p.queue[0]) : null;
    if (!goal) return cmd;
    const points = this.s.buildings.filter((b) => b.owner === p.id && b.complete && buildingDefs[b.type].spawnPoint);
    return points.sort((a, b) => cheb(a.x, a.y, goal.x, goal.y) - cheb(b.x, b.y, goal.x, goal.y))[0] ?? cmd;
  }

  private population(dt: number): void {
    for (const p of this.s.players) {
      if (!p.alive || p.command === null) continue;
      const count = this.s.units.filter((u) => u.owner === p.id && (u.kind === 'resident' || u.kind === 'ally')).length;
      if (count >= this.residentCap(p.id)) {
        p.spawnTimer = Math.max(p.spawnTimer, 0);
        continue;
      }
      p.spawnTimer -= dt;
      if (p.spawnTimer > 0) continue;
      p.spawnTimer = this.cfg.population.spawnSeconds * this.boonFactor(p.id, 'hotline') * this.allyFactor(p.id, 'spawnIntervalFactor', 'value');
      const at = this.spawnPoint(p);
      if (at) this.spawnAllyFromPool(p, at.x, at.y);
    }
  }

  // -- residents

  /** Who this resident should fight right now, if anyone (config.residents). */
  private combatTarget(u: Unit): string | null {
    const s = this.s;
    const p = s.players[u.owner];
    if (p.order && !this.targetAlive(p.order)) p.order = null;
    const r = this.cfg.residents;
    const own = s.buildings.filter((b) => b.owner === u.owner);
    const guarded = (x: number, y: number) => own.some((b) => cheb(Math.round(x), Math.round(y), b.x, b.y) <= r.guardRadiusAroundBuildings);
    const close = (e: Unit) => dist(e.x, e.y, u.x, u.y) <= r.engageRadius;
    // Marching on an ordered target, residents still answer foes that reach them.
    const near = s.units
      .filter((e) => isEnemy(e) && e.hp > 0 && (close(e) || (!p.order && guarded(e.x, e.y))))
      .sort((a, b) => dist(a.x, a.y, u.x, u.y) - dist(b.x, b.y, u.x, u.y))[0];
    if (near && (!p.order || dist(near.x, near.y, u.x, u.y) <= 2)) return `u:${near.id}`;
    if (p.order) return p.order;
    const site = s.sites
      .filter((t) => !t.destroyed && (t.kind === 'nest' || t.kind === 'heavy_nest') && guarded(t.x, t.y))
      .sort((a, b) => dist(a.x, a.y, u.x, u.y) - dist(b.x, b.y, u.x, u.y))[0];
    return site ? siteKey(site.x, site.y) : null;
  }

  private residentAi(u: Unit, dt: number): void {
    const s = this.s;
    // Аптечки (boons.json first_aid): out of combat residents slowly heal.
    const aid = s.players[u.owner]?.boons?.first_aid ? boonDefs.first_aid.effect : null;
    if (aid && u.hp < this.maxHp(u) && !s.units.some((e) => isEnemy(e) && e.hp > 0 && dist(e.x, e.y, u.x, u.y) <= 3)) {
      u.hp = Math.min(this.maxHp(u), u.hp + Number(aid.hpPerSecond) * dt);
    }
    if (this.retreating(u, dt)) return;
    if (this.rallying(u, dt)) return;
    const target = this.cfg.residents.allFight ? this.combatTarget(u) : null;
    if (target) {
      if (u.task.type !== 'idle' && u.task.type !== 'rest') this.setTask(u, { type: 'idle' });
      u.calm = this.cfg.residents.returnToWorkAfterSeconds;
      return this.fight(u, target, dt, (x, y) => walkableForPlayer(s, x, y));
    }
    u.target = undefined;
    if ((u.calm ?? 0) > 0) {
      u.calm! -= dt;
      return;
    }
    const t = u.task;
    switch (t.type) {
      case 'idle':
      case 'rest':
        u.repathTimer -= dt;
        if (u.repathTimer <= 0) {
          u.repathTimer = 0.5;
          this.findJob(u);
        }
        this.move(u, dt);
        return;
      case 'dig': {
        if (!this.isQueued(u.owner, t.x, t.y) || this.cell(t.x, t.y).revealed) return this.setTask(u, { type: 'idle' });
        if (u.path.length > 0) return this.move(u, dt);
        if (t.progress === 0) this.emit('dig_start', { x: t.x, y: t.y, owner: u.owner });
        const c = this.cell(t.x, t.y);
        const digMul = this.digSpeedOf(u, c.element as Tech | undefined);
        c.dig = (c.dig ?? 0) + this.workShare(u, (o) => o.task.type === 'dig' && o.task.x === t.x && o.task.y === t.y) * dt * digMul;
        t.progress = Math.max(c.dig, 1e-6);
        if (c.dig >= this.cfg.dig.digSeconds * this.boonFactor(u.owner, 'sharp_shovels') * this.allyFactor(u.owner, 'drillDig', 'digTimeFactor')) {
          c.dig = undefined;
          this.setTask(u, { type: 'idle' });
          this.reveal(t.x, t.y, u.owner);
        }
        return;
      }
      case 'harvest': {
        const c = this.cell(t.x, t.y);
        if (!s.players[u.owner].queue.includes(cellKey(t.x, t.y)) || !(c.stock && c.stock > 0)) return this.setTask(u, { type: 'idle' });
        if (u.path.length > 0) return this.move(u, dt);
        t.progress += dt;
        if (c.content === 'rubble') {
          if (t.progress >= mapgen.rubble.workSeconds * this.allyFactor(u.owner, 'rubbleWorkFactor')) {
            this.spawnOrb(u.owner, t.x, t.y, c.stock);
            this.depleted(t.x, t.y);
            this.setTask(u, { type: 'idle' });
          }
        } else if (t.progress >= mapgen.energyVein.secondsPerEnergy) {
          t.progress = 0;
          c.stock--;
          this.spawnOrb(u.owner, t.x, t.y, 1);
          if (c.stock <= 0) {
            this.depleted(t.x, t.y);
            this.setTask(u, { type: 'idle' });
          }
        }
        return;
      }
      case 'build': {
        const b = this.building(t.building);
        if (!b || b.complete) return this.setTask(u, { type: 'idle' });
        if (u.path.length > 0) return this.move(u, dt);
        b.built += this.workShare(u, (o) => o.task.type === 'build' && o.task.building === b.id) * dt;
        if (b.built >= this.buildSeconds(b)) this.finishBuilding(b);
        return;
      }
    }
  }

  /**
   * Residents near a fresh threat gather 2 cells from it on the command center's side first,
   * then go in together (config.residents.rally, QA B-2). `owner` undefined: every player near it.
   * A player's own order calls `everyone`: the whole crew goes, not only those within the radius.
   */
  private startRally(x: number, y: number, owner?: number, everyone = false): void {
    const s = this.s;
    const r = this.cfg.residents.rally;
    for (const p of s.players) {
      if (!p.alive || (owner !== undefined && p.id !== owner)) continue;
      const cmd = this.building(p.command);
      if (!cmd) continue;
      const members = s.units
        .filter((u) => u.owner === p.id && (u.kind === 'resident' || u.kind === 'ally') && u.hp > 0 && !u.retreat && (everyone || dist(u.x, u.y, x, y) <= r.radius))
        .map((u) => u.id);
      if (members.length < 2) continue;
      // The gather point: 2 steps from the threat toward the center, on opened walkable ground.
      const d = Math.max(1e-6, dist(x, y, cmd.x, cmd.y));
      const step = Math.min(2, d);
      const gx = Math.round(x + ((cmd.x - x) / d) * step);
      const gy = Math.round(y + ((cmd.y - y) / d) * step);
      const path = findPath(s.width, s.height, { x: cmd.x, y: cmd.y }, (ax, ay) => walkableForPlayer(s, ax, ay), (ax, ay) => ax === gx && ay === gy, { x: gx, y: gy });
      const at = path?.[path.length - 1] ?? { x: cmd.x, y: cmd.y };
      p.rally = { x: at.x, y: at.y, start: s.time, members };
    }
  }

  /** True while this resident walks to the gather point and waits for the others. */
  private rallying(u: Unit, dt: number): boolean {
    const s = this.s;
    const p = s.players[u.owner];
    const r = p.rally;
    if (!r || !r.members.includes(u.id)) return false;
    const alive = r.members.map((id) => this.unit(id)).filter((m): m is Unit => !!m && m.hp > 0 && !m.retreat);
    const gathered = alive.filter((m) => dist(m.x, m.y, r.x, r.y) <= 1.2).length;
    const foeAtPoint = s.units.some((e) => isEnemy(e) && e.hp > 0 && dist(e.x, e.y, r.x, r.y) <= 1.5);
    const ready = gathered >= Math.min(4, alive.length) || s.time - r.start >= 4 || foeAtPoint;
    if (ready || alive.length === 0) {
      p.rally = undefined;
      return false;
    }
    // A foe right on top of the resident still gets hit.
    const close = s.units.find((e) => isEnemy(e) && e.hp > 0 && dist(e.x, e.y, u.x, u.y) <= 1.5);
    if (close) {
      this.fight(u, `u:${close.id}`, dt, (x, y) => walkableForPlayer(s, x, y));
      return true;
    }
    if (u.task.type !== 'idle' && u.task.type !== 'rest') this.setTask(u, { type: 'idle' });
    u.target = undefined;
    if (dist(u.x, u.y, r.x, r.y) > 0.6 && (u.path.length === 0 || u.repathTimer <= 0)) {
      u.repathTimer = 0.5;
      const path = findPath(s.width, s.height, { x: Math.round(u.x), y: Math.round(u.y) }, (x, y) => walkableForPlayer(s, x, y), (x, y) => x === r.x && y === r.y, r);
      u.path = path ? path.slice(1) : [];
    }
    u.repathTimer -= dt;
    this.move(u, dt);
    return true;
  }

  /** Below 25 % HP a resident walks to the nearest healer (the center or a medcenter) and waits there until 80 %. */
  private retreating(u: Unit, dt: number): boolean {
    const s = this.s;
    const r = this.cfg.residents.retreat;
    const max = this.maxHp(u);
    if (!u.retreat && u.hp < max * r.atHpFraction) u.retreat = true;
    if (u.retreat && u.hp >= max * r.returnAtHpFraction) u.retreat = false;
    if (!u.retreat) return false;
    const healers = s.buildings.filter((b) => b.owner === u.owner && b.complete && (buildingDefs[b.type].healAura || buildingDefs[b.type].aura?.healAmount));
    const home = healers.sort((a, b) => dist(a.x, a.y, u.x, u.y) - dist(b.x, b.y, u.x, u.y))[0];
    if (!home) {
      u.retreat = false;
      return false;
    }
    u.target = undefined;
    if (u.task.type !== 'idle' && u.task.type !== 'rest') this.setTask(u, { type: 'idle' });
    if (cheb(Math.round(u.x), Math.round(u.y), home.x, home.y) <= 1) {
      u.path = [];
      return true;
    }
    if (u.path.length === 0 || u.repathTimer <= 0) {
      u.repathTimer = 0.5;
      const path = this.playerPath(u, (x, y) => cheb(x, y, home.x, home.y) <= 1 && !(x === home.x && y === home.y));
      u.path = path ? path.slice(1) : [];
    }
    u.repathTimer -= dt;
    this.move(u, dt);
    return true;
  }

  private finishBuilding(b: Building): void {
    const before = this.trainingLevel(b.owner);
    b.complete = true;
    b.hp = buildingDefs[b.type].hp;
    // A new school level: every resident's max HP grows, so does their current HP.
    if (this.trainingLevel(b.owner) > before) {
      const add = this.cfg.school.perLevel.hp * (this.trainingLevel(b.owner) - before);
      for (const r of this.s.units) if (r.owner === b.owner && (r.kind === 'resident' || r.kind === 'ally')) r.hp += add;
      this.emit('training_up', { x: b.x, y: b.y, owner: b.owner, amount: this.trainingLevel(b.owner) });
    }
    this.emit('build_done', { x: b.x, y: b.y, owner: b.owner, text: b.type });
    for (const u of this.s.units) if (u.task.type === 'build' && u.task.building === b.id) this.setTask(u, { type: 'idle' });
    // Spawn a hero of the building's tier when construction finishes (MVP_RULES §4.1b).
    const birthTiers = buildingDefs[b.type].heroBirthTiers;
    if (birthTiers?.length) this.spawnAllyFromPool(this.s.players[b.owner], b.x, b.y, birthTiers);
  }

  private depleted(x: number, y: number): void {
    this.rev++;
    const c = this.cell(x, y);
    c.content = 'ground';
    c.stock = 0;
    const k = cellKey(x, y);
    for (const p of this.s.players) p.queue = p.queue.filter((q) => q !== k);
  }

  private setTask(u: Unit, task: Task): void {
    u.task = task;
    u.path = [];
  }

  /**
   * Priority (MVP_RULES §4.1): fight (above), build, dig, harvest, auto dig, rest. Deviation:
   * player-marked harvest goes before the automatic dig queue, otherwise auto digs starve it.
   */
  private findJob(u: Unit): void {
    const s = this.s;
    const p = s.players[u.owner];
    const claims = (pred: (t: Task) => boolean) => s.units.filter((o) => o !== u && o.owner === u.owner && pred(o.task)).length;
    const claimed = (pred: (t: Task) => boolean) => claims(pred) > 0;
    const maxPer = this.cfg.dig.workers.maxPerCell;

    const site = s.buildings.find(
      (b) => b.owner === u.owner && !b.complete && !claimed((t) => t.type === 'build' && t.building === b.id),
    );
    if (site) {
      const path = this.playerPath(u, (x, y) => x === site.x && y === site.y);
      if (path) return this.go(u, { type: 'build', building: site.id }, path);
    }

    // `join`: help on a cell somebody already digs, up to maxPerCell (config.dig.workers.idleJoin).
    const digFrom = (list: string[], join = false): boolean => {
      const wanted = new Set(
        list.filter((k) => {
          const { x, y } = parseKey(k);
          if (this.cell(x, y).revealed) return false;
          const n = claims((t) => t.type === 'dig' && t.x === x && t.y === y);
          return join ? n > 0 && n < maxPer : n === 0;
        }),
      );
      if (wanted.size === 0) return false;
      let goal: { x: number; y: number } | null = null;
      const path = this.playerPath(u, (x, y) => {
        for (const n of neighbors(s, x, y)) {
          if (wanted.has(cellKey(n.x, n.y))) {
            goal = { x: n.x, y: n.y };
            return true;
          }
        }
        return false;
      });
      if (!path || !goal) return false;
      const g = goal as { x: number; y: number };
      this.go(u, { type: 'dig', x: g.x, y: g.y, progress: 0 }, path);
      return true;
    };
    if (digFrom(p.queue)) return;

    const harvest = p.queue.map(parseKey).filter(({ x, y }) => {
      const c = this.cell(x, y);
      if (!c.revealed || !(c.stock && c.stock > 0)) return false;
      const max = c.content === 'energy_vein' ? mapgen.energyVein.maxWorkers : 1;
      return s.units.filter((o) => o !== u && o.task.type === 'harvest' && o.task.x === x && o.task.y === y).length < max;
    });
    if (harvest.length > 0) {
      const targets = new Set(harvest.map((h) => cellKey(h.x, h.y)));
      let goal: { x: number; y: number } | null = null;
      const path = this.playerPath(u, (x, y) => {
        if (targets.has(cellKey(x, y))) {
          goal = { x, y };
          return true;
        }
        return false;
      });
      if (path && goal) {
        const g = goal as { x: number; y: number };
        return this.go(u, { type: 'harvest', x: g.x, y: g.y, progress: 0 }, path);
      }
    }

    if (digFrom(p.autoQueue)) return;
    if (digFrom(p.queue, true) || digFrom(p.autoQueue, true)) return;
    const helpBuild = s.buildings.find(
      (b) => b.owner === u.owner && !b.complete && claims((t) => t.type === 'build' && t.building === b.id) < maxPer,
    );
    if (helpBuild) {
      const path = this.playerPath(u, (x, y) => x === helpBuild.x && y === helpBuild.y);
      if (path) return this.go(u, { type: 'build', building: helpBuild.id }, path);
    }

    if (u.task.type !== 'rest') {
      const home = this.building(p.command);
      if (home) {
        // Rest spots spread around the center, so residents don't stand on its roof.
        const ring = neighbors(s, home.x, home.y).filter((n) => walkableForPlayer(s, n.x, n.y) && n.cell.building === undefined);
        const spot = ring[u.id % Math.max(1, ring.length)];
        const path = spot ? this.playerPath(u, (x, y) => x === spot.x && y === spot.y) : null;
        this.go(u, { type: 'rest' }, path ?? []);
      }
    }
  }

  /**
   * This worker's share of the job's speed: n workers on site go
   * 1 + 0.75 × (n − 1) times as fast together (config.dig.workers).
   */
  private workShare(u: Unit, same: (o: Unit) => boolean): number {
    const n = Math.min(
      this.cfg.dig.workers.maxPerCell,
      this.s.units.filter((o) => o.owner === u.owner && o.hp > 0 && o.path.length === 0 && same(o)).length,
    );
    if (n <= 1) return 1;
    return (1 + this.cfg.dig.workers.speedBonusPerExtraWorker * (n - 1)) / n;
  }

  private go(u: Unit, task: Task, path: { x: number; y: number }[]): void {
    this.setTask(u, task);
    u.path = path.slice(1);
  }

  private playerPath(u: Unit, goal: (x: number, y: number) => boolean) {
    const start = { x: Math.round(u.x), y: Math.round(u.y) };
    const s = this.s;
    return findPath(s.width, s.height, start, (x, y) => walkableForPlayer(s, x, y), goal);
  }

  private move(u: Unit, dt: number): void {
    let budget = this.stats(u).speed * dt;
    while (budget > 0 && u.path.length > 0) {
      const next = u.path[0];
      const d = dist(next.x, next.y, u.x, u.y);
      if (d <= budget) {
        u.x = next.x;
        u.y = next.y;
        budget -= d;
        u.path.shift();
      } else {
        u.x += ((next.x - u.x) / d) * budget;
        u.y += ((next.y - u.y) / d) * budget;
        budget = 0;
      }
    }
  }

  /** Raids (MVP_RULES §9.7): opened nests send a squad at the nearest building on a timer. */
  private raidClock(): void {
    const s = this.s;
    const r = difficulties[s.difficulty]?.raids;
    if (!r?.enabled || this.rules.threatEnabled === false) return;
    s.raidAt ??= r.firstAfterSeconds;
    if (s.time < s.raidAt) return;
    s.raidAt = s.time + r.everySeconds;
    const size = Math.min(r.maxSize, r.size + Math.floor(this.threatLevel / r.sizePerThreatLevels));
    const opened = s.sites.filter((t) => !t.destroyed && (t.kind === 'nest' || t.kind === 'heavy_nest'));
    const ours = s.buildings.filter((b) => s.players[b.owner]?.alive);
    if (!ours.length) return;
    const near = (x: number, y: number) => Math.min(...ours.map((b) => dist(b.x, b.y, x, y)));
    let source: { x: number; y: number; tunnel: boolean } | undefined;
    if (opened.length) {
      const t = opened.sort((a, b) => near(a.x, a.y) - near(b.x, b.y))[0];
      source = { x: t.x, y: t.y, tunnel: false };
    } else {
      // No opened nest: the nearest hidden one digs a tunnel and sends the raid from there.
      let best = Infinity;
      s.cells.forEach((c, i) => {
        if (c.revealed || (c.content !== 'nest' && c.content !== 'heavy_nest')) return;
        const x = i % s.width;
        const y = (i - x) / s.width;
        const d = near(x, y);
        if (d < best) [best, source] = [d, { x, y, tunnel: true }];
      });
    }
    if (!source) return;
    const target = this.raidTarget(source.x, source.y, -1);
    if (!target) return;
    const tech = this.cell(source.x, source.y).tech;
    // A nest right next to the city: the raid surfaces farther out, so the siren gives time to react (QA B-3).
    const rr = raidRules;
    let exit = { x: source.x, y: source.y };
    if (near(source.x, source.y) < rr.spawnMinDistanceFromBuildings) {
      const tp = this.targetPos(target);
      const d = Math.max(1e-6, dist(source.x, source.y, tp.x, tp.y));
      const ideal = { x: tp.x + ((source.x - tp.x) / d) * rr.spawnMinDistanceFromBuildings, y: tp.y + ((source.y - tp.y) / d) * rr.spawnMinDistanceFromBuildings };
      let best = Infinity;
      for (let y = 0; y < s.height; y++)
        for (let x = 0; x < s.width; x++) {
          if (!walkableForEnemy(s, x, y) || near(x, y) < rr.spawnMinDistanceFromBuildings) continue;
          const dd = dist(x, y, ideal.x, ideal.y);
          if (dd < best) [best, exit] = [dd, { x, y }];
        }
    }
    const spots = [exit, ...neighbors(s, exit.x, exit.y)].filter((n) => !(n.x === source!.x && n.y === source!.y) && walkableForEnemy(s, n.x, n.y));
    if (!spots.length) return;
    const e = this.enemyDef('adaptant');
    for (let i = 0; i < size; i++) {
      const spot = spots[i % spots.length];
      const u = this.newUnit('adaptant', -1, spot.x, spot.y, this.scaled(e));
      u.tech = tech;
      u.attackTech = (e.attackTech === 'fromNest' ? tech : e.attackTech) as AttackTech | undefined;
      const part = this.enemyPart('adaptant', tech);
      if (part) {
        u.parts[partDefs[part.id].slot === 'arm' ? 'arm_right' : 'leg_left'] = part;
        u.hp = this.stats(u).hp;
      }
      u.raid = target;
      u.holdUntil = s.time + rr.minSecondsSirenToFirstHit;
      this.emit('enemy_spawn', { x: spot.x, y: spot.y, text: `adaptant_${tech ?? 'thermo'}`, unit: u.id });
    }
    const b = this.targetPos(target);
    this.startRally(source.x, source.y, this.building(Number(target.slice(2)))!.owner);
    this.emit('raid_incoming', { x: b.x, y: b.y, owner: this.building(Number(target.slice(2)))!.owner, amount: size, text: source.tunnel ? `${source.x},${source.y}` : undefined });
  }

  /** Keep raid/tempo/controlCall in sync so the UI always sees current values. */
  private syncDerivedFields(): void {
    const s = this.s;
    const r = difficulties[s.difficulty]?.raids;
    const callEarlyEnergy = 50;
    // Same switch as raidClock: no threat (the tutorial), no raids and no timer.
    const raids = !!r?.enabled && this.rules.threatEnabled !== false;
    const nextIn = raids ? Math.max(0, (s.raidAt ?? r!.firstAfterSeconds) - s.time) : Infinity;
    const activeRaiders = s.units.filter((u) => isEnemy(u) && u.raid !== undefined && u.hp > 0);
    const wasActive = s.raid?.active ?? false;
    s.raid = {
      nextIn,
      active: activeRaiders.length > 0,
      techs: [...new Set(activeRaiders.map((u) => u.tech).filter((t): t is Tech => t !== undefined))],
      callEarlyEnergy,
      canCallEarly: raids && nextIn > 0 && s.players.some((p) => p.energy >= callEarlyEnergy),
    };

    const tempoConf = (this.cfg as unknown as { tempo?: { raidClearEnergyBonus?: number; earlyRaidClearBonusMultiplier?: number; stagnantSeconds?: number; levelThresholds?: number[] } }).tempo;

    // Raid wave cleared: award energy bonus (doubled for early raids).
    if (wasActive && !s.raid.active) {
      const base = tempoConf?.raidClearEnergyBonus ?? 15;
      const mul = s.raidCalledEarly ? (tempoConf?.earlyRaidClearBonusMultiplier ?? 2) : 1;
      for (const p of s.players) if (p.alive) this.earn(p, base * mul);
      this.emit('raid_cleared', { amount: base * mul });
      this.addTempo(-1, 'raidClear');
      s.raidCalledEarly = undefined;
    }

    // Boss call: keep fork index if already set (from answerCall).
    if (s.boss.awake && !s.boss.dead) {
      if (!s.controlCall) s.controlCall = { id: s.boss.hero };
    } else {
      s.controlCall = null;
    }

    // Tempo stagnation and level.
    if (!s.tempo) s.tempo = { points: 0, level: 0, stagnant: false, lastProgress: s.time };
    const stagnantSec = tempoConf?.stagnantSeconds ?? 45;
    s.tempo.stagnant = s.time - (s.tempo.lastProgress ?? 0) > stagnantSec;
    const thresholds = tempoConf?.levelThresholds ?? [0, 25, 60, 120];
    let level = 0;
    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (s.tempo.points >= thresholds[i]) { level = i; break; }
    }
    if (s.tempo.level !== level) {
      s.tempo.level = level;
      if (level > 0) this.emit('tempo_level_up', { amount: level });
    }
  }

  /** Add tempo points for a progress event. */
  private addTempo(_owner: number, event: 'dig' | 'cache' | 'nest' | 'survivor' | 'raidClear' | 'wave'): void {
    const s = this.s;
    // No threat (the tutorial): «Темп» stays at 0, so the cascade wave stays 1 block deep (FEEL_AUDIT F-05).
    if (this.rules.threatEnabled === false) return;
    if (!s.tempo) s.tempo = { points: 0, level: 0, stagnant: false, lastProgress: s.time };
    const tempoConf = (this.cfg as unknown as { tempo?: { points?: Record<string, number> } }).tempo;
    const defaults: Record<string, number> = { dig: 1, cache: 5, nest: 10, survivor: 3, raidClear: 15, wave: 0.25 };
    const pts = tempoConf?.points?.[event] ?? defaults[event] ?? 1;
    s.tempo.points += pts;
    s.tempo.lastProgress = s.time;
  }

  /** The raid goes for the building nearest to it; the command center only when nothing else stands. */
  private raidTarget(x: number, y: number, _owner: number): string | undefined {
    const live = this.s.buildings.filter((b) => b.hp > 0 && this.s.players[b.owner]?.alive);
    const pool = live.some((b) => b.type !== 'command') ? live.filter((b) => b.type !== 'command') : live;
    const b = pool.sort((a, c) => dist(a.x, a.y, x, y) - dist(c.x, c.y, x, y))[0];
    return b ? `b:${b.id}` : undefined;
  }

  private overgrownAt(u: Unit): boolean {
    const x = Math.round(u.x);
    const y = Math.round(u.y);
    return inBounds(this.s, x, y) && (this.cell(x, y).overgrown ?? 0) > 0;
  }

  // -- combat

  private targetAlive(t: string | null | undefined): boolean {
    if (!t) return false;
    if (t.startsWith('u:')) {
      const u = this.unit(Number(t.slice(2)));
      return !!u && u.hp > 0;
    }
    if (t.startsWith('s:')) {
      const { x, y } = parseKey(t.slice(2));
      const site = this.site(x, y);
      return !!site && !site.destroyed && (site.kind === 'nest' || site.kind === 'heavy_nest');
    }
    if (t.startsWith('b:')) {
      const b = this.building(Number(t.slice(2)));
      return !!b && b.hp > 0;
    }
    return false;
  }

  targetPos(t: string): { x: number; y: number } {
    if (t.startsWith('u:')) return this.unit(Number(t.slice(2)))!;
    if (t.startsWith('s:')) return parseKey(t.slice(2));
    return this.building(Number(t.slice(2)))!;
  }



  private enemyAi(u: Unit, dt: number): void {
    const s = this.s;
    u.repathTimer -= dt;
    if (u.raid && !this.targetAlive(u.raid)) u.raid = this.raidTarget(u.x, u.y, u.owner);
    // The siren runs first: raiders gather at their exit and only strike back if someone hits them.
    if (u.holdUntil !== undefined) {
      if (u.raid && s.time < u.holdUntil) return;
      u.holdUntil = undefined;
    }
    if (u.raid) {
      if (u.target !== u.raid) u.path = [];
      u.target = u.raid;
    } else if (!this.targetAlive(u.target) || u.repathTimer <= 0) {
      // Nearest player unit or building; in FFA the Demon goes for the nearest center (multiplayer.json demonTarget).
      let best: string | undefined;
      let bestD = Infinity;
      const centers = u.kind === 'hero' && u.hero === s.boss.hero && this.ffa ? s.buildings.filter((b) => b.type === 'command') : [];
      for (const b of centers) {
        const d = dist(b.x, b.y, u.x, u.y);
        if (d < bestD) [best, bestD] = [`b:${b.id}`, d];
      }
      if (centers.length) bestD = -1;
      for (const o of s.units) {
        if (isEnemy(o) || o.hp <= 0) continue;
        const d = dist(o.x, o.y, u.x, u.y);
        if (d < bestD) [best, bestD] = [`u:${o.id}`, d];
      }
      for (const b of s.buildings) {
        const d = dist(b.x, b.y, u.x, u.y);
        if (d < bestD) [best, bestD] = [`b:${b.id}`, d];
      }
      if (best !== u.target) u.path = [];
      u.target = best;
    }
    if (!u.target) return;
    if (u.kind === 'hero' && this.heroAbility(u, dt)) return;
    const flying = u.kind === 'hero' && !!heroDefs[u.hero!].enemy.flying;
    this.fight(u, u.target, dt, (x, y) => walkableForEnemy(s, x, y, flying));
  }

  /** Walk into range of the target and hit it on cooldown. */
  private fight(u: Unit, target: string, dt: number, walkable: (x: number, y: number) => boolean): void {
    const st = this.stats(u);
    u.attackCooldown = Math.max(0, u.attackCooldown - dt);
    const tp = this.targetPos(target);
    const reach = target.startsWith('u:') ? st.range + 0.5 : 1.5;
    if (dist(tp.x, tp.y, u.x, u.y) <= reach) {
      u.path = [];
      u.target = target;
      if (u.attackCooldown <= 0) {
        u.attackCooldown = st.attackSeconds;
        this.hit(u, target);
      }
      return;
    }
    if (u.target !== target || u.path.length === 0 || u.repathTimer <= 0) {
      u.target = target;
      u.repathTimer = 0.5;
      const s = this.s;
      // A target out on unopened ground: get as close as the opened cells allow and meet it there.
      const path = findPath(s.width, s.height, { x: Math.round(u.x), y: Math.round(u.y) }, walkable, (x, y) => dist(x, y, tp.x, tp.y) <= reach, {
        x: Math.round(tp.x),
        y: Math.round(tp.y),
      });
      u.path = path ? path.slice(1) : [];
    }
    this.move(u, dt);
  }

  private hit(attacker: Unit, target: string, factor = 1, primary = true): void {
    const st = this.stats(attacker);
    this.lastCombat = this.s.time;
    // Super strike (§17.5): fires on next attack after 10 kills, resets charge.
    if (
      attacker.superCharge === 100 &&
      (attacker.kind === 'ally' || attacker.kind === 'hero') &&
      target.startsWith('u:')
    ) {
      attacker.superCharge = 0;
      const v = this.unit(Number(target.slice(2)));
      if (v && v.hp > 0) {
        if (v.kind === 'hero') {
          const isBossTarget = v.hero === this.s.boss.hero;
          const fraction = isBossTarget ? 0.15 : 0.30;
          const superDmg = Math.ceil(this.maxHp(v) * fraction);
          this.damage(v, superDmg, attacker);
          // Tear off one mutation limb (§17.5 + §4.1а).
          if (v.mutations && v.mutations.length > 0) {
            const torn = v.mutations.splice(0, 1)[0];
            v.base = { ...v.base, defense: Math.max(0, (v.base?.defense ?? 0) - 1) };
            this.emit('enemy_limb_lost', { x: v.x, y: v.y, owner: attacker.owner, text: `${v.hero}:${torn.slot}` });
          }
        } else {
          // Regular enemy: instant kill.
          this.damage(v, v.hp + 999, attacker);
        }
        this.emit('super_strike', { x: v.x, y: v.y, owner: attacker.owner, unit: attacker.id });
      }
      return;
    }
    if (target.startsWith('s:')) {
      const { x, y } = parseKey(target.slice(2));
      const site = this.site(x, y)!;
      const def = this.siteDef(site.kind).defense ?? 0;
      site.hp -= Math.max(this.cfg.combat.minDamage, st.damage * factor - def);
      this.emit('hit', { x, y, text: this.attackOf(attacker).tech, unit: attacker.id });
      if (site.hp <= 0) this.destroySite(site, attacker);
      return;
    }
    if (target.startsWith('b:')) {
      const b = this.building(Number(target.slice(2)))!;
      if (b.type === 'command' && this.rules.commandInvulnerable) return;
      const vs = attacker.kind === 'hero' ? buildingDamage.heroVsBuildingFactor : isEnemy(attacker) ? buildingDamage.enemyVsBuildingFactor : 1;
      let rawDmg = Math.max(this.cfg.combat.minDamage, st.damage * factor * vs - buildingDefs[b.type].defense);
      // F-03: cap hero DPS on buildings (FEEL_AUDIT §3): ≤3.3% cmd HP/s, ≤6% other HP/s.
      if (attacker.kind === 'hero') {
        const capFraction = b.type === 'command' ? 0.033 : 0.06;
        const maxDmg = capFraction * buildingDefs[b.type].hp * this.stats(attacker).attackSeconds;
        rawDmg = Math.min(rawDmg, Math.max(this.cfg.combat.minDamage, maxDmg));
      }
      b.hp -= rawDmg;
      if (b.type === 'command') this.emit('center_hit', { x: b.x, y: b.y, owner: b.owner });
      return;
    }
    const v = this.unit(Number(target.slice(2)))!;
    const { tech, tier } = this.attackOf(attacker, v);
    // Reactions (ELEMENTS.md §3) look at the status the target already carries.
    let reaction: string | undefined;
    if (primary && tech !== 'kinetic') {
      const has = (status: string) =>
        (status === 'burn' && !!v.burn) || (status === 'chill' && (!!v.slow || (v.chill ?? 0) > 0)) || (status === 'poison' && !!v.poison);
      reaction = elements.reactions.find((r) => r.hitTech === tech && has(r.onTargetStatus))?.id;
    }
    const baseResist = this.resistOf(v, tech);
    let mul = baseResist * factor;
    // Досье на цель (boons.json weak_spot): residents hit the call target harder.
    if (attacker.owner >= 0 && v.kind === 'hero' && v.hero === this.s.boss.hero) mul *= this.boonFactor(attacker.owner, 'weak_spot');
    if (reaction === 'thermoshock') {
      mul *= 1 + Number(elements.reactions.find((r) => r.id === reaction)!.effect.bonusDamageFactor ?? 1);
      v.burn = undefined;
    }
    const dmg = Math.max(this.cfg.combat.minDamage, st.damage * mul - this.stats(v).defense);
    this.damage(v, dmg, attacker);
    const kind = reaction ? 'reaction' : baseResist >= 1.5 ? 'weak' : baseResist <= 0.8 ? 'resist' : 'neutral';
    this.emit('hit', { x: v.x, y: v.y, tech, unit: attacker.id, victim: v.owner, amount: Math.round(dmg), mult: Math.round(baseResist * 100) / 100, kind });
    if (reaction) this.emit('reaction', { x: v.x, y: v.y, text: reaction, tech });
    if (!primary || v.hp <= 0) return;
    const heal = Object.values(attacker.parts).reduce((n, p) => n + (p ? partTier(p.id, p.tier).healSelfOnHit ?? 0 : 0), 0);
    if (heal) {
      attacker.hp = Math.min(this.maxHp(attacker), attacker.hp + heal);
      this.emit('heal', { x: attacker.x, y: attacker.y, amount: Math.round(heal), unit: attacker.id });
    }
    this.applyStatus(attacker, v, tech, tier, reaction);
    for (const part of Object.values(attacker.parts)) {
      if (!part) continue;
      const t = partTier(part.id, part.tier);
      if (t.splashRadius) this.splash(attacker, v, t.splashRadius, t.splashFactor ?? 0.5, Infinity);
    }
  }

  /** The element's status effect on a hit (elements.json statuses, by the attack's part tier). */
  private applyStatus(attacker: Unit, v: Unit, tech: AttackTech, tier: number, reaction?: string): void {
    if (tech === 'kinetic' || tier <= 0) return;
    const st = elements.statuses;
    const i = Math.min(3, tier) - 1;
    const resist = this.resistOf(v, tech);
    switch (tech) {
      case 'thermo': {
        let dps = st.burn.dpsByTier[i] * resist;
        if (reaction === 'burnout') {
          dps *= 2;
          v.poison = undefined;
        }
        v.burn = { dps, left: st.burn.seconds, source: attacker.id };
        if (reaction === 'shell_break') v.bare = 3;
        return;
      }
      case 'cryo': {
        v.slow = { percent: st.chill.slowPercentByTier[i] * resist, left: st.chill.seconds };
        v.chill = (v.chill ?? 0) + 1;
        if (v.chill >= st.chill.freezeAtStacks) {
          v.chill = 0;
          v.stun = st.chill.freezeSeconds;
          this.emit('frozen', { x: v.x, y: v.y, unit: v.id });
        }
        return;
      }
      case 'volt': {
        const extra = reaction === 'conductive_chain' ? 2 : 0;
        if (reaction === 'neuro_fail') v.stun = 1;
        this.splash(attacker, v, st.shock.chainRange, st.shock.chainFactor, st.shock.chainTargetsByTier[i] + extra);
        return;
      }
      case 'toxin':
        v.poison = { dps: st.poison.dpsByTier[i] * resist, left: st.poison.seconds, defense: st.poison.defenseMinusByTier[i], source: attacker.id };
        if (reaction === 'shell_break') v.bare = 3;
        return;
      case 'impact':
        if (reaction === 'shell_break') v.bare = 3;
        if (rand(this.s) < st.stagger.interruptChanceByTier[i] * resist) v.attackCooldown += this.stats(v).attackSeconds * 0.5;
        return;
    }
  }

  private splash(attacker: Unit, around: Unit, radius: number, factor: number, max: number): void {
    const hostile = (o: Unit) => o !== around && o.hp > 0 && this.hostile(o.owner, attacker.owner);
    const near = this.s.units
      .filter((o) => hostile(o) && dist(o.x, o.y, around.x, around.y) <= radius)
      .sort((a, b) => dist(a.x, a.y, around.x, around.y) - dist(b.x, b.y, around.x, around.y))
      .slice(0, max);
    for (const o of near) this.hit(attacker, `u:${o.id}`, factor, false);
  }

  private damage(v: Unit, amount: number, by?: Unit): void {
    if (v.hp <= 0) return;
    if (!isEnemy(v)) {
      amount *= this.allyGuard(v);
      const p = this.s.players[v.owner];
      if (p?.resistUntil !== undefined && this.s.time < p.resistUntil) amount *= hazards.bonusCapsule.pool.damage_resist?.heroesDamageTakenFactor ?? 1;
    }
    v.hp -= amount;
    // Raiders keep to the buildings until a resident hits them (raidRules.raidersPreferBuildings).
    if (v.raid && by && !isEnemy(by)) {
      v.raid = undefined;
      v.holdUntil = undefined;
      v.target = `u:${by.id}`;
      v.path = [];
    }
    if (by && !isEnemy(by) && v.kind === 'hero') {
      v.dealt ??= {};
      v.dealt[by.id] = (v.dealt[by.id] ?? 0) + amount;
    }
    if (v.hp <= 0) this.kill(v, by);
  }

  private kill(v: Unit, by?: Unit): void {
    const s = this.s;
    v.hp = 0;
    if (v.kind === 'ally') {
      // An ally is knocked out, not lost: it is back at the center after a while.
      const p = s.players[v.owner];
      (p.allyBack ??= {})[v.hero!] = s.time + ALLY.respawnSeconds;
      // Armor plates: lose 1 on knockout (enemies.json armorPlate.lostOnKnockout).
      if (v.armorPlates && v.armorPlates > 0) {
        const lost = Math.min(v.armorPlates, armorPlateDef.lostOnKnockout);
        v.armorPlates -= lost;
        v.base = { ...v.base, defense: Math.max(0, v.base.defense - lost * armorPlateDef.defenseAdd) };
      }
      // Knockout tears off one limb (MVP_RULES §4.1а): a trophy first, else the hero's own (arm -20% damage, leg -25% speed).
      const parts = { ...v.parts };
      const lostLimbs = [...(v.lostLimbs ?? [])];
      const trophy = (Object.keys(parts) as SlotId[]).find((sl) => parts[sl]);
      if (trophy) {
        delete parts[trophy];
        this.emit('ally_limb_lost', { x: v.x, y: v.y, owner: v.owner, unit: v.id, text: `${v.hero}:${trophy}` });
      } else if (lostLimbs.length < 4) {
        const slot: 'arm' | 'leg' = lostLimbs.filter((l) => l === 'arm').length < 2 ? 'arm' : 'leg';
        lostLimbs.push(slot);
        this.emit('ally_limb_lost', { x: v.x, y: v.y, owner: v.owner, unit: v.id, text: `${v.hero}:${slot}` });
      }
      (p.allyScars ??= {})[v.hero!] = { parts, lostLimbs, armorPlates: v.armorPlates ?? 0 };
      this.emit('ally_down', { x: v.x, y: v.y, owner: v.owner, unit: v.id, text: v.hero });
      return;
    }
    if (v.kind === 'resident') {
      s.players[v.owner].stats.lost++;
      this.setTask(v, { type: 'idle' });
      this.emit('resident_die', { x: v.x, y: v.y, owner: v.owner, unit: v.id });
      // PvP: the killer takes the strongest part (multiplayer.json pvpPartSteal).
      if (by && !isEnemy(by)) {
        const best = Object.values(v.parts).sort((a, b) => (b?.tier ?? 0) - (a?.tier ?? 0))[0];
        if (best) this.takePart(by, best);
      }
      return;
    }
    // Enemy.
    if (by) {
      by.kills++;
      const superPerKill = (this.cfg as unknown as { tempo?: { superChargePerKill?: number } }).tempo?.superChargePerKill ?? 10;
      if ((by.kind === 'ally' || by.kind === 'hero') && by.kills % superPerKill === 0) {
        by.superCharge = 100;
        this.emit('super_charged', { unit: by.id, owner: by.owner });
      }
    }
    const site = v.nest ? s.sites.find((t) => siteKey(t.x, t.y) === v.nest) : undefined;
    if (site) site.alive = site.alive.filter((id) => id !== v.id);
    const killer = by && !isEnemy(by) ? by : undefined;
    if (v.kind === 'hero') return this.heroDown(v, killer, site);
    const def = this.enemyDef(v.kind);
    const part = Object.values(v.parts)[0];
    if (killer && !isEnemy(killer) && part && rand(s) < def.partDropChance) this.takePart(killer, part);
    if (def.reward && killer) this.earn(s.players[killer.owner], def.reward);
    this.emit('enemy_die', { x: v.x, y: v.y, owner: killer?.owner, text: v.kind === 'adaptant' ? `adaptant_${v.tech ?? 'thermo'}` : v.kind });
  }

  /** A hero falls: when the last copy is down, two parts and the reward go to the residents (MVP_RULES §8). */
  private heroDown(v: Unit, killer: Unit | undefined, site: SiteState | undefined): void {
    const s = this.s;
    const hero = heroDefs[v.hero!];
    this.emit('enemy_die', { x: v.x, y: v.y, owner: killer?.owner, text: hero.id });
    if (site && site.alive.length > 0) return;
    if (site) {
      site.destroyed = true;
      this.cell(site.x, site.y).resolved = true;
      this.rev++;
    }
    const owner = killer?.owner ?? 0;
    if (killer) {
      const [arm, second] = [hero.drops.find((d) => d.slot === 'arm'), hero.drops.find((d) => d.slot !== 'arm')];
      if (arm) this.takePart(killer, { id: arm.id, tier: partTier(arm.id, 3).tier }, hero.id);
      // The second part: whoever dealt the most damage after the killer (or the killer, alone).
      const runnerUp = Object.entries(v.dealt ?? {})
        .map(([id, n]) => ({ u: this.unit(Number(id)), n }))
        .filter((r) => r.u && r.u.hp > 0 && r.u !== killer && r.u.owner === killer.owner)
        .sort((a, b) => b.n - a.n)[0]?.u;
      if (second) this.takePart(runnerUp ?? killer, { id: second.id, tier: partTier(second.id, 3).tier }, hero.id);
      this.earn(s.players[owner], hero.enemy.reward);
    }
    for (const p of s.players) if (!p.stats.heroes.includes(hero.id) && p.alive) p.stats.heroes.push(hero.id);
    this.emit('hero_defeated', { x: v.x, y: v.y, owner, text: hero.id, amount: hero.enemy.reward });
    if (site?.kind === 'boss_hatch') {
      s.boss.dead = true;
      this.emit('boss_dead', { x: v.x, y: v.y, text: hero.id });
    }
  }

  /** MVP_RULES §8.1: free slot → weakest same-type if strictly better → recycle. */
  private takePart(u: Unit, part: PartInstance, fromHero?: string): void {
    const kind = partDefs[part.id].slot;
    const slots = RESIDENT_SLOTS.filter((sl) => sl.startsWith(kind));
    const free = slots.find((sl) => !u.parts[sl]);
    let slot: SlotId | undefined = free;
    if (!slot) {
      const weakest = [...slots].sort((a, b) => u.parts[a]!.tier - u.parts[b]!.tier)[0];
      if (weakest && u.parts[weakest]!.tier < part.tier) slot = weakest;
    }
    if (!slot) {
      const amount = Math.round(this.cfg.economy.partRecycleEnergyPerTier * part.tier * this.allyFactor(u.owner, 'partRecycleFactor'));
      this.spawnOrb(u.owner, Math.round(u.x), Math.round(u.y), amount);
      this.emit('part_recycled', { x: u.x, y: u.y, owner: u.owner, amount, text: part.id });
      return;
    }
    const before = this.stats(u).hp;
    u.parts[slot] = { ...part };
    // A part on a stumped slot type replaces the lost limb.
    const stump = u.lostLimbs?.indexOf(kind as 'arm' | 'leg') ?? -1;
    if (stump >= 0) {
      u.lostLimbs!.splice(stump, 1);
      if (!u.lostLimbs!.length) u.lostLimbs = undefined;
      u.base = kind === 'arm' ? { ...u.base, damage: Math.round(u.base.damage / 0.8) } : { ...u.base, speed: Math.round((u.base.speed / 0.75) * 10) / 10 };
    }
    u.hp += Math.max(0, this.stats(u).hp - before);
    this.s.players[u.owner].stats.parts++;
    this.emit(fromHero ? 'hero_part_taken' : 'part_attached', { x: u.x, y: u.y, owner: u.owner, unit: u.id, text: part.id });
  }

  private effects(u: Unit, dt: number): void {
    if (u.stun) u.stun = Math.max(0, u.stun - dt) || undefined;
    if (u.bare) u.bare = Math.max(0, u.bare - dt) || undefined;
    if (u.slow) {
      u.slow.left -= dt;
      if (u.slow.left <= 0) {
        u.slow = undefined;
        u.chill = 0;
      }
    }
    if (u.burn) {
      u.burn.left -= dt;
      this.damage(u, u.burn.dps * dt, this.unit(u.burn.source));
      if (u.burn && u.burn.left <= 0) u.burn = undefined;
    }
    if (u.poison && u.hp > 0) {
      u.poison.left -= dt;
      this.damage(u, u.poison.dps * dt, this.unit(u.poison.source));
      if (u.poison && u.poison.left <= 0) u.poison = undefined;
    }
    const regen = Object.values(u.parts).reduce((n, p) => n + (p ? partTier(p.id, p.tier).regenPerSec ?? 0 : 0), 0);
    if (regen && u.hp > 0) u.hp = Math.min(this.maxHp(u), u.hp + regen * dt);
  }

  // -- nests

  private openNest(x: number, y: number, c: Cell): void {
    const kind = c.content as 'nest' | 'heavy_nest';
    const def = this.siteDef(kind);
    const site: SiteState = { x, y, kind, hp: def.hp!, maxHp: def.hp!, spawnTimer: this.spawnInterval(kind), alive: [], destroyed: false };
    this.s.sites.push(site);
    const first = this.byThreat(def.initialSpawnByThreat)?.count ?? def.initialSpawn ?? 0;
    for (let i = 0; i < first; i++) this.spawnEnemy(site);
    // amount 1: opened on purpose after the confirm (meta accidental_opens counts the rest).
    this.emit(kind === 'heavy_nest' ? 'heavy_nest_open' : 'nest_open', { x, y, text: c.tech, amount: c.deliberate ? 1 : 0 });
    this.startRally(x, y);
  }

  /** The row of a `fromLevel` table that applies at the current threat level. */
  private byThreat<T extends { fromLevel: number }>(rows: T[] | undefined): T | undefined {
    const L = this.threatLevel;
    return rows ? [...rows].reverse().find((r) => L >= r.fromLevel) : undefined;
  }

  private maxAlive(kind: SiteState['kind']): number {
    const def = this.siteDef(kind);
    return this.byThreat(def.spawnByThreat)?.maxAlive ?? def.maxAlive ?? 0;
  }

  private spawnInterval(kind: SiteState['kind']): number {
    const def = this.siteDef(kind);
    if (def.respawnAfterDeathSeconds) return def.respawnAfterDeathSeconds;
    const row = this.byThreat(def.spawnByThreat);
    if (row) return Math.max(this.cfg.threat.minSpawnInterval, row.spawnSeconds);
    if (!def.spawnSeconds) return Infinity;
    const t = this.cfg.threat;
    return Math.max(t.minSpawnInterval, def.spawnSeconds * Math.pow(t.spawnIntervalFactorPerLevel, this.threatLevel));
  }

  private nests(dt: number): void {
    for (const site of this.s.sites) {
      if (site.destroyed || (site.kind !== 'nest' && site.kind !== 'heavy_nest')) continue;
      if (site.rush) site.rush = Math.max(0, site.rush - dt) || undefined;
      const def = this.siteDef(site.kind);
      if (site.alive.length >= this.maxAlive(site.kind)) {
        if (def.respawnAfterDeathSeconds) site.spawnTimer = def.respawnAfterDeathSeconds;
        continue;
      }
      site.spawnTimer -= dt * (site.rush ? 2 : 1);
      if (site.spawnTimer <= 0) {
        site.spawnTimer = this.spawnInterval(site.kind);
        this.spawnEnemy(site);
      }
    }
  }

  /** Threat scaling of enemy stats (MVP_RULES §9.5). */
  private scaled(e: UnitStats, hpScale = 1): UnitStats {
    const L = this.threatLevel;
    const t = this.cfg.threat;
    const d = this.difficulty;
    return {
      hp: e.hp * (1 + t.hpPerLevel * L) * hpScale * d.enemyHpFactor,
      damage: e.damage * (1 + t.damagePerLevel * L) * d.enemyDamageFactor,
      defense: e.defense,
      attackSeconds: e.attackSeconds,
      range: e.range ?? 1,
      speed: e.speed,
    };
  }

  private spawnEnemy(site: SiteState): Unit | null {
    const s = this.s;
    const def = this.siteDef(site.kind);
    const kind = def.spawns as UnitKind;
    const e = this.enemyDef(kind);
    const budget = (def as { totalBudget?: number }).totalBudget;
    if (budget !== undefined && (site.spawned ?? 0) >= budget) return null;
    const spots = neighbors(s, site.x, site.y).filter((n) => walkableForEnemy(s, n.x, n.y));
    if (spots.length === 0) return null;
    site.spawned = (site.spawned ?? 0) + 1;
    const spot = spots[randIntOf(s, spots.length)];
    const u = this.newUnit(kind, -1, spot.x, spot.y, this.scaled(e));
    u.nest = siteKey(site.x, site.y);
    const tech = this.cell(site.x, site.y).tech;
    u.tech = tech;
    u.attackTech = (e.attackTech === 'fromNest' ? tech : e.attackTech) as AttackTech | undefined;
    const part = this.enemyPart(kind, tech);
    if (part) {
      const slot: SlotId = partDefs[part.id].slot === 'arm' ? 'arm_right' : partDefs[part.id].slot === 'leg' ? 'leg_left' : 'tail';
      u.parts[slot] = part;
      u.hp = this.stats(u).hp;
    }
    site.alive.push(u.id);
    this.emit('enemy_spawn', { x: spot.x, y: spot.y, text: kind === 'adaptant' ? `adaptant_${tech ?? 'thermo'}` : kind, unit: u.id });
    return u;
  }

  private enemyPart(kind: UnitKind, tech: string | undefined): PartInstance | null {
    const p = this.enemyDef(kind).part;
    if (p.fixed) return { id: p.fixed, tier: partDefs[p.fixed].tiers[0].tier };
    const L = this.threatLevel;
    const byLevel = [...config.threat.partTierByLevel].reverse().find((r) => L >= r.fromLevel)?.tier ?? 1;
    const tier = Math.min(3, byLevel + (p.tierOffset ?? 0));
    const arm = rand(this.s) < (p.slotWeights?.arm ?? 1);
    const id = arm ? (p.armByTech ? p.armByTech.replace('<tech>', tech ?? 'thermo') : p.arm) : p.leg;
    return id && partDefs[id] ? { id, tier } : null;
  }

  private destroySite(site: SiteState, by: Unit): void {
    if (site.destroyed) return;
    site.destroyed = true;
    this.rev++;
    const c = this.cell(site.x, site.y);
    c.resolved = true;
    const reward = this.siteDef(site.kind).reward ?? 0;
    if (by.owner >= 0) {
      this.earn(this.s.players[by.owner], reward);
      this.s.players[by.owner].stats.nests++;
      this.addTempo(by.owner, 'nest');
    }
    for (const p of this.s.players) if (p.order === siteKey(site.x, site.y)) p.order = null;
    this.emit('nest_destroyed', { x: site.x, y: site.y, owner: by.owner, amount: reward });
  }

  // -- heroes

  /** An opened lair or hatch releases its hero (Standard comes as three copies). */
  private openHeroSite(x: number, y: number, kind: 'hero_lair' | 'boss_hatch', heroId: string): void {
    const s = this.s;
    if (this.site(x, y)) return;
    const site: SiteState = { x, y, kind, hp: 0, maxHp: 0, spawnTimer: Infinity, alive: [], destroyed: false };
    s.sites.push(site);
    const hero = heroDefs[heroId];
    const copies = hero.enemy.ability.id === 'serial_copies' ? HERO_ABILITY.serial_copies.count! : 1;
    const hpScale = (kind === 'boss_hatch' ? s.boss.hpScale : 1) / copies;
    const flying = !!hero.enemy.flying;
    const spots = [{ x, y }, ...neighbors(s, x, y)].filter((n) => walkableForEnemy(s, n.x, n.y, flying));
    for (let i = 0; i < copies; i++) {
      const spot = spots[i % Math.max(1, spots.length)] ?? { x, y };
      const u = this.newUnit('hero', -1, spot.x, spot.y, this.scaled({ ...hero.enemy, range: 1 }, hpScale));
      u.hero = heroId;
      u.attackTech = hero.enemy.attackTech;
      u.abilityCd = HERO_ABILITY[hero.enemy.ability.id]?.every ?? Infinity;
      u.nest = siteKey(x, y);
      // Mutations (MVP_RULES §9.9): roll 1–2 random limbs with random elements.
      const tier = kind === 'boss_hatch' ? 4 : (this.cell(x, y).heroTier ?? 1);
      const mutCount = heroRules.enemyMutations.countByTier[String(tier)] ?? 1;
      const heroTech = hero.tech as Tech | undefined;
      const mutEl = (): Tech => {
        const pool = heroRules.enemyMutations.elementPool;
        if (heroTech && rand(this.s) < heroRules.enemyMutations.otherThanOwnTechChance) {
          const other = pool.filter((t) => t !== heroTech);
          return other[randIntOf(this.s, other.length)];
        }
        return pool[randIntOf(this.s, pool.length)];
      };
      const firstEl = mutEl();
      const useSameEl = mutCount > 1 && rand(this.s) < heroRules.enemyMutations.sameElementForAllMutationsChance;
      const mutations: { slot: SlotId; tech: Tech }[] = [];
      const slotPool = [...heroRules.enemyMutations.slots]; // 'arm'|'leg' base kinds
      for (let m = 0; m < mutCount; m++) {
        const si = randIntOf(this.s, slotPool.length);
        const [slotBase] = slotPool.splice(si, 1);
        // Expand 'arm'/'leg' to a full SlotId that isn't already taken.
        const isArm = slotBase === 'arm';
        const slotId: SlotId = isArm
          ? (mutations.some((mt) => mt.slot === 'arm_left') ? 'arm_right' : 'arm_left')
          : (mutations.some((mt) => mt.slot === 'leg_left') ? 'leg_right' : 'leg_left');
        const tech = m === 0 ? firstEl : (useSameEl ? firstEl : mutEl());
        mutations.push({ slot: slotId, tech });
      }
      u.mutations = mutations;
      // Apply mutation bonuses: +1 defense and +10 hp per mutation limb.
      const mutDefense = mutations.length;
      const mutHp = mutations.length * 10;
      u.base = { ...u.base, defense: u.base.defense + mutDefense };
      u.hp = Math.min(u.hp + mutHp, this.maxHp(u) + mutHp);
      site.alive.push(u.id);
    }
    this.cell(x, y).revealed = true;
    this.rev++;
    // amount 1 marks the call target (its own boss_awake toast follows).
    this.emit('hero_spawn', { x, y, text: heroId, amount: kind === 'boss_hatch' ? 1 : 0 });
    if (kind === 'boss_hatch') this.emit('boss_awake', { x, y, text: heroId });
    this.startRally(x, y);
  }

  /** Unopened lairs open by themselves at threat levels 2/4/6 (heroes.json lairSelfOpenThreatLevels). */
  private heroClock(): void {
    if (this.rules.threatEnabled === false) return;
    const levels = this.difficulty.lairSelfOpenThreatLevels ?? heroRules.lairSelfOpenThreatLevels;
    const per = this.cfg.threat.secondsPerLevel;
    this.s.cells.forEach((c, i) => {
      if (c.content !== 'hero_lair' || c.revealed || !c.heroTier) return;
      const at = (levels[c.heroTier - 1] ?? Infinity) * per;
      const x = i % this.s.width;
      const y = Math.floor(i / this.s.width);
      if (!c.warned && this.s.time >= at - 30) {
        c.warned = true;
        this.emit('hero_warning', { x, y, text: c.hero });
      }
      if (this.s.time >= at) this.openHeroSite(x, y, 'hero_lair', c.hero!);
    });
  }

  /** The call target leaves its hatch by itself at 15:00, after a warning (config.boss).
   *  Also wakes early (with a 20 s warning) when ≤15% of non-site cells are still closed
   *  or every nest/lair site has been destroyed (F-09, FEEL_AUDIT). */
  private bossClock(): void {
    const b = this.s.boss;
    if (b.awake || this.rules.bossEnabled === false) return;
    const s = this.s;

    // F-09: early wake when the board is nearly fully open or all nests/lairs are cleared.
    if (!b.earlyWakeAt) {
      const earlyWake = this.earlyWakeCondition();
      if (earlyWake) {
        b.earlyWakeAt = s.time + 20;
        if (!b.warned) {
          b.warned = true;
          this.emit('boss_warning', { text: b.hero });
        }
      }
    }
    if (b.earlyWakeAt && s.time >= b.earlyWakeAt) {
      this.wakeBoss();
      return;
    }

    const wake = this.cfg.boss.selfWakeSeconds;
    if (!b.warned && s.time >= wake - this.cfg.boss.warningSeconds) {
      b.warned = true;
      this.emit('boss_warning', { text: b.hero });
    }
    if (s.time >= wake) this.wakeBoss();
  }

  /** Returns true when the field is ≤15% closed (non-site cells) or all nests/lairs are gone. */
  private earlyWakeCondition(): boolean {
    const s = this.s;
    // All nests and hero lairs destroyed (boss hatch excluded — that's the target itself).
    const activeSites = s.sites.filter(
      (st) => !st.destroyed && (st.kind === 'nest' || st.kind === 'heavy_nest' || st.kind === 'hero_lair'),
    );
    if (activeSites.length === 0 && s.sites.some((st) => st.kind === 'nest' || st.kind === 'heavy_nest' || st.kind === 'hero_lair')) {
      return true;
    }
    // ≤15% of ground-type cells still closed.
    const groundCells = s.cells.filter((c) => c.content === 'ground' || c.content === 'rubble' || c.content === 'energy_vein');
    if (groundCells.length === 0) return false;
    const closedCount = groundCells.filter((c) => !c.revealed).length;
    return closedCount / groundCells.length <= 0.15;
  }

  private wakeBoss(): void {
    const s = this.s;
    if (s.boss.awake) return;
    const i = s.cells.findIndex((c) => c.content === 'boss_hatch');
    if (i < 0) return;
    s.boss.awake = true;
    this.openHeroSite(i % s.width, Math.floor(i / s.width), 'boss_hatch', s.boss.hero);
  }

  /** Hero abilities (HERO_ABILITY). Returns true while the ability holds the hero in place. */
  private heroAbility(u: Unit, dt: number): boolean {
    const s = this.s;
    const hero = heroDefs[u.hero!];
    const id = hero.enemy.ability.id;
    const a = HERO_ABILITY[id];
    if (!a) return false;
    if (id === 'steam_blast') return this.steamBlast(u, dt);
    if (id === 'orb_thief') {
      // Passive: Patch snatches energy orbs flying past.
      s.orbs = s.orbs.filter((o) => {
        if (dist(o.x, o.y, u.x, u.y) > a.range) return true;
        this.emit('orb_stolen', { x: o.x, y: o.y, owner: o.owner, amount: o.amount });
        return false;
      });
      return false;
    }
    u.abilityCd = (u.abilityCd ?? a.every) - dt;
    if (u.abilityCd > 0) return false;
    const foes = s.units
      .filter((o) => !isEnemy(o) && o.hp > 0 && dist(o.x, o.y, u.x, u.y) <= a.range)
      .sort((p, q) => dist(p.x, p.y, u.x, u.y) - dist(q.x, q.y, u.x, u.y));
    const allies = s.units.filter((o) => isEnemy(o) && o !== u && o.hp > 0 && dist(o.x, o.y, u.x, u.y) <= a.range);
    let fired = true;
    const away = (o: Unit, tiles: number) => {
      const d = dist(o.x, o.y, u.x, u.y) || 1;
      const nx = Math.round(o.x + ((o.x - u.x) / d) * tiles);
      const ny = Math.round(o.y + ((o.y - u.y) / d) * tiles);
      if (walkableForPlayer(s, nx, ny)) {
        o.x = nx;
        o.y = ny;
        o.path = [];
      }
    };
    switch (id) {
      case 'overgrowth': {
        const cells = [];
        for (let y = Math.round(u.y) - a.range; y <= Math.round(u.y) + a.range; y++)
          for (let x = Math.round(u.x) - a.range; x <= Math.round(u.x) + a.range; x++)
            if (inBounds(s, x, y) && this.cell(x, y).revealed && this.cell(x, y).content === 'ground') cells.push({ x, y });
        for (let i = 0; i < a.count! && cells.length; i++) {
          const c = cells.splice(randIntOf(s, cells.length), 1)[0];
          this.cell(c.x, c.y).overgrown = a.seconds;
        }
        break;
      }
      case 'water_jet':
        if (!foes.length) fired = false;
        for (const o of foes) {
          away(o, 1);
          o.burn = undefined;
          this.damage(o, a.amount! * this.resistOf(o, 'cryo'), u);
        }
        break;
      case 'cable_pull': {
        const o = foes.filter((f) => dist(f.x, f.y, u.x, u.y) > 1.5).at(-1);
        if (!o) {
          fired = false;
          break;
        }
        const d = dist(o.x, o.y, u.x, u.y);
        const nx = Math.round(u.x + (o.x - u.x) / d);
        const ny = Math.round(u.y + (o.y - u.y) / d);
        if (walkableForPlayer(s, nx, ny)) [o.x, o.y] = [nx, ny];
        o.path = [];
        o.stun = a.seconds;
        break;
      }
      case 'cryo_kick':
        if (!foes.length) fired = false;
        for (const o of foes) {
          this.damage(o, a.amount! * this.resistOf(o, 'cryo'), u);
          for (let i = 0; i < a.count!; i++) this.applyStatus(u, o, 'cryo', 2);
        }
        break;
      case 'barricade': {
        const spots = s.cells
          .map((c, i) => ({ c, x: i % s.width, y: Math.floor(i / s.width) }))
          .filter(({ c, x, y }) => c.revealed && c.content === 'ground' && c.building === undefined && dist(x, y, u.x, u.y) <= a.range && !s.units.some((o) => Math.round(o.x) === x && Math.round(o.y) === y));
        const pick = spots[spots.length ? randIntOf(s, spots.length) : 0];
        if (!pick) {
          fired = false;
          break;
        }
        pick.c.content = 'rubble';
        pick.c.stock = a.amount;
        this.rev++;
        break;
      }
      case 'steam_clean':
        if (!foes.length) fired = false;
        for (const o of foes) o.burn = { dps: a.amount! * this.resistOf(o, 'thermo'), left: a.seconds!, source: u.id };
        break;
      case 'alarm_flare':
        for (const t of s.sites) if (!t.destroyed && (t.kind === 'nest' || t.kind === 'heavy_nest') && dist(t.x, t.y, u.x, u.y) <= a.range) t.rush = a.seconds;
        break;
      case 'drone_swarm':
        if (!foes.length) fired = false;
        for (const o of foes.slice(0, a.count)) this.applyStatus(u, o, 'toxin', 2);
        break;
      case 'ram_charge': {
        const t = u.target?.startsWith('u:') ? this.unit(Number(u.target.slice(2))) : undefined;
        const d = t ? dist(t.x, t.y, u.x, u.y) : Infinity;
        if (!t || d > a.range || d < 1.2) {
          fired = false;
          break;
        }
        u.x = t.x - (t.x - u.x) / d;
        u.y = t.y - (t.y - u.y) / d;
        u.path = [];
        this.damage(t, Math.max(1, a.amount! * this.resistOf(t, 'impact') - this.stats(t).defense), u);
        if (t.hp > 0) away(t, 1);
        break;
      }
      case 'halo_heal':
        if (!allies.length) fired = false;
        for (const o of allies) o.hp = Math.min(this.maxHp(o), o.hp + a.amount!);
        break;
      case 'splice_inject': {
        const o = allies.filter((x) => x.hp < this.maxHp(x)).sort((p, q) => dist(p.x, p.y, u.x, u.y) - dist(q.x, q.y, u.x, u.y))[0];
        if (!o) {
          fired = false;
          break;
        }
        o.hp = Math.min(this.maxHp(o), o.hp + this.maxHp(o) * a.amount!);
        break;
      }
      case 'neuro_override':
        if (!foes[0]) fired = false;
        else foes[0].stun = a.seconds;
        break;
      default:
        fired = false;
    }
    // Nothing to aim at: try again shortly instead of waiting a whole period.
    u.abilityCd = fired ? a.every : 0.5;
    if (fired) this.emit('hero_ability', { x: u.x, y: u.y, text: hero.id, unit: u.id });
    return false;
  }

  /** Demon's steam blast: a visible windup, then a line of burning ground. Returns true while it holds the Demon. */
  private steamBlast(u: Unit, dt: number): boolean {
    const a = HERO_ABILITY.steam_blast;
    const b = u.blast;
    if (b) {
      b.left -= dt;
      if (b.phase === 'windup') {
        if (b.left <= 0) {
          for (let r = 0.5; r <= a.range; r += 0.5) {
            const x = Math.round(u.x + b.dx * r);
            const y = Math.round(u.y + b.dy * r);
            if (inBounds(this.s, x, y)) this.cell(x, y).hot = a.seconds;
          }
          this.emit('demon_blast', { x: u.x, y: u.y, unit: u.id });
          this.emit('hero_ability', { x: u.x, y: u.y, text: u.hero, unit: u.id });
          u.blast = { phase: 'cooldown', left: a.every, dx: b.dx, dy: b.dy };
        }
        return true;
      }
      if (b.left <= 0) u.blast = undefined;
      return false;
    }
    const tp = this.targetPos(u.target!);
    const d = dist(tp.x, tp.y, u.x, u.y);
    if (d > a.range || d === 0) return false;
    u.blast = { phase: 'windup', left: a.count!, dx: (tp.x - u.x) / d, dy: (tp.y - u.y) / d };
    u.path = [];
    this.emit('demon_windup', { x: u.x, y: u.y, unit: u.id });
    return true;
  }

  private hotGround(dt: number): void {
    const s = this.s;
    const dps = HERO_ABILITY.steam_blast.amount!;
    for (const c of s.cells) {
      if (c.hot) c.hot = Math.max(0, c.hot - dt) || undefined;
      if (c.overgrown) c.overgrown = Math.max(0, c.overgrown - dt) || undefined;
    }
    for (const u of s.units) {
      if (isEnemy(u) || u.hp <= 0) continue;
      const x = Math.round(u.x);
      const y = Math.round(u.y);
      if (inBounds(s, x, y) && this.cell(x, y).hot) this.damage(u, dps * this.resistOf(u, 'thermo') * dt);
    }
  }

  // -- buildings and energy

  private addBuilding(owner: number, type: string, x: number, y: number, complete: boolean): Building {
    const def = buildingDefs[type];
    const b: Building = {
      id: this.s.nextId++,
      type,
      owner,
      x,
      y,
      hp: complete ? def.hp : Math.max(1, def.hp * 0.25),
      built: complete ? def.buildSeconds : 0,
      complete,
      produceTimer: 0,
      healTimer: 0,
    };
    this.s.buildings.push(b);
    this.cell(x, y).building = b.id;
    return b;
  }

  // -- cache bonuses (boons.json, META.md §8)

  private boonStacks(p: Player, id: string): number {
    return p.boons?.[id] ?? 0;
  }

  /** Product of a boon's factor over its stacks (1 when not taken). */
  private boonFactor(owner: number, id: string): number {
    const p = this.s.players[owner];
    const n = p ? this.boonStacks(p, id) : 0;
    return n ? Math.pow(Number(boonDefs[id].effect.value), n) : 1;
  }

  /** Three different cards from the rank's pool; rare ones come up 30 % of the time; Заначка fills a short offer. */
  private boonOffer(p: Player): string[] {
    const s = this.s;
    const r = boonRules;
    const can = (id: string): boolean => {
      const b = boonDefs[id];
      if (!b) return false;
      const n = this.boonStacks(p, id);
      if (n > 0 && (!b.stackable || n >= (b.maxStacks ?? Infinity))) return false;
      if (b.effect.type === 'trainingLevel' && this.trainingLevel(p.id) >= this.cfg.school.trainingLevelsMax) return false;
      if (b.effect.type === 'mark_hidden_site' && !this.hiddenSite(p)) return false;
      return true;
    };
    const pool = (this.rules.boonPool ?? []).filter(can);
    const out: string[] = [];
    while (out.length < r.offerCount) {
      const left = pool.filter((id) => !out.includes(id));
      if (!left.length) break;
      const rare = left.filter((id) => boonDefs[id].rarity === 'rare');
      const common = left.filter((id) => boonDefs[id].rarity !== 'rare');
      const fromRare = rare.length > 0 && (common.length === 0 || rand(s) * 100 < r.rarityWeights.rare);
      const list = fromRare ? rare : common;
      out.push(list[randIntOf(s, list.length)]);
    }
    while (out.length < r.offerCount && !out.includes(r.fallbackBoon)) out.push(r.fallbackBoon);
    return out;
  }

  /** Online there is no pause: after 10 s the first card is taken (boons.json rules.online). */
  private boonClock(_dt: number): void {
    if (this.s.players.length < 2) return;
    for (const p of this.s.players) {
      if (p.boonOffer && this.s.time - p.boonOffer.at >= 10) {
        const id = p.boonOffer.ids[0];
        p.boonOffer = undefined;
        this.grantBoon(p, id);
      }
    }
  }

  /** The nearest hidden nest, heavy nest or hero lair to the command center (Наводка). */
  private hiddenSite(p: Player): { x: number; y: number } | null {
    const cmd = this.building(p.command);
    if (!cmd) return null;
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    this.s.cells.forEach((c, i) => {
      if (c.revealed || c.marked || !['nest', 'heavy_nest', 'hero_lair'].includes(c.content)) return;
      const x = i % this.s.width;
      const y = (i - x) / this.s.width;
      const d = dist(x, y, cmd.x, cmd.y);
      if (d < bestD) [best, bestD] = [{ x, y }, d];
    });
    return best;
  }

  private grantBoon(p: Player, id: string): void {
    const b = boonDefs[id];
    if (!b) return;
    p.boons ??= {};
    p.boons[id] = (p.boons[id] ?? 0) + 1;
    const e = b.effect;
    const mine = () => this.s.units.filter((u) => u.owner === p.id && (u.kind === 'resident' || u.kind === 'ally') && u.hp > 0);
    const cmd = this.building(p.command);
    switch (e.type) {
      case 'energy_now':
        this.earn(p, Number(e.amount));
        break;
      case 'residents_now_and_cap':
        p.capBonus += Number(e.cap);
        if (cmd) for (let i = 0; i < Number(e.residents); i++) this.spawnAllyFromPool(p, cmd.x, cmd.y);
        break;
      case 'scan_now_and_charges':
        p.assist.scanLeft = Math.max(p.assist.scanLeft, Number(e.markDurationSeconds));
        if (p.assist.mode !== 'off') p.assist.charges += Number(e.scannerChargesAdd);
        break;
      case 'mark_hidden_site': {
        const at = this.hiddenSite(p);
        if (at) {
          this.cell(at.x, at.y).marked = true;
          const k = cellKey(at.x, at.y);
          p.queue = p.queue.filter((q) => q !== k);
          this.emit('site_marked', { x: at.x, y: at.y, owner: p.id });
        }
        break;
      }
      case 'give_part': {
        const free = (u: Unit) => RESIDENT_SLOTS.filter((sl) => !u.parts[sl]).length;
        const u = mine().sort((a, c) => free(c) - free(a))[0];
        if (!u) break;
        const armFree = RESIDENT_SLOTS.some((sl) => sl.startsWith('arm') && !u.parts[sl]);
        const kind = armFree ? 'arm' : 'leg';
        const ids = Object.keys(partDefs).filter((pid) => partDefs[pid].slot === kind && partDefs[pid].tiers.some((tr) => tr.tier === Number(e.tier)));
        if (ids.length) this.takePart(u, { id: ids[randIntOf(this.s, ids.length)], tier: Number(e.tier) });
        break;
      }
      case 'trainingLevel':
      case 'residentDefenseAdd':
        // Stats are read live (baseStats); heal the HP the training adds.
        for (const u of mine()) u.hp = Math.min(this.maxHp(u), u.hp + (e.type === 'trainingLevel' ? this.cfg.school.perLevel.hp : 0));
        break;
    }
    this.emit('boon_taken', { x: cmd?.x ?? 0, y: cmd?.y ?? 0, owner: p.id, text: id });
  }

  // -- allies: heroes back on the team (meta progress, heroes.json ally)

  private allyDef(id: string): Record<string, unknown> {
    return (heroDefs[id] as unknown as { ally?: Record<string, unknown> }).ally ?? {};
  }

  /** The ally passive of this kind on the player's side, if one of their allies is up. */
  private allyPassive(owner: number, key: string): Record<string, unknown> | null {
    for (const u of this.s.units) {
      if (u.kind !== 'ally' || u.owner !== owner || u.hp <= 0) continue;
      const a = this.allyDef(u.hero!);
      if (a.passive === key || key in a) return a;
    }
    return null;
  }

  /** A multiplier from an ally passive: `passive` names it, `field` is the number (defaults to the passive key itself). */
  private allyFactor(owner: number, passive: string, field = passive): number {
    if (owner < 0 || !this.rules.allies?.length) return 1;
    const a = this.allyPassive(owner, passive);
    return a && typeof a[field] === 'number' ? (a[field] as number) : 1;
  }

  /** Килн: residents next to him take less damage. */
  private allyGuard(v: Unit): number {
    if (!this.rules.allies?.length) return 1;
    for (const u of this.s.units) {
      if (u.kind !== 'ally' || u.owner !== v.owner || u.hp <= 0 || u === v) continue;
      const a = this.allyDef(u.hero!);
      if (a.passive === 'guardAura' && dist(u.x, u.y, v.x, v.y) <= Number(a.radius)) return Number(a.damageTakenFactor);
    }
    return 1;
  }

  private spawnAlly(p: Player, id: string): Unit | null {
    const h = heroDefs[id];
    const cmd = this.building(p.command);
    if (!h || !cmd) return null;
    const e = h.enemy;
    const u = this.newUnit('ally', p.id, cmd.x, cmd.y, {
      hp: Math.round(e.hp * ALLY.hpFactor),
      damage: Math.round(e.damage * ALLY.damageFactor),
      defense: e.defense,
      attackSeconds: e.attackSeconds,
      range: ALLY.range,
      speed: Math.max(e.speed, residentStats.speed),
    });
    u.hero = id;
    u.attackTech = e.attackTech;
    this.applyScars(p, u);
    this.emit('ally_join', { x: cmd.x, y: cmd.y, owner: p.id, unit: u.id, text: id });
    return u;
  }

  /** A returning ally keeps its trophies, stumps and plates (MVP_RULES §4.1а). */
  private applyScars(p: Player, u: Unit): void {
    const sc = p.allyScars?.[u.hero!];
    if (!sc) return;
    u.parts = { ...sc.parts };
    u.lostLimbs = sc.lostLimbs.length ? [...sc.lostLimbs] : undefined;
    u.armorPlates = sc.armorPlates || undefined;
    const arms = sc.lostLimbs.filter((l) => l === 'arm').length;
    const legs = sc.lostLimbs.length - arms;
    u.base = {
      ...u.base,
      damage: Math.max(1, Math.round(u.base.damage * 0.8 ** arms)),
      speed: Math.max(0.5, Math.round(u.base.speed * 0.75 ** legs * 10) / 10),
      defense: u.base.defense + sc.armorPlates * armorPlateDef.defenseAdd,
    };
    u.hp = this.maxHp(u);
  }

  /** Spawns the next available hero from the squad pool (rules.allies) at (x,y).
   *  Empty pool = no spawns. Skips heroes already alive or waiting to respawn.
   *  tiers: if set, only consider heroes of those tiers (MVP_RULES §4.1b building births). */
  private spawnAllyFromPool(p: Player, x: number, y: number, tiers?: number[]): Unit | null {
    // undefined = no squad configured (tutorial/test) → fall back to all heroes; [] = squad explicitly empty → no spawns.
    const pool = this.rules.allies !== undefined ? this.rules.allies : Object.keys(heroDefs);
    const alive = new Set(this.s.units.filter((u) => u.owner === p.id && u.kind === 'ally' && u.hp > 0).map((u) => u.hero));
    const waiting = new Set(Object.keys(p.allyBack ?? {}));
    const id = pool.find((hid) => !alive.has(hid) && !waiting.has(hid) && (!tiers || tiers.includes(heroDefs[hid]?.tier ?? 0)));
    if (!id) return null;
    const h = heroDefs[id];
    if (!h) return null;
    const e = h.enemy;
    const u = this.newUnit('ally', p.id, x, y, {
      hp: Math.round(e.hp * ALLY.hpFactor),
      damage: Math.round(e.damage * ALLY.damageFactor),
      defense: e.defense,
      attackSeconds: e.attackSeconds,
      range: ALLY.range,
      speed: Math.max(e.speed, residentStats.speed),
    });
    u.hero = id;
    u.attackTech = e.attackTech;
    this.emit('ally_join', { x, y, owner: p.id, unit: u.id, text: id });
    return u;
  }

  /** One-off ally effects when the shift starts (Маяк's scanner charges). */
  private allyStart(p: Player): void {
    const beacon = this.allyPassive(p.id, 'scannerBonus');
    if (beacon && p.assist.mode !== 'off') p.assist.charges += Number(beacon.extraCharges ?? 0);
  }

  /** Ally passives on timers and auras; knocked-out allies come back. */
  private allyClock(dt: number): void {
    const s = this.s;
    // allies now always exist (spawned from buildings); skip only if nobody is on allyBack or alive as ally

    for (const p of s.players) {
      for (const [id, at] of Object.entries(p.allyBack ?? {})) {
        if (s.time < at) continue;
        delete p.allyBack![id];
        this.spawnAlly(p, id);
      }
    }
    for (const u of s.units) {
      if (u.kind !== 'ally' || u.hp <= 0) continue;
      const p = s.players[u.owner];
      const a = this.allyDef(u.hero!);
      const timers = (p.allyTimers ??= {});
      const every = Number(a.everySeconds ?? a.healEverySeconds ?? a.reviveEverySeconds ?? a.convertAdaptantEverySeconds ?? a.freeSafeRevealEverySeconds ?? 0);
      let fire = false;
      if (every) {
        timers[u.hero!] = (timers[u.hero!] ?? every) - dt;
        if (timers[u.hero!] <= 0) {
          timers[u.hero!] += every;
          fire = true;
        }
      }
      const friends = (r: number) => s.units.filter((o) => o.owner === u.owner && (o.kind === 'resident' || o.kind === 'ally') && o.hp > 0 && dist(o.x, o.y, u.x, u.y) <= r);
      const foes = (r: number) => s.units.filter((o) => isEnemy(o) && o.hp > 0 && dist(o.x, o.y, u.x, u.y) <= r);
      switch (a.passive) {
        case 'slowAura':
          for (const e of foes(Number(a.radius))) e.slow = { percent: Math.max(e.slow?.percent ?? 0, Number(a.slowPercent)), left: Math.max(e.slow?.left ?? 0, 0.5) };
          break;
        case 'healAura':
          if (fire) for (const r of friends(Number(a.radius))) {
            const before = r.hp;
            r.hp = Math.min(this.maxHp(r), r.hp + Number(a.healAmount));
            if (r.hp > before) this.emit('heal', { x: r.x, y: r.y, amount: Math.round(r.hp - before), unit: r.id });
          }
          break;
        case 'cleanseAura':
          if (fire) for (const r of friends(Number(a.radius))) [r.burn, r.poison, r.slow, r.chill] = [undefined, undefined, undefined, 0];
          break;
        case 'pullEnemies': {
          // Draws the nearest foe's attention onto himself, away from the residents.
          const e = fire ? foes(Number(a.radius ?? 5)).sort((e1, e2) => dist(e1.x, e1.y, u.x, u.y) - dist(e2.x, e2.y, u.x, u.y))[0] : undefined;
          if (e) {
            e.target = `u:${u.id}`;
            e.raid = undefined;
            e.path = [];
            // Holds the foe on him for a while (enemyAi only retargets when the timer runs out).
            e.repathTimer = Number(a.durationSeconds ?? 4);
          }
          break;
        }
        case 'hiveScout':
        case 'scannerBonus':
          if (fire && a.passive === 'hiveScout') {
            const at = this.hiddenSite(p);
            if (at) {
              this.cell(at.x, at.y).marked = true;
              this.emit('site_marked', { x: at.x, y: at.y, owner: p.id, text: u.hero });
            }
          }
          break;
        case 'fieldSurgery': {
          // Brings back one resident lost since the last surgery (the resident cap still applies).
          const count = s.units.filter((o) => o.owner === p.id && (o.kind === 'resident' || o.kind === 'ally')).length;
          if (fire && p.stats.lost > Number(timers.doctorLost ?? 0) && count < this.residentCap(p.id)) {
            timers.doctorLost = p.stats.lost;
            this.spawnAllyFromPool(p, Math.round(u.x), Math.round(u.y));
          }
          break;
        }
      }
      // Семьдесят третий: turns a nearby adaptant into a resident now and then.
      if (fire && a.convertAdaptantEverySeconds) {
        const e = foes(4).find((o) => o.kind === 'adaptant');
        if (e) {
          this.kill(e);
          this.spawnAllyFromPool(p, Math.round(e.x), Math.round(e.y));
        }
      }
    }
  }

  /** The command center shoots the nearest enemy in range and heals residents next to it (buildings.json autoAttack, healAura). */
  private towers(dt: number): void {
    const s = this.s;
    for (const b of s.buildings) {
      const def = buildingDefs[b.type];
      if (!b.complete) continue;
      if (def.healAura) {
        for (const u of s.units) {
          if (u.owner !== b.owner || u.hp <= 0 || cheb(Math.round(u.x), Math.round(u.y), b.x, b.y) > def.healAura.radius) continue;
          u.hp = Math.min(this.maxHp(u), u.hp + def.healAura.hpPerSecond * dt);
        }
      }
      const a = def.autoAttack;
      if (!a) continue;
      b.attackCd = Math.max(0, (b.attackCd ?? 0) - dt);
      if (b.attackCd > 0) continue;
      const foe = s.units
        .filter((e) => isEnemy(e) && e.hp > 0 && dist(e.x, e.y, b.x, b.y) <= a.range + 0.5)
        .sort((e1, e2) => dist(e1.x, e1.y, b.x, b.y) - dist(e2.x, e2.y, b.x, b.y))[0];
      if (!foe) continue;
      b.attackCd = a.attackSeconds;
      this.damage(foe, Math.max(this.cfg.combat.minDamage, a.damage - this.stats(foe).defense));
      this.emit('hit', { x: foe.x, y: foe.y, text: a.tech ?? 'kinetic', amount: a.damage });
    }
  }

  private production(dt: number): void {
    const s = this.s;
    for (const b of s.buildings) {
      if (!b.complete) continue;
      const def = buildingDefs[b.type];
      if (def.produce) {
        // Reactors work by themselves [Антон]; a cooler next door doubles the pace.
        const cooled = s.buildings.some((o) => {
          const a = buildingDefs[o.type].aura;
          return o.complete && o.owner === b.owner && a?.targets.includes(b.type) && cheb(o.x, o.y, b.x, b.y) <= a.radius;
        });
        b.produceTimer += dt * (cooled ? 2 : 1);
        if (b.produceTimer >= def.produce.everySeconds) {
          b.produceTimer -= def.produce.everySeconds;
          this.spawnOrb(b.owner, b.x, b.y, Math.round(def.produce.energy * (b.type === 'reactor' ? this.boonFactor(b.owner, 'reactor_overclock') * this.allyFactor(b.owner, 'energyProductionFactor', 'value') : 1)));
        }
      }
      const aura = def.aura;
      if (aura?.healAmount) {
        b.healTimer += dt;
        if (b.healTimer >= (aura.healEverySeconds ?? 2)) {
          b.healTimer = 0;
          for (const u of s.units) {
            if (u.owner !== b.owner || (u.kind !== 'resident' && u.kind !== 'ally') || u.hp <= 0) continue;
            if (cheb(Math.round(u.x), Math.round(u.y), b.x, b.y) <= aura.radius && u.hp < this.maxHp(u)) {
              u.hp = Math.min(this.maxHp(u), u.hp + aura.healAmount);
              this.emit('healed', { x: u.x, y: u.y, owner: u.owner, unit: u.id });
            }
          }
        }
      }
    }
  }

  private spawnOrb(owner: number, x: number, y: number, amount: number): void {
    if (amount > 0) this.s.orbs.push({ owner, x, y, amount, x0: x, y0: y });
  }

  private orbs(dt: number): void {
    const s = this.s;
    const speed = this.cfg.economy.orbSpeed * dt;
    s.orbs = s.orbs.filter((o) => {
      const cmd = this.building(s.players[o.owner]?.command);
      if (!cmd) return false;
      const d = dist(cmd.x, cmd.y, o.x, o.y);
      if (d <= speed) {
        this.earn(s.players[o.owner], o.amount);
        this.emit('energy_orb_arrive', { x: cmd.x, y: cmd.y, owner: o.owner, amount: o.amount });
        return false;
      }
      o.x += ((cmd.x - o.x) / d) * speed;
      o.y += ((cmd.y - o.y) / d) * speed;
      return true;
    });
  }

  // -- bookkeeping

  private newUnit(kind: UnitKind, owner: number, x: number, y: number, base: UnitStats): Unit {
    const u: Unit = {
      id: this.s.nextId++,
      kind,
      owner,
      x,
      y,
      hp: base.hp,
      base,
      path: [],
      task: { type: 'idle' },
      parts: {},
      attackCooldown: 0,
      repathTimer: 0,
      kills: 0,
    };
    this.s.units.push(u);
    return u;
  }

  /** Residents get the school training bonus on top of their table stats (config.school). */
  private baseStats(u: Unit): UnitStats {
    if (u.kind !== 'resident' && u.kind !== 'ally') return u.base;
    const lv = this.trainingLevel(u.owner);
    // Бронежилеты (boons.json armor_plates): flat defense per stack.
    const armor = (this.s.players[u.owner]?.boons?.armor_plates ?? 0) * Number(boonDefs.armor_plates?.effect.value ?? 0);
    if (!lv && !armor) return u.base;
    const per = this.cfg.school.perLevel;
    return { ...u.base, hp: u.base.hp + per.hp * lv, damage: u.base.damage + per.damage * lv, defense: u.base.defense + per.defense * lv + armor };
  }

  private cleanup(): void {
    const s = this.s;
    s.units = s.units.filter((u) => u.hp > 0);
    for (const b of [...s.buildings]) {
      if (b.hp > 0 || b.ruined) continue;
      // Leaves ruins: keep the building record marked ruined (so UI can rebuild by id).
      if (b.type !== 'command' && b.complete && buildingDamage.ruins.leavesRuins) {
        b.ruined = true;
        this.cell(b.x, b.y).building = undefined;
        this.cell(b.x, b.y).ruin = b.type;
        this.emit('ruins', { x: b.x, y: b.y, owner: b.owner, text: b.type });
      } else {
        s.buildings = s.buildings.filter((o) => o !== b);
        this.cell(b.x, b.y).building = undefined;
      }
      this.rev++;
      for (const u of s.units) if (u.task.type === 'build' && u.task.building === b.id) this.setTask(u, { type: 'idle' });
      this.emit('building_lost', { x: b.x, y: b.y, owner: b.owner, text: b.hero ? `${b.type}.${b.hero}` : b.type });
      const p = s.players[b.owner];
      if (p.command === b.id) {
        p.alive = false;
        p.command = null;
        p.queue = [];
        p.autoQueue = [];
        s.units = s.units.filter((u) => u.owner !== p.id);
        s.orbs = s.orbs.filter((o) => o.owner !== p.id);
      }
    }
  }

  private checkOutcome(): void {
    const s = this.s;
    if (this.ffa) {
      // Last center standing wins; the Demon's death does not end an FFA match.
      const alive = s.players.filter((p) => p.alive);
      if (alive.length > 1) return;
      s.match!.winner = alive[0]?.id ?? null;
      s.outcome = alive.length ? 'victory' : 'defeat';
      this.emit(s.outcome, { owner: alive[0]?.id });
      return;
    }
    if (s.players.every((p) => !p.alive)) {
      s.outcome = 'defeat';
      this.emit('defeat');
    } else if (s.boss.dead && !s.cells.some((c) => c.hot)) {
      s.outcome = 'victory';
      this.emit('victory');
    }
  }

  /** Energy income; stats.energy feeds the run score (meta.json runScore.energyEarned). */
  private earn(p: Player, amount: number): void {
    p.energy += amount;
    p.stats.energy += amount;
  }

  private emit(type: string, data: Omit<GameEvent, 'type'> = {}): void {
    this.events.push({ type, ...data });
  }
}

function isTech(t: string): t is Tech {
  return t === 'thermo' || t === 'cryo' || t === 'volt' || t === 'toxin' || t === 'impact';
}
