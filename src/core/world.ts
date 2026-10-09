/**
 * One match of "Demon Hunt" for 1–4 players (design/MVP_RULES.md).
 * Pure and deterministic: the renderer (or the multiplayer server) calls
 * tick() with real time, World advances in fixed steps and emits events
 * named after the sound list (MVP_RULES appendix B).
 */
import { deduce, type Knowledge } from './assist';
import type { ApplyResult, Command } from './commands';
import {
  buildings as buildingDefs,
  config,
  defenderStats,
  DEFENDER_SLOTS,
  enemies as enemyDefs,
  mapgen,
  partTier,
  parts as partDefs,
  residentStats,
  sites as siteDefs,
  type EnemyDef,
  type SiteDef,
  type SlotId,
  type UnitStats,
} from './data';
import { cellAt, cellKey, cheb, dist, inBounds, neighbors, parseKey, walkableForEnemy, walkableForPlayer } from './grid';
import { generateField } from './mapgen';
import { findPath } from './pathfind';
import { rand, randIntOf } from './rng';
import type { AssistMode, RuleOverrides, Building, Cell, ClueChannel, GameState, PartInstance, Player, SiteState, Task, Unit, UnitKind } from './state';

export const STEP = 0.05;

export type GameEvent = { type: string; x?: number; y?: number; amount?: number; owner?: number; text?: string; unit?: number };

export interface WorldOptions {
  seed: number;
  rules?: RuleOverrides;
  assist?: AssistMode;
  players?: number;
  width?: number;
  height?: number;
}

const CHANNEL_OF: Partial<Record<Cell['content'], ClueChannel>> = {
  nest: 'threat',
  heavy_nest: 'threat',
  demon_hatch: 'demon',
  cache: 'finds',
  survivor: 'finds',
};

const isSiteCell = (c: Cell) => c.content === 'nest' || c.content === 'heavy_nest' || c.content === 'demon_hatch';
const isEnemy = (u: Unit) => u.owner < 0;
const siteKey = (x: number, y: number) => `s:${x},${y}`;

/** config.json with a match's dotted-path overrides applied. */
export function effectiveConfig(rules?: RuleOverrides): typeof config {
  const out = structuredClone(config);
  for (const [path, value] of Object.entries(rules?.config ?? {})) {
    const keys = path.split('.');
    let node = out as unknown as Record<string, unknown>;
    for (const k of keys.slice(0, -1)) node = node[k] as Record<string, unknown>;
    node[keys[keys.length - 1]] = value;
  }
  return out;
}

export function createState(opts: WorldOptions): GameState {
  const config = effectiveConfig(opts.rules);
  const players = opts.players ?? 1;
  const width = opts.width ?? config.board.width;
  const height = opts.height ?? config.board.height;
  const cells: Cell[] = [];
  for (let i = 0; i < width * height; i++) cells.push({ content: 'ground', revealed: false, resolved: false });
  return {
    version: 1,
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
      stats: { nests: 0, caches: 0 },
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
    demon: {
      awake: false,
      warned: false,
      dead: false,
      hpScale: 1 + (players - 1) * (players > 1 ? 0.6 : 0),
    },
    outcome: 'playing',
    rules: opts.rules,
  };
}

export class World {
  readonly s: GameState;
  private acc = 0;
  private events: GameEvent[] = [];
  /** Bumped whenever the opened field changes; the scanner result is cached per revision. */
  private rev = 0;
  private known: { rev: number; map: Map<string, Knowledge> } | null = null;

  /** Rule tables for this match (design tables plus any overrides). */
  readonly cfg: typeof config;

  constructor(opts: WorldOptions | { state: GameState }) {
    this.s = 'state' in opts ? opts.state : createState(opts);
    this.cfg = effectiveConfig(this.s.rules);
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

  defenderCapacity(playerId: number): number {
    const schools = this.s.buildings.filter((b) => b.owner === playerId && b.type === 'school' && b.complete).length;
    if (schools === 0) return 0;
    // 3 + 2 per school: one school gives 5 places (MVP_RULES §8.1).
    return this.cfg.defenders.baseCapacityWithSchool + this.cfg.defenders.capacityPerSchool * schools;
  }

  /** Stats including parts (and threat scaling baked into enemies at spawn). */
  stats(u: Unit): UnitStats {
    const base = this.baseStats(u);
    const out = { ...base };
    for (const p of Object.values(u.parts)) {
      if (!p) continue;
      const t = partTier(p.id, p.tier);
      out.damage += t.damage ?? 0;
      out.defense += t.defense ?? 0;
      out.hp += t.hp ?? 0;
      out.speed += t.speed ?? 0;
    }
    if (u.slow) out.speed *= 1 - u.slow.percent / 100;
    return out;
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
        return ok;
      }
      case 'build': {
        const reason = this.canBuild(playerId, cmd.building, cmd.x, cmd.y);
        if (reason) {
          this.emit('build_refused', { x: cmd.x, y: cmd.y, owner: playerId, text: reason });
          return bad(reason);
        }
        const def = buildingDefs[cmd.building];
        p.energy -= def.cost;
        this.addBuilding(playerId, cmd.building, cmd.x, cmd.y, false);
        this.emit('build_place', { x: cmd.x, y: cmd.y, owner: playerId });
        return ok;
      }
      case 'setRecruit': {
        const b = this.building(cmd.building);
        if (!b || b.owner !== playerId || b.type !== 'school') return bad();
        b.recruit = cmd.on;
        return ok;
      }
      case 'attack': {
        if (!this.targetAlive(cmd.target)) return bad();
        // Tapping the same target again lifts the order (MVP_RULES §6).
        p.order = p.order === cmd.target ? null : cmd.target;
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
  }

  /** null when the building can go there, otherwise the refusal text key. */
  canBuild(playerId: number, type: string, x: number, y: number): Extract<ApplyResult, { ok: false }>['reason'] | null {
    const def = buildingDefs[type];
    const p = this.player(playerId);
    if (!def?.buildable || !inBounds(this.s, x, y)) return 'invalid';
    const c = this.cell(x, y);
    if (!c.revealed || c.content !== 'ground' || !this.inTerritory(playerId, x, y)) return 'build.invalid_cell';
    if (c.building !== undefined) return 'build.cell_occupied';
    if (p.energy < def.cost) return 'build.not_enough_energy';
    if (this.s.units.some((u) => isEnemy(u) && cheb(Math.round(u.x), Math.round(u.y), x, y) <= 2)) return 'build.enemies_near';
    const cmd = this.building(p.command)!;
    if (!findPath(this.s.width, this.s.height, cmd, (ax, ay) => walkableForPlayer(this.s, ax, ay), (ax, ay) => ax === x && ay === y))
      return 'build.unreachable';
    return null;
  }

  /** Puts command centers down, generates the field around them and opens the start. */
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

  placeCommands(list: { player: number; x: number; y: number }[]): void {
    const s = this.s;
    if (!s.generated) {
      const nests = s.players.length > 1 ? 6 * s.players.length : undefined;
      generateField(s, { commands: list, nests });
    }
    for (const { player, x, y } of list) {
      const b = this.addBuilding(player, 'command', x, y, true);
      s.players[player].command = b.id;
      // The first resident is there at once (population.firstResidentImmediate).
      if (this.cfg.population.firstResidentImmediate && b.slots.length > 0) {
        b.slots[0].unit = this.spawnResident(player, b, x, y).id;
      }
      for (const n of [{ x, y }, ...neighbors(s, x, y)]) this.reveal(n.x, n.y, player, false);
    }
  }

  // ------------------------------------------------------------- simulation

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
    this.demonClock();
    this.assistTimers(dt);
    this.population(dt);
    this.recruiting();
    for (const u of [...s.units]) {
      if (u.hp <= 0) continue;
      this.effects(u, dt);
      if (u.kind === 'resident') this.residentAi(u, dt);
      else if (u.kind === 'defender') this.defenderAi(u, dt);
      else this.enemyAi(u, dt);
    }
    this.nests(dt);
    this.production(dt);
    this.orbs(dt);
    this.hotGround(dt);
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
        player.energy += energy;
        player.stats.caches++;
        this.emit('cache_open', { x, y, owner, amount: energy });
        break;
      }
      case 'survivor': {
        c.resolved = true;
        const cmd = this.building(player.command);
        if (cmd) {
          const r = this.spawnResident(owner, cmd, x, y);
          cmd.slots.push({ unit: r.id, timer: 0 });
          this.emit('resident_born', { x, y, owner, unit: r.id });
        }
        break;
      }
      case 'nest':
      case 'heavy_nest':
        this.openNest(x, y, c);
        break;
      case 'demon_hatch':
        this.wakeDemon();
        break;
    }
    // Quiet cell: its covered neighbors go to the low-priority auto queue.
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

  // -- population

  private spawnResident(owner: number, home: Building, x: number, y: number): Unit {
    const u = this.newUnit('resident', owner, x, y, { ...residentStats });
    u.home = home.id;
    return u;
  }

  private population(dt: number): void {
    for (const b of this.s.buildings) {
      if (!b.complete) continue;
      for (const slot of b.slots) {
        if (slot.unit !== null) continue;
        slot.timer -= dt;
        if (slot.timer <= 0) {
          slot.unit = this.spawnResident(b.owner, b, b.x, b.y).id;
          this.emit('resident_born', { x: b.x, y: b.y, owner: b.owner, unit: slot.unit });
        }
      }
    }
  }

  private freeSlot(u: Unit): void {
    const home = this.building(u.home);
    const slot = home?.slots.find((sl) => sl.unit === u.id);
    if (slot) {
      slot.unit = null;
      slot.timer = this.cfg.population.spawnSeconds;
    }
    u.home = undefined;
  }

  private recruiting(): void {
    for (const school of this.s.buildings) {
      if (school.type !== 'school' || !school.complete || !school.recruit) continue;
      const owner = school.owner;
      const p = this.s.players[owner];
      if (this.s.units.some((u) => u.task.type === 'train' && u.task.building === school.id)) continue;
      const defenders = this.s.units.filter((u) => u.owner === owner && (u.kind === 'defender' || u.task.type === 'train')).length;
      if (defenders >= this.defenderCapacity(owner) || p.energy < this.cfg.defenders.trainCost) continue;
      const free = this.s.units
        .filter((u) => u.owner === owner && u.kind === 'resident' && (u.task.type === 'idle' || u.task.type === 'rest'))
        .sort((a, b) => dist(a.x, a.y, school.x, school.y) - dist(b.x, b.y, school.x, school.y))[0];
      if (!free) continue;
      p.energy -= this.cfg.defenders.trainCost;
      this.setTask(free, { type: 'train', building: school.id, progress: 0 });
      free.path = this.playerPath(free, (x, y) => x === school.x && y === school.y) ?? [];
    }
  }

  // -- residents

  private residentAi(u: Unit, dt: number): void {
    const s = this.s;
    const threat = s.units.find((e) => isEnemy(e) && dist(e.x, e.y, u.x, u.y) <= this.cfg.combat.residentFleeRadius);
    const cmd = this.building(s.players[u.owner].command);
    if (threat && u.task.type !== 'flee' && cmd) {
      this.setTask(u, { type: 'flee' });
      u.path = this.playerPath(u, (x, y) => x === cmd.x && y === cmd.y) ?? [];
      this.emit('resident_flee', { x: u.x, y: u.y, owner: u.owner });
    }
    const t = u.task;
    switch (t.type) {
      case 'flee':
        this.move(u, dt);
        if (!threat && u.path.length === 0) this.setTask(u, { type: 'idle' });
        return;
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
        t.progress += dt;
        if (t.progress >= this.cfg.dig.digSeconds) {
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
        b.built += dt;
        if (b.built >= buildingDefs[b.type].buildSeconds) {
          b.complete = true;
          b.hp = buildingDefs[b.type].hp;
          for (const sl of b.slots) sl.timer = this.cfg.population.spawnSeconds;
          this.emit('build_done', { x: b.x, y: b.y, owner: b.owner });
          this.setTask(u, { type: 'idle' });
        }
        return;
      }
      case 'operate': {
        const b = this.building(t.building);
        if (!b) return this.setTask(u, { type: 'idle' });
        return this.move(u, dt);
      }
      case 'train': {
        const b = this.building(t.building);
        if (!b) return this.setTask(u, { type: 'idle' });
        if (u.path.length > 0) return this.move(u, dt);
        t.progress += dt;
        if (t.progress >= this.cfg.defenders.trainSeconds) this.promote(u);
        return;
      }
    }
  }

  private depleted(x: number, y: number): void {
    this.rev++;
    const c = this.cell(x, y);
    c.content = 'ground';
    c.stock = 0;
    const k = cellKey(x, y);
    for (const p of this.s.players) p.queue = p.queue.filter((q) => q !== k);
  }

  private promote(u: Unit): void {
    if (this.cfg.defenders.trainingFreesDwellingSlot) this.freeSlot(u);
    u.kind = 'defender';
    u.base = { ...defenderStats };
    u.hp = defenderStats.hp;
    this.setTask(u, { type: 'idle' });
    this.emit('defender_trained', { x: u.x, y: u.y, owner: u.owner, unit: u.id });
  }

  private setTask(u: Unit, task: Task): void {
    if (u.task.type === 'operate') {
      const b = this.building(u.task.building);
      if (b) b.operators = b.operators.filter((id) => id !== u.id);
    }
    u.task = task;
    u.path = [];
    if (task.type === 'operate') this.building(task.building)?.operators.push(u.id);
  }

  /**
   * Priority (MVP_RULES §4.1): build, dig, harvest, operate, rest. Deviation: player-marked
   * harvest goes before the automatic dig queue, otherwise auto digs starve it.
   */
  private findJob(u: Unit): void {
    const s = this.s;
    const p = s.players[u.owner];
    const claimed = (pred: (t: Task) => boolean) => s.units.some((o) => o !== u && pred(o.task));

    const site = s.buildings.find(
      (b) => b.owner === u.owner && !b.complete && !claimed((t) => t.type === 'build' && t.building === b.id),
    );
    if (site) {
      const path = this.playerPath(u, (x, y) => x === site.x && y === site.y);
      if (path) return this.go(u, { type: 'build', building: site.id }, path);
    }

    for (const list of [p.queue]) {
      const wanted = new Set(
        list.filter((k) => {
          const { x, y } = parseKey(k);
          return !this.cell(x, y).revealed && !claimed((t) => t.type === 'dig' && t.x === x && t.y === y);
        }),
      );
      if (wanted.size === 0) continue;
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
      if (path && goal) {
        const g = goal as { x: number; y: number };
        return this.go(u, { type: 'dig', x: g.x, y: g.y, progress: 0 }, path);
      }
    }

    const harvest = p.queue
      .map(parseKey)
      .filter(({ x, y }) => {
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

    // Auto-queued cells after the player's own orders (dig and harvest).
    for (const list of [p.autoQueue]) {
      const wanted = new Set(
        list.filter((k) => {
          const { x, y } = parseKey(k);
          return !this.cell(x, y).revealed && !claimed((t) => t.type === 'dig' && t.x === x && t.y === y);
        }),
      );
      if (wanted.size === 0) continue;
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
      if (path && goal) {
        const g = goal as { x: number; y: number };
        return this.go(u, { type: 'dig', x: g.x, y: g.y, progress: 0 }, path);
      }
    }

    const reactor = s.buildings.find(
      (b) => b.owner === u.owner && b.complete && (buildingDefs[b.type].operatorSlots ?? 0) > b.operators.length,
    );
    if (reactor) {
      const path = this.playerPath(u, (x, y) => x === reactor.x && y === reactor.y);
      if (path) return this.go(u, { type: 'operate', building: reactor.id }, path);
    }

    if (u.task.type !== 'rest') {
      const home = this.building(u.home) ?? this.building(p.command);
      if (home) {
        const path = this.playerPath(u, (x, y) => cheb(x, y, home.x, home.y) <= 1);
        this.go(u, { type: 'rest' }, path ?? []);
      }
    }
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
      return !!site && !site.destroyed;
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

  /**
   * Without an order the squad guards on its own (MVP_RULES §6): enemies within guardRadius of
   * own buildings, those hitting a building or a person first, then the nearest; then opened
   * nests in that radius.
   */
  private guardTarget(u: Unit): string | null {
    const s = this.s;
    const r = this.cfg.defenders.guardRadius;
    const own = s.buildings.filter((b) => b.owner === u.owner);
    const inRadius = (x: number, y: number) => own.some((b) => cheb(Math.round(x), Math.round(y), b.x, b.y) <= r);
    const mine = (t?: string) => {
      if (!t) return false;
      if (t.startsWith('b:')) return this.building(Number(t.slice(2)))?.owner === u.owner;
      return s.units.find((o) => `u:${o.id}` === t)?.owner === u.owner;
    };
    const near = s.units
      .filter((e) => isEnemy(e) && e.hp > 0 && inRadius(e.x, e.y))
      .sort((a, b) => Number(mine(b.target)) - Number(mine(a.target)) || dist(a.x, a.y, u.x, u.y) - dist(b.x, b.y, u.x, u.y))[0];
    if (near) return `u:${near.id}`;
    if (this.cfg.defenders.autoAttackNestsInGuardRadius) {
      const site = s.sites
        .filter((t) => !t.destroyed && t.kind !== 'demon_hatch' && inRadius(t.x, t.y))
        .sort((a, b) => dist(a.x, a.y, u.x, u.y) - dist(b.x, b.y, u.x, u.y))[0];
      if (site) return siteKey(site.x, site.y);
    }
    return null;
  }

  private defenderAi(u: Unit, dt: number): void {
    const s = this.s;
    const p = s.players[u.owner];
    if (p.order && !this.targetAlive(p.order)) p.order = null;
    let target = p.order;
    // Marching on a nest, defenders still answer adaptants that reach them.
    if (target?.startsWith('s:')) {
      const close = s.units
        .filter((e) => isEnemy(e) && e.hp > 0 && dist(e.x, e.y, u.x, u.y) <= 2)
        .sort((a, b) => dist(a.x, a.y, u.x, u.y) - dist(b.x, b.y, u.x, u.y))[0];
      if (close) target = `u:${close.id}`;
    }
    if (!target) target = this.guardTarget(u);
    if (target) return this.fight(u, target, dt, (x, y) => walkableForPlayer(s, x, y));
    u.target = undefined;
    // Guard post: a spot next to the command center, spread by id.
    const cmd = this.building(p.command);
    if (!cmd) return;
    u.repathTimer -= dt;
    if (u.path.length === 0 && u.repathTimer <= 0) {
      u.repathTimer = 1;
      const ring = neighbors(s, cmd.x, cmd.y).filter((n) => walkableForPlayer(s, n.x, n.y));
      const post = ring[u.id % Math.max(1, ring.length)];
      if (post && (Math.round(u.x) !== post.x || Math.round(u.y) !== post.y)) {
        u.path = (this.playerPath(u, (x, y) => x === post.x && y === post.y) ?? []).slice(1);
      }
    }
    this.move(u, dt);
  }

  private enemyAi(u: Unit, dt: number): void {
    const s = this.s;
    u.repathTimer -= dt;
    if (!this.targetAlive(u.target) || u.repathTimer <= 0) {
      // Nearest player unit or building.
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
    if (u.kind === 'demon' && this.demonBlast(u, dt)) return;
    this.fight(u, u.target, dt, (x, y) => walkableForEnemy(s, x, y));
  }

  /** Walk into range of the target and hit it on cooldown. */
  private fight(u: Unit, target: string, dt: number, walkable: (x: number, y: number) => boolean): void {
    const st = this.stats(u);
    u.attackCooldown = Math.max(0, u.attackCooldown - dt);
    const tp = this.targetPos(target);
    const reach = target.startsWith('u:') ? st.range + 0.5 : 1.5;
    if (dist(tp.x, tp.y, u.x, u.y) <= reach) {
      u.path = [];
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
      const path = findPath(s.width, s.height, { x: Math.round(u.x), y: Math.round(u.y) }, walkable, (x, y) => dist(x, y, tp.x, tp.y) <= reach);
      u.path = path ? path.slice(1) : [];
    }
    this.move(u, dt);
  }

  private hit(attacker: Unit, target: string, factor = 1, primary = true): void {
    const st = this.stats(attacker);
    if (target.startsWith('s:')) {
      const { x, y } = parseKey(target.slice(2));
      const site = this.site(x, y)!;
      const def = this.siteDef(site.kind).defense ?? 0;
      site.hp -= Math.max(this.cfg.combat.minDamage, st.damage * factor - def);
      if (site.hp <= 0) this.destroySite(site, attacker);
      return;
    }
    if (target.startsWith('b:')) {
      const b = this.building(Number(target.slice(2)))!;
      if (b.type === 'command' && this.rules.commandInvulnerable) return;
      b.hp -= Math.max(this.cfg.combat.minDamage, st.damage * factor - buildingDefs[b.type].defense);
      if (b.type === 'command') this.emit('center_hit', { x: b.x, y: b.y, owner: b.owner });
      return;
    }
    const v = this.unit(Number(target.slice(2)))!;
    const dmg = Math.max(this.cfg.combat.minDamage, st.damage * factor - this.stats(v).defense);
    this.damage(v, dmg, attacker);
    if (!primary) return;
    for (const part of Object.values(attacker.parts)) {
      if (!part) continue;
      const t = partTier(part.id, part.tier);
      if (t.burnDps) v.burn = { dps: t.burnDps, left: t.burnSeconds ?? 3, source: attacker.id };
      if (t.slowPercent) v.slow = { percent: t.slowPercent, left: t.slowSeconds ?? 2 };
      if (t.chainTargets) this.splash(attacker, v, t.chainRange ?? 1.5, t.chainDamageFactor ?? 0.5, t.chainTargets);
      if (t.splashRadius) this.splash(attacker, v, t.splashRadius, t.splashFactor ?? 0.5, Infinity);
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
    if (v.kind === 'defender') this.emit('defender_hit', { x: v.x, y: v.y, owner: v.owner });
    if (v.hp <= 0) this.kill(v, by);
  }

  private kill(v: Unit, by?: Unit): void {
    const s = this.s;
    v.hp = 0;
    if (v.kind === 'resident') {
      this.freeSlot(v);
      this.setTask(v, { type: 'idle' });
      this.emit('resident_die', { x: v.x, y: v.y, owner: v.owner });
      return;
    }
    if (v.kind === 'defender') {
      this.emit('defender_die', { x: v.x, y: v.y, owner: v.owner });
      // PvP: the killer takes the strongest part (multiplayer.json pvpPartSteal).
      if (by?.kind === 'defender') {
        const best = Object.values(v.parts).sort((a, b) => (b?.tier ?? 0) - (a?.tier ?? 0))[0];
        if (best) this.takePart(by, best);
      }
      return;
    }
    // Enemy.
    by && by.kills++;
    if (v.nest) {
      const site = s.sites.find((t) => siteKey(t.x, t.y) === v.nest);
      if (site) site.alive = site.alive.filter((id) => id !== v.id);
    }
    const def = this.enemyDef(v.kind);
    const part = Object.values(v.parts)[0];
    if (by?.kind === 'defender' && part && rand(s) < def.partDropChance) this.takePart(by, part);
    if (def.reward && by && by.owner >= 0) s.players[by.owner].energy += def.reward;
    this.emit(v.kind === 'demon' ? 'demon_die' : 'enemy_die', { x: v.x, y: v.y, owner: by?.owner });
    if (v.kind === 'demon') {
      s.demon.dead = true;
      this.rev++;
      const hatch = s.sites.find((t) => t.kind === 'demon_hatch');
      if (hatch) {
        hatch.destroyed = true;
        this.cell(hatch.x, hatch.y).resolved = true;
      }
    }
  }

  /** MVP_RULES §8.4: free slot → weakest same-type if strictly better → recycle. */
  private takePart(u: Unit, part: PartInstance): void {
    const kind = partDefs[part.id].slot;
    const slots = DEFENDER_SLOTS.filter((sl) => sl.startsWith(kind));
    const free = slots.find((sl) => !u.parts[sl]);
    let slot: SlotId | undefined = free;
    if (!slot) {
      const weakest = slots.sort((a, b) => u.parts[a]!.tier - u.parts[b]!.tier)[0];
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
    this.emit('part_attached', { x: u.x, y: u.y, owner: u.owner, unit: u.id, text: part.id });
  }

  private effects(u: Unit, dt: number): void {
    if (u.slow) {
      u.slow.left -= dt;
      if (u.slow.left <= 0) u.slow = undefined;
    }
    if (u.burn) {
      u.burn.left -= dt;
      this.damage(u, u.burn.dps * dt, this.unit(u.burn.source));
      if (u.burn && u.burn.left <= 0) u.burn = undefined;
    }
  }

  // -- nests and the Demon

  private openNest(x: number, y: number, c: Cell): void {
    const kind = c.content as 'nest' | 'heavy_nest';
    const def = this.siteDef(kind);
    const site: SiteState = { x, y, kind, hp: def.hp!, maxHp: def.hp!, spawnTimer: this.spawnInterval(kind), alive: [], destroyed: false };
    this.s.sites.push(site);
    for (let i = 0; i < (def.initialSpawn ?? 0); i++) this.spawnEnemy(site);
    this.emit(kind === 'heavy_nest' ? 'heavy_nest_open' : 'nest_open', { x, y });
  }

  private spawnInterval(kind: 'nest' | 'heavy_nest' | 'demon_hatch'): number {
    const def = this.siteDef(kind);
    if (def.respawnAfterDeathSeconds) return def.respawnAfterDeathSeconds;
    if (!def.spawnSeconds) return Infinity;
    const t = this.cfg.threat;
    return Math.max(t.minSpawnInterval, def.spawnSeconds * Math.pow(t.spawnIntervalFactorPerLevel, this.threatLevel));
  }

  private nests(dt: number): void {
    for (const site of this.s.sites) {
      if (site.destroyed || site.kind === 'demon_hatch') continue;
      const def = this.siteDef(site.kind);
      if (site.alive.length >= (def.maxAlive ?? 0)) {
        if (def.respawnAfterDeathSeconds) site.spawnTimer = def.respawnAfterDeathSeconds;
        continue;
      }
      site.spawnTimer -= dt;
      if (site.spawnTimer <= 0) {
        site.spawnTimer = this.spawnInterval(site.kind);
        this.spawnEnemy(site);
      }
    }
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
    const L = this.threatLevel;
    const t = this.cfg.threat;
    const hpScale = (1 + t.hpPerLevel * L) * (kind === 'demon' ? s.demon.hpScale : 1);
    const base: UnitStats = {
      hp: e.hp * hpScale,
      damage: e.damage * (1 + t.damagePerLevel * L),
      defense: e.defense,
      attackSeconds: e.attackSeconds,
      range: e.range,
      speed: e.speed,
    };
    const u = this.newUnit(kind, -1, spot.x, spot.y, base);
    u.nest = siteKey(site.x, site.y);
    const part = this.enemyPart(kind, this.cell(site.x, site.y).tech);
    if (part) {
      const slot: SlotId = partDefs[part.id].slot === 'arm' ? 'arm_right' : partDefs[part.id].slot === 'leg' ? 'leg_left' : 'tail';
      u.parts[slot] = part;
      u.hp = this.stats(u).hp;
    }
    site.alive.push(u.id);
    this.emit('enemy_spawn', { x: spot.x, y: spot.y });
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
      this.s.players[by.owner].energy += reward;
      this.s.players[by.owner].stats.nests++;
    }
    for (const p of this.s.players) if (p.order === siteKey(site.x, site.y)) p.order = null;
    this.emit('nest_destroyed', { x: site.x, y: site.y, owner: by.owner, amount: reward });
  }

  private demonClock(): void {
    const d = this.s.demon;
    if (d.awake || this.rules.demonEnabled === false) return;
    const wake = this.cfg.demon.selfWakeSeconds;
    if (!d.warned && this.s.time >= wake - this.cfg.demon.warningSeconds) {
      d.warned = true;
      this.emit('demon_warning');
    }
    if (this.s.time >= wake) {
      const i = this.s.cells.findIndex((c) => c.content === 'demon_hatch');
      if (i >= 0) {
        const c = this.s.cells[i];
        c.revealed = true;
        this.wakeDemon();
      }
    }
  }

  private wakeDemon(): void {
    const s = this.s;
    if (s.demon.awake) return;
    const i = s.cells.findIndex((c) => c.content === 'demon_hatch');
    if (i < 0) return;
    s.demon.awake = true;
    const x = i % s.width;
    const y = Math.floor(i / s.width);
    const def = siteDefs.demon_hatch;
    const site: SiteState = { x, y, kind: 'demon_hatch', hp: def.hp!, maxHp: def.hp!, spawnTimer: Infinity, alive: [], destroyed: false };
    s.sites.push(site);
    this.spawnEnemy(site);
    this.emit('demon_awake', { x, y });
  }

  /** Steam blast: a visible windup, then a line of burning ground. Returns true while it holds the Demon. */
  private demonBlast(u: Unit, dt: number): boolean {
    const sp = enemyDefs.demon.special!;
    const b = u.blast;
    if (b) {
      b.left -= dt;
      if (b.phase === 'windup') {
        if (b.left <= 0) {
          for (let r = 0.5; r <= sp.range; r += 0.5) {
            const x = Math.round(u.x + b.dx * r);
            const y = Math.round(u.y + b.dy * r);
            if (inBounds(this.s, x, y)) this.cell(x, y).hot = sp.hotGroundSeconds;
          }
          this.emit('demon_blast', { x: u.x, y: u.y });
          u.blast = { phase: 'cooldown', left: sp.cooldownSeconds, dx: b.dx, dy: b.dy };
        }
        return true;
      }
      if (b.left <= 0) u.blast = undefined;
      return false;
    }
    const tp = this.targetPos(u.target!);
    const d = dist(tp.x, tp.y, u.x, u.y);
    if (d > sp.range || d === 0) return false;
    u.blast = { phase: 'windup', left: sp.windupSeconds, dx: (tp.x - u.x) / d, dy: (tp.y - u.y) / d };
    u.path = [];
    this.emit('demon_windup', { x: u.x, y: u.y });
    return true;
  }

  private hotGround(dt: number): void {
    const s = this.s;
    const dps = enemyDefs.demon.special!.hotGroundDps;
    for (const c of s.cells) if (c.hot) c.hot = Math.max(0, c.hot - dt) || undefined;
    for (const u of s.units) {
      if (isEnemy(u) || u.hp <= 0) continue;
      const x = Math.round(u.x);
      const y = Math.round(u.y);
      if (inBounds(s, x, y) && this.cell(x, y).hot) this.damage(u, dps * dt);
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
      slots: Array.from({ length: def.residentSlots ?? 0 }, () => ({ unit: null, timer: this.cfg.population.spawnSeconds })),
      operators: [],
      produceTimer: 0,
      recruit: true,
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
        const working = b.operators.filter((id) => {
          const u = this.unit(id);
          return u && u.path.length === 0 && Math.round(u.x) === b.x && Math.round(u.y) === b.y;
        }).length;
        if (working === 0) continue;
        const cooled = s.buildings.some((o) => {
          const a = buildingDefs[o.type].aura;
          return o.complete && o.owner === b.owner && a?.targets.includes(b.type) && cheb(o.x, o.y, b.x, b.y) <= a.radius;
        });
        b.produceTimer += dt * (cooled ? 2 : 1);
        if (b.produceTimer >= def.produce.everySeconds) {
          b.produceTimer -= def.produce.everySeconds;
          this.spawnOrb(b.owner, b.x, b.y, def.produce.energy * (def.produce.perOperator ? working : 1));
        }
      }
      const aura = def.aura;
      if (aura?.healAmount) {
        b.healTimer += dt;
        if (b.healTimer >= (aura.healEverySeconds ?? 2)) {
          b.healTimer = 0;
          for (const u of s.units) {
            if (u.owner !== b.owner || u.kind !== 'defender' || u.hp <= 0) continue;
            if (cheb(Math.round(u.x), Math.round(u.y), b.x, b.y) <= aura.radius) u.hp = Math.min(this.stats(u).hp, u.hp + aura.healAmount);
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
        s.players[o.owner].energy += o.amount;
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

  private baseStats(u: Unit): UnitStats {
    return u.base;
  }

  private cleanup(): void {
    const s = this.s;
    s.units = s.units.filter((u) => u.hp > 0);
    for (const b of [...s.buildings]) {
      if (b.hp > 0) continue;
      s.buildings = s.buildings.filter((o) => o !== b);
      this.cell(b.x, b.y).building = undefined;
      for (const u of s.units) {
        if (u.home === b.id) u.home = undefined;
        if ((u.task.type === 'operate' || u.task.type === 'train' || u.task.type === 'build') && u.task.building === b.id) this.setTask(u, { type: 'idle' });
      }
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
    } else if (s.demon.dead && !s.cells.some((c) => c.hot)) {
      s.outcome = 'victory';
      this.emit('victory');
    }
  }

  private emit(type: string, data: Omit<GameEvent, 'type'> = {}): void {
    this.events.push({ type, ...data });
  }
}

