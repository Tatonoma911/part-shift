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
} from './data';
import { cellAt, cellKey, cheb, dist, inBounds, neighbors, parseKey, walkableForEnemy, walkableForPlayer } from './grid';
import { generateField } from './mapgen';
import { findPath } from './pathfind';
import { rand, randIntOf } from './rng';
import type { AssistMode, Building, Cell, ClueChannel, GameState, PartInstance, Player, RuleOverrides, SiteState, Task, Unit, UnitKind } from './state';

export const STEP = 0.05;

export type GameEvent = { type: string; x?: number; y?: number; amount?: number; owner?: number; text?: string; unit?: number };

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
      stats: { nests: 0, caches: 0, heroes: [], energy: 0, lost: 0, parts: 0 },
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
  private rev = 0;
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
      .reduce((n, b) => n + (buildingDefs[b.type].trainingLevel ?? 0), 0);
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

  /** The element a unit hits this target with (residents pick their best arm, ELEMENTS.md §2). */
  attackOf(u: Unit, target?: Unit): { tech: AttackTech; tier: number } {
    if (u.kind === 'resident') {
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
      return ok;
    }
    if (!p.alive || p.command === null) return bad();
    switch (cmd.type) {
      case 'queueDig': {
        if (!inBounds(s, cmd.x, cmd.y)) return bad();
        const c = this.cell(cmd.x, cmd.y);
        const k = cellKey(cmd.x, cmd.y);
        const harvestable = c.revealed && (c.content === 'rubble' || c.content === 'energy_vein') && (c.stock ?? 0) > 0;
        if ((c.revealed && !harvestable) || c.marked || p.queue.includes(k)) return bad();
        const known = this.visibleKnowledge(playerId).get(k);
        if (this.cfg.assist.blockSwipeOnKnownDanger && !cmd.force && (known === 'threat' || known === 'demon')) {
          return bad('assist.known_danger');
        }
        p.autoQueue = p.autoQueue.filter((q) => q !== k);
        p.queue.push(k);
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
        c.marked = !c.marked;
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
        if (this.cell(cmd.x, cmd.y).ruin) {
          nb.rebuild = true;
          this.cell(cmd.x, cmd.y).ruin = undefined;
          this.rev++;
        }
        this.emit('build_place', { x: cmd.x, y: cmd.y, owner: playerId, text: cmd.building });
        return ok;
      }
      case 'attack': {
        // A tap on an opened lair or hatch means its hero.
        const lair = cmd.target.startsWith('s:') ? this.site(parseKey(cmd.target.slice(2)).x, parseKey(cmd.target.slice(2)).y) : undefined;
        if (lair && (lair.kind === 'hero_lair' || lair.kind === 'boss_hatch')) {
          const hero = lair.alive.map((id) => this.unit(id)).find((h) => h && h.hp > 0);
          if (!hero) return bad();
          p.order = `u:${hero.id}`;
          return ok;
        }
        if (!this.targetAlive(cmd.target)) return bad();
        // Tapping the same target again keeps the order: players tap repeatedly to insist [Антон].
        // The order lifts with a tap on open ground (cancelOrder) or when the target falls.
        p.order = cmd.target;
        return ok;
      }
      case 'cancelOrder':
        p.order = null;
        return ok;
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
    }
    for (const { player, x, y } of list) {
      const b = this.addBuilding(player, 'command', x, y, true);
      s.players[player].command = b.id;
      for (const n of [{ x, y }, ...neighbors(s, x, y)]) this.reveal(n.x, n.y, player, false);
      const first = this.cfg.population.firstResidentImmediate ? this.cfg.population.initialResidents : 0;
      for (let i = 0; i < first; i++) this.spawnResident(player, x, y);
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
      if (u.kind === 'resident') this.residentAi(u, dt);
      else this.enemyAi(u, dt);
    }
    this.nests(dt);
    this.production(dt);
    this.orbs(dt);
    this.hotGround(dt);
    this.idleHint();
    this.cleanup();
    this.checkOutcome();
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
    c.marked = false;
    const k = cellKey(x, y);
    for (const p of s.players) {
      p.queue = p.queue.filter((q) => q !== k);
      p.autoQueue = p.autoQueue.filter((q) => q !== k);
    }
    if (pay) {
      this.spawnOrb(owner, x, y, this.cfg.economy.energyPerDugTile);
      this.emit('dig_done', { x, y, owner });
    }
    const player = s.players[owner];
    switch (c.content) {
      case 'cache': {
        c.resolved = true;
        const energy = siteDefs.cache.onReveal?.energy ?? this.cfg.economy.cacheEnergy;
        this.earn(player, energy);
        player.stats.caches++;
        this.emit('cache_open', { x, y, owner, amount: energy });
        break;
      }
      case 'survivor': {
        c.resolved = true;
        player.capBonus++;
        this.spawnResident(owner, x, y);
        this.emit('survivor_joined', { x, y, owner });
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
      const count = this.s.units.filter((u) => u.owner === p.id && u.kind === 'resident').length;
      if (count >= this.residentCap(p.id)) {
        p.spawnTimer = Math.max(p.spawnTimer, 0);
        continue;
      }
      p.spawnTimer -= dt;
      if (p.spawnTimer > 0) continue;
      p.spawnTimer = this.cfg.population.spawnSeconds;
      const at = this.spawnPoint(p);
      if (at) this.spawnResident(p.id, at.x, at.y);
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
        c.dig = (c.dig ?? 0) + this.workShare(u, (o) => o.task.type === 'dig' && o.task.x === t.x && o.task.y === t.y) * dt;
        t.progress = Math.max(c.dig, 1e-6);
        if (c.dig >= this.cfg.dig.digSeconds) {
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
          if (t.progress >= mapgen.rubble.workSeconds) {
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

  private finishBuilding(b: Building): void {
    const before = this.trainingLevel(b.owner);
    b.complete = true;
    b.hp = buildingDefs[b.type].hp;
    // A new school level: every resident's max HP grows, so does their current HP.
    if (this.trainingLevel(b.owner) > before) {
      const add = this.cfg.school.perLevel.hp * (this.trainingLevel(b.owner) - before);
      for (const r of this.s.units) if (r.owner === b.owner && r.kind === 'resident') r.hp += add;
      this.emit('training_up', { x: b.x, y: b.y, owner: b.owner, amount: this.trainingLevel(b.owner) });
    }
    this.emit('build_done', { x: b.x, y: b.y, owner: b.owner, text: b.type });
    for (const u of this.s.units) if (u.task.type === 'build' && u.task.building === b.id) this.setTask(u, { type: 'idle' });
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
    const spots = [{ x: source.x, y: source.y }, ...neighbors(s, source.x, source.y)].filter((n) => !(n.x === source!.x && n.y === source!.y) && walkableForEnemy(s, n.x, n.y));
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
      this.emit('enemy_spawn', { x: spot.x, y: spot.y, text: `adaptant_${tech ?? 'thermo'}`, unit: u.id });
    }
    const b = this.targetPos(target);
    this.emit('raid_incoming', { x: b.x, y: b.y, owner: this.building(Number(target.slice(2)))!.owner, amount: size, text: source.tunnel ? `${source.x},${source.y}` : undefined });
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

  private targetPos(t: string): { x: number; y: number } {
    if (t.startsWith('u:')) return this.unit(Number(t.slice(2)))!;
    if (t.startsWith('s:')) return parseKey(t.slice(2));
    return this.building(Number(t.slice(2)))!;
  }

  private enemyAi(u: Unit, dt: number): void {
    const s = this.s;
    u.repathTimer -= dt;
    if (u.raid && !this.targetAlive(u.raid)) u.raid = this.raidTarget(u.x, u.y, u.owner);
    if (u.raid) {
      if (u.target !== u.raid) u.path = [];
      u.target = u.raid;
    } else if (!this.targetAlive(u.target) || u.repathTimer <= 0) {
      // Nearest resident or building.
      let best: string | undefined;
      let bestD = Infinity;
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
      b.hp -= Math.max(this.cfg.combat.minDamage, st.damage * factor * vs - buildingDefs[b.type].defense);
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
    let mul = this.resistOf(v, tech) * factor;
    if (reaction === 'thermoshock') {
      mul *= 1 + Number(elements.reactions.find((r) => r.id === reaction)!.effect.bonusDamageFactor ?? 1);
      v.burn = undefined;
    }
    const dmg = Math.max(this.cfg.combat.minDamage, st.damage * mul - this.stats(v).defense);
    this.damage(v, dmg, attacker);
    this.emit('hit', { x: v.x, y: v.y, text: tech, unit: attacker.id, amount: Math.round(dmg) });
    if (reaction) this.emit('reaction', { x: v.x, y: v.y, text: reaction, owner: attacker.owner });
    if (!primary || v.hp <= 0) return;
    const heal = Object.values(attacker.parts).reduce((n, p) => n + (p ? partTier(p.id, p.tier).healSelfOnHit ?? 0 : 0), 0);
    if (heal) attacker.hp = Math.min(this.maxHp(attacker), attacker.hp + heal);
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
    const hostile = (o: Unit) => o !== around && o.hp > 0 && isEnemy(o) !== isEnemy(attacker) && o.owner !== attacker.owner;
    const near = this.s.units
      .filter((o) => hostile(o) && dist(o.x, o.y, around.x, around.y) <= radius)
      .sort((a, b) => dist(a.x, a.y, around.x, around.y) - dist(b.x, b.y, around.x, around.y))
      .slice(0, max);
    for (const o of near) this.hit(attacker, `u:${o.id}`, factor, false);
  }

  private damage(v: Unit, amount: number, by?: Unit): void {
    if (v.hp <= 0) return;
    v.hp -= amount;
    // Raiders keep to the buildings until a resident hits them (raidRules.raidersPreferBuildings).
    if (v.raid && by && !isEnemy(by)) {
      v.raid = undefined;
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
    if (v.kind === 'resident') {
      s.players[v.owner].stats.lost++;
      this.setTask(v, { type: 'idle' });
      this.emit('resident_die', { x: v.x, y: v.y, owner: v.owner, unit: v.id });
      // PvP: the killer takes the strongest part (multiplayer.json pvpPartSteal).
      if (by?.kind === 'resident') {
        const best = Object.values(v.parts).sort((a, b) => (b?.tier ?? 0) - (a?.tier ?? 0))[0];
        if (best) this.takePart(by, best);
      }
      return;
    }
    // Enemy.
    if (by) by.kills++;
    const site = v.nest ? s.sites.find((t) => siteKey(t.x, t.y) === v.nest) : undefined;
    if (site) site.alive = site.alive.filter((id) => id !== v.id);
    const killer = by && !isEnemy(by) ? by : undefined;
    if (v.kind === 'hero') return this.heroDown(v, killer, site);
    const def = this.enemyDef(v.kind);
    const part = Object.values(v.parts)[0];
    if (killer?.kind === 'resident' && part && rand(s) < def.partDropChance) this.takePart(killer, part);
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
      const amount = this.cfg.economy.partRecycleEnergyPerTier * part.tier;
      this.spawnOrb(u.owner, Math.round(u.x), Math.round(u.y), amount);
      this.emit('part_recycled', { x: u.x, y: u.y, owner: u.owner, amount, text: part.id });
      return;
    }
    const before = this.stats(u).hp;
    u.parts[slot] = { ...part };
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
    for (let i = 0; i < (def.initialSpawn ?? 0); i++) this.spawnEnemy(site);
    this.emit(kind === 'heavy_nest' ? 'heavy_nest_open' : 'nest_open', { x, y, text: c.tech });
  }

  private spawnInterval(kind: SiteState['kind']): number {
    const def = this.siteDef(kind);
    if (def.respawnAfterDeathSeconds) return def.respawnAfterDeathSeconds;
    if (!def.spawnSeconds) return Infinity;
    const t = this.cfg.threat;
    return Math.max(t.minSpawnInterval, def.spawnSeconds * Math.pow(t.spawnIntervalFactorPerLevel, this.threatLevel));
  }

  private nests(dt: number): void {
    for (const site of this.s.sites) {
      if (site.destroyed || (site.kind !== 'nest' && site.kind !== 'heavy_nest')) continue;
      if (site.rush) site.rush = Math.max(0, site.rush - dt) || undefined;
      const def = this.siteDef(site.kind);
      if (site.alive.length >= (def.maxAlive ?? 0)) {
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
      site.alive.push(u.id);
    }
    this.cell(x, y).revealed = true;
    this.rev++;
    // amount 1 marks the call target (its own boss_awake toast follows).
    this.emit('hero_spawn', { x, y, text: heroId, amount: kind === 'boss_hatch' ? 1 : 0 });
    if (kind === 'boss_hatch') this.emit('boss_awake', { x, y, text: heroId });
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

  /** The call target leaves its hatch by itself at 15:00, after a warning (config.boss). */
  private bossClock(): void {
    const b = this.s.boss;
    if (b.awake || this.rules.bossEnabled === false) return;
    const wake = this.cfg.boss.selfWakeSeconds;
    if (!b.warned && this.s.time >= wake - this.cfg.boss.warningSeconds) {
      b.warned = true;
      this.emit('boss_warning', { text: b.hero });
    }
    if (this.s.time >= wake) this.wakeBoss();
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
          this.spawnOrb(b.owner, b.x, b.y, def.produce.energy);
        }
      }
      const aura = def.aura;
      if (aura?.healAmount) {
        b.healTimer += dt;
        if (b.healTimer >= (aura.healEverySeconds ?? 2)) {
          b.healTimer = 0;
          for (const u of s.units) {
            if (u.owner !== b.owner || u.kind !== 'resident' || u.hp <= 0) continue;
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
    if (amount > 0) this.s.orbs.push({ owner, x, y, amount });
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
    if (u.kind !== 'resident') return u.base;
    const lv = this.trainingLevel(u.owner);
    if (!lv) return u.base;
    const per = this.cfg.school.perLevel;
    return { ...u.base, hp: u.base.hp + per.hp * lv, damage: u.base.damage + per.damage * lv, defense: u.base.defense + per.defense * lv };
  }

  private cleanup(): void {
    const s = this.s;
    s.units = s.units.filter((u) => u.hp > 0);
    for (const b of [...s.buildings]) {
      if (b.hp > 0) continue;
      s.buildings = s.buildings.filter((o) => o !== b);
      this.cell(b.x, b.y).building = undefined;
      if (b.type !== 'command' && b.complete && buildingDamage.ruins.leavesRuins) this.cell(b.x, b.y).ruin = b.type;
      this.rev++;
      for (const u of s.units) if (u.task.type === 'build' && u.task.building === b.id) this.setTask(u, { type: 'idle' });
      this.emit('building_lost', { x: b.x, y: b.y, owner: b.owner, text: b.type });
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
