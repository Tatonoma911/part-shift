import Phaser from 'phaser';
import { buildings as buildingDefs } from '../core/data';
import type { Building, Unit } from '../core/state';
import type { World } from '../core/world';
import buildingsJson from '../data/design/buildings.json';
import { hasText, t } from '../i18n';
import { buildingPic, heroName, stationPrice, techOf } from './BuildMenu';
import { C, INK, LANDSCAPE } from './layout';
import { drawTechOrb } from './Vitals';
import { chip, plate, TXT } from './ui';
import { heroesInReach, swapCommand } from './trophyActions';

/**
 * Building card on tap (Антон 10.10 10:40; Геймдизайнер: BUILDINGS.md §6–8, buildings.json v0.9).
 * One column that fits a phone without scrolling, the field keeps running behind it:
 *   name · level chevrons · HP · what it does now
 *   [ Улучшить · 75 ⚡ · 8 с ]  + what changes, or a grey button with the reason
 *   Усилить героев: one row per boost with its price and cooldown
 *   Снести · +N ⚡ (small, second tap within 3 s)
 * Ruins show only «Отстроить», an unfinished building only «Отменить стройку».
 * Texts: building.card.*, building.boost.*, building.demolish.* (Сценарист, ru.json 0.30).
 */

export type CardActionId = 'upgrade' | 'demolish' | 'rebuild' | 'cancel' | 'recolor' | 'swap' | `boost:${string}` | `coat:${string}` | `recolor:${string}`;

/** A trophy row: the forge's recolor or the rotation centre's swap. */
export interface TrophyRow {
  id: 'recolor' | 'swap';
  name: string;
  desc: string;
  energy: number;
  cd: number;
  enabled: boolean;
  reason: string;
}

export interface BoostRow {
  id: string;
  name: string;
  desc: string;
  energy: number;
  /** Seconds left of the cooldown, 0 when ready. */
  cd: number;
  enabled: boolean;
  reason: string;
}

export interface BuildingInfo {
  id: number;
  type: string;
  hero?: string;
  tech?: string;
  level: number;
  maxLevel: number;
  hp: number;
  maxHp: number;
  state: 'ok' | 'building' | 'upgrading' | 'ruins' | 'demolishing';
  /** 0..1 of construction / upgrade / demolition. */
  progress: number;
  now: string;
  upgrade: { label: string; next: string; enabled: boolean; reason: string } | null;
  upgradingLine: string;
  boosts: BoostRow[];
  /** Forge recolor and rotation swap rows (buildings.json forge.recolor, rotation_center.swap). */
  trophies: TrophyRow[];
  demolish: { refund: number; enabled: boolean; reason: string; lowHp: boolean } | null;
  rebuild: { cost: number; enabled: boolean; reason: string } | null;
  cancel: { refund: number } | null;
}

// ---------------------------------------------------------------- rules (buildings.json v0.9)

type LevelRule = { cost?: number; seconds?: number; requires?: { school?: number } } & Record<string, unknown>;
type Upgrades = {
  maxLevel: number;
  defaultCostFactorByLevel: Record<string, number>;
  defaultSecondsFactorByLevel: Record<string, number>;
  hpFactorPerLevel: number;
  level3RequiresCommandLevel: number;
  blockedIfEnemyWithin: number;
  perBuilding: Record<string, { maxLevel?: number; levels?: Record<string, LevelRule> }>;
};
type BoostRule = { id: string; radius?: number; energy: number; cooldownSeconds?: number; seconds?: number; target?: string; effect?: Record<string, unknown>; textKey?: string; name_ru?: string };
type Demolish = { forbidden: string[]; confirmSeconds: number; refundFactorOfInvested: number; refundScalesWithHpFraction: boolean; cancelConstructionRefund: number; blockedIfEnemyWithin: number };
type Rules = { upgrades?: Upgrades; heroBoosts?: { stars?: { max: number }; byBuilding: Record<string, BoostRule[]> }; demolish?: Demolish };

const RULES = buildingsJson as unknown as Rules;
const UP: Upgrades = RULES.upgrades ?? {
  maxLevel: 3,
  defaultCostFactorByLevel: { 2: 0.75, 3: 1.5 },
  defaultSecondsFactorByLevel: { 2: 1, 3: 1.5 },
  hpFactorPerLevel: 1.25,
  level3RequiresCommandLevel: 2,
  blockedIfEnemyWithin: 2,
  perBuilding: {},
};
const DEMOLISH: Demolish = RULES.demolish ?? { forbidden: ['command'], confirmSeconds: 3, refundFactorOfInvested: 0.5, refundScalesWithHpFraction: true, cancelConstructionRefund: 1, blockedIfEnemyWithin: 2 };
const BOOSTS = RULES.heroBoosts?.byBuilding ?? {};
const MAX_STARS = RULES.heroBoosts?.stars?.max ?? 3;
export const DEMOLISH_CONFIRM_MS = DEMOLISH.confirmSeconds * 1000;

/**
 * Live fields the core keeps on a building (ui/code README step 20). All optional: a core without them
 * shows level 1, no cooldowns and an invested sum equal to the price.
 */
export type LiveBuilding = Building & {
  hero?: string;
  level?: number;
  /** Seconds left / total of a running upgrade. */
  upgradeLeft?: number;
  upgradeTotal?: number;
  /** Seconds left of each boost's cooldown, by boost id. */
  boostCd?: Record<string, number>;
  ruined?: boolean;
  /** Energy put in: construction plus upgrades (refund base). */
  invested?: number;
  demolishLeft?: number;
};
/** Live fields of our heroes the card reads. */
type LiveUnit = Unit & { maxHp?: number; stars?: number; stumps?: string[]; busy?: boolean };

const isEnemy = (u: Unit) => u.owner < 0;
const cheb = (ax: number, ay: number, bx: number, by: number) => Math.max(Math.abs(Math.round(ax) - bx), Math.abs(Math.round(ay) - by));
const unitMaxHp = (u: LiveUnit) => u.maxHp ?? u.base.hp;
const txt = (k: string, p: Record<string, string | number> = {}) => (hasText(k) ? t(k, p) : '');

export function maxLevelOf(type: string): number {
  return UP.perBuilding[type]?.maxLevel ?? UP.maxLevel;
}

export function basePrice(type: string, hero?: string): number {
  if (type === 'station') return hero ? stationPrice(hero) : 0;
  const c = buildingDefs[type]?.cost;
  return typeof c === 'number' ? c : 0;
}

/** Price and seconds of going to `level` (2 or 3). The Command Center has its own table. */
export function upgradeCost(type: string, level: number, hero?: string): { cost: number; seconds: number } {
  const rule = UP.perBuilding[type]?.levels?.[String(level)];
  const def = buildingDefs[type];
  const cost = rule?.cost ?? Math.round(basePrice(type, hero) * (UP.defaultCostFactorByLevel[String(level)] ?? 1));
  const seconds = rule?.seconds ?? Math.round((def?.buildSeconds ?? 8) * (UP.defaultSecondsFactorByLevel[String(level)] ?? 1));
  return { cost, seconds };
}

export function maxHpAt(type: string, level: number): number {
  const rule = UP.perBuilding[type]?.levels?.[String(level)];
  if (typeof rule?.hp === 'number') return rule.hp as number;
  return Math.round((buildingDefs[type]?.hp ?? 100) * Math.pow(UP.hpFactorPerLevel, level - 1));
}

/** What the building gives at a level, one short line (BUILDINGS.md §6.1 table). */
function levelLine(type: string, level: number): string {
  if (level <= 1) return txt(`building.built.${type}`, { hero: '' }) || txt(`building.${type}.desc`);
  return txt(`building.up.${type}.${level}`);
}

export function buildingInfo(world: World, raw: Building, me: number): BuildingInfo {
  const b = raw as LiveBuilding;
  const def = buildingDefs[b.type];
  const energy = world.player(me).energy;
  const own = world.s.buildings.filter((o) => o.owner === me) as LiveBuilding[];
  const level = b.level ?? 1;
  const maxLevel = maxLevelOf(b.type);
  const maxHp = maxHpAt(b.type, level);
  const price = basePrice(b.type, b.hero);
  const enemyWithin = (r: number) => world.s.units.some((u) => isEnemy(u) && u.hp > 0 && cheb(u.x, u.y, b.x, b.y) <= r);
  const ours = (r: number) => (world.s.units as LiveUnit[]).filter((u) => u.owner === me && !isEnemy(u) && u.hp > 0 && cheb(u.x, u.y, b.x, b.y) <= r);
  const short = (need: number) => t('building.card.disabled.no_energy', { need: Math.ceil(need - energy) });
  const info: BuildingInfo = {
    id: b.id,
    type: b.type,
    hero: b.hero,
    tech: b.hero ? techOf(b.hero) : undefined,
    level,
    maxLevel,
    hp: Math.max(0, Math.round(b.hp)),
    maxHp,
    state: 'ok',
    progress: 0,
    now: levelLine(b.type, level),
    upgrade: null,
    upgradingLine: '',
    boosts: [],
    trophies: [],
    demolish: null,
    rebuild: null,
    cancel: null,
  };
  if (b.hero) info.now = txt('building.built.station', { hero: heroName(b.hero) }) || info.now;
  // Ruins: only «Отстроить», half price (MVP_RULES §9.7).
  if (b.ruined) {
    info.state = 'ruins';
    const cost = Math.ceil(price / 2);
    info.rebuild = { cost, enabled: energy >= cost, reason: energy >= cost ? '' : short(cost) };
    return info;
  }
  // Under construction: only «Отменить стройку» with a full refund.
  if (!b.complete) {
    info.state = 'building';
    info.progress = def?.buildSeconds ? Math.min(1, b.built / def.buildSeconds) : 0;
    info.cancel = { refund: Math.floor((b.invested ?? price) * DEMOLISH.cancelConstructionRefund) };
    return info;
  }
  if ((b.demolishLeft ?? 0) > 0) {
    info.state = 'demolishing';
    info.progress = 1 - (b.demolishLeft ?? 0) / 3;
    return info;
  }
  const blockR = UP.blockedIfEnemyWithin;
  // Upgrade.
  if ((b.upgradeLeft ?? 0) > 0) {
    info.state = 'upgrading';
    const total = b.upgradeTotal ?? upgradeCost(b.type, level + 1, b.hero).seconds;
    info.progress = 1 - (b.upgradeLeft ?? 0) / Math.max(1, total);
    info.upgradingLine = t('building.card.upgrading', { time: Math.ceil(b.upgradeLeft ?? 0) });
  } else if (level >= maxLevel) {
    info.upgrade = { label: t('building.card.level_max'), next: '', enabled: false, reason: t('building.card.disabled.max_level') };
  } else {
    const to = level + 1;
    const { cost, seconds } = upgradeCost(b.type, to, b.hero);
    const command = own.find((o) => o.type === 'command');
    const rule = UP.perBuilding[b.type]?.levels?.[String(to)];
    const schools = own.filter((o) => o.type === 'school' && o.complete).length;
    let reason = '';
    if (to >= 3 && b.type !== 'command' && (command?.level ?? 1) < UP.level3RequiresCommandLevel) reason = t('building.card.disabled.needs_command_2');
    else if ((rule?.requires?.school ?? 0) > schools) reason = t('building.card.disabled.needs_school');
    else if (enemyWithin(blockR)) reason = t('building.card.disabled.enemy_near');
    else if (energy < cost) reason = short(cost);
    const effect = levelLine(b.type, to);
    info.upgrade = {
      label: t('building.card.upgrade', { cost, time: seconds }),
      next: effect ? t('building.card.upgrade_next', { effect }) : '',
      enabled: !reason,
      reason,
    };
  }
  // Boost heroes (§7): every button of this building type.
  for (const r of BOOSTS[b.type] ?? []) {
    const cd = Math.ceil(b.boostCd?.[r.id] ?? 0);
    const near = ours(r.radius ?? 2);
    let reason = '';
    if (cd > 0) reason = t('building.card.disabled.cooldown', { time: cd });
    else if (r.energy > energy) reason = short(r.energy);
    else if (r.id === 'emergency_ration' && !near.some((u) => u.hp < unitMaxHp(u))) reason = t('building.card.disabled.no_wounded');
    else if (r.id === 'rest' && !near.some((u) => u.hp < unitMaxHp(u))) reason = t('building.card.disabled.no_wounded');
    else if (r.id === 'urgent_surgery' && near.every((u) => !u.stumps?.length) && near.some((u) => u.stumps)) reason = t('building.card.disabled.no_stump');
    else if ((r.target === 'one_hero' || r.target === 'own_hero_type') && !near.length) reason = t('building.card.disabled.no_hero_near');
    else if (r.id === 'train_star' && near.length && near.every((u) => (u.stars ?? 0) >= MAX_STARS)) reason = t('building.card.disabled.max_stars');
    const key = r.textKey ?? `building.boost.${r.id}`;
    info.boosts.push({ id: r.id, name: txt(`${key}.name`) || r.name_ru || r.id, desc: txt(`${key}.desc`), energy: r.energy, cd, enabled: !reason, reason });
  }
  // Trophies (forge recolor, rotation swap): a row each, only where the building has the action.
  const dRecolor = buildingDefs[b.type]?.recolor;
  if (dRecolor) {
    const cd = Math.ceil(b.recolorCooldown ?? 0);
    const reach = heroesInReach(world, b, me, dRecolor.radius);
    let reason = '';
    if (cd > 0) reason = t('building.card.disabled.cooldown', { time: cd });
    else if (dRecolor.energyCost > energy) reason = short(dRecolor.energyCost);
    else if (!reach.some((u) => Object.keys(u.parts).length > 0)) reason = t('building.card.disabled.no_trophy_near');
    info.trophies.push({ id: 'recolor', name: txt('building.trophy.recolor.name') || 'Перекраска', desc: txt('building.trophy.recolor.desc'), energy: dRecolor.energyCost, cd, enabled: !reason, reason });
  }
  const dSwap = buildingDefs[b.type]?.swap;
  if (dSwap) {
    const cd = Math.ceil(b.swapCooldown ?? 0);
    let reason = '';
    if (cd > 0) reason = t('building.card.disabled.cooldown', { time: cd });
    else if (dSwap.energyCost > energy) reason = short(dSwap.energyCost);
    else if (!swapCommand(world, b, me)) reason = t('building.card.disabled.no_trophy_pair');
    info.trophies.push({ id: 'swap', name: txt('building.trophy.swap.name') || 'Ротация трофеев', desc: txt('building.trophy.swap.desc'), energy: dSwap.energyCost, cd, enabled: !reason, reason });
  }
  // Demolish (§8): never the Command Center; half of what was put in, times the HP left.
  if (!DEMOLISH.forbidden.includes(b.type)) {
    const invested = b.invested ?? price + (level >= 2 ? upgradeCost(b.type, 2, b.hero).cost : 0) + (level >= 3 ? upgradeCost(b.type, 3, b.hero).cost : 0);
    const hpFrac = DEMOLISH.refundScalesWithHpFraction ? Math.max(0, Math.min(1, b.hp / maxHp)) : 1;
    const refund = Math.floor(invested * DEMOLISH.refundFactorOfInvested * hpFrac);
    const near = enemyWithin(DEMOLISH.blockedIfEnemyWithin);
    info.demolish = { refund, enabled: !near, reason: near ? t('building.card.disabled.enemy_near') : '', lowHp: hpFrac < 0.5 };
  }
  return info;
}

// ---------------------------------------------------------------- drawing

type Ev = Phaser.Types.Input.EventData;
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
const stop = (ev: Ev) => ev.stopPropagation();

/** Level chevrons ▲ (art 179 replaces them when it lands: `ui.chevron`). */
function chevrons(g: Phaser.GameObjects.Graphics, x: number, y: number, level: number, max: number): number {
  const s = 22;
  for (let k = 0; k < max; k++) {
    const cx = x + k * (s + 6);
    g.fillStyle(k < level ? C.amber : 0xc6d4d9, 1);
    g.fillTriangle(cx, y + s, cx + s / 2, y + 4, cx + s, y + s);
    g.fillStyle(k < level ? 0xffd77a : 0xdfe7ea, 1);
    g.fillTriangle(cx + 5, y + s - 3, cx + s / 2, y + 10, cx + s - 5, y + s - 3);
    g.lineStyle(2, C.graphite, 0.7);
    g.strokeTriangle(cx, y + s, cx + s / 2, y + 4, cx + s, y + s);
  }
  return max * (s + 6);
}

/**
 * The card, anchored to the bottom of `box`, as tall as its content (never taller than `maxH`).
 * `armed` = the action waiting for a second tap (demolish, or the Forge's element pick).
 */
export function buildingCard(scene: Phaser.Scene, box: Box, info: BuildingInfo, depth: number, armed: CardActionId | null, act: (id: CardActionId) => void, close: () => void, maxH = 900): Phaser.GameObjects.Container {
  const { x, w } = box;
  const bottom = box.y + box.h;
  const c = scene.add.container(0, 0).setDepth(depth);
  const body = scene.add.container(0, 0);
  const g = scene.add.graphics();
  const eat = scene.add.zone(x, 0, w, 10).setOrigin(0).setInteractive();
  eat.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Ev) => stop(ev));
  c.add([eat, g, body]);
  const pad = 24;
  const inner = w - pad * 2;
  const small = LANDSCAPE ? 0.92 : 1;
  const fs = (n: number) => Math.round(n * small);
  let y = pad;

  // --- Head: picture well, name, chevrons, ✕, HP, what it does now.
  const pw = 132;
  const ph = 132;
  const hg = scene.add.graphics();
  body.add(hg);
  hg.fillStyle(0xeaf5f8, 1);
  hg.fillRect(x + pad, y, pw, ph);
  const pic = buildingPic(scene, info.type, x + pad + pw / 2, y + ph - 8, pw - 18, ph - 18, info.hero);
  if (pic) {
    if (info.state === 'ruins') pic.setTint(0x8a8f94);
    body.add(pic);
  }
  if (info.hero) {
    const tech = info.tech;
    if (tech) drawTechOrb(hg, tech, x + pad + 20, y + 20, 14);
  }
  const tx = x + pad + pw + 20;
  const tw = w - (tx - x) - pad - 76;
  const nameKey = info.hero ? `building.station.${info.hero}.name` : `building.${info.type}.name`;
  const name = scene.add.text(tx, y - 2, hasText(nameKey) ? t(nameKey) : t(`building.${info.type}.name`), { ...TXT.body(fs(27), INK.graphite, '800'), wordWrap: { width: tw } });
  if (name.height > 74) name.setScale(74 / name.height);
  body.add(name);
  let hy = y + Math.min(74, name.height) + 8;
  const cw = chevrons(hg, tx, hy, info.level, info.maxLevel);
  const lvlText = info.level >= info.maxLevel ? t('building.card.level_max') : t('building.card.level', { level: info.level });
  body.add(scene.add.text(tx + cw + 8, hy + 13, lvlText, TXT.body(fs(18), INK.dim, '700')).setOrigin(0, 0.5));
  hy += 34;
  // HP.
  const bw = w - (tx - x) - pad - 96;
  const frac = info.maxHp > 0 ? info.hp / info.maxHp : 0;
  hg.fillStyle(0xdfe7ea, 1);
  hg.fillRoundedRect(tx, hy, bw, 14, 7);
  hg.fillStyle(frac > 0.6 ? C.green : frac > 0.3 ? C.amber : C.coralInk, 1);
  if (frac > 0) hg.fillRoundedRect(tx, hy, Math.max(14, bw * frac), 14, 7);
  body.add(scene.add.text(tx + bw + 10, hy + 7, `${info.hp}/${info.maxHp}`, TXT.num(15, INK.dim)).setOrigin(0, 0.5));
  // ✕.
  const xg = scene.add.graphics();
  chip(xg, x + w - pad - 60, y - 4, 60, 56, C.graphite, 1, 12);
  const xx = scene.add.text(x + w - pad - 30, y + 24, '✕', TXT.num(24, INK.white)).setOrigin(0.5);
  const xhit = scene.add.zone(x + w - pad - 72, y - 16, 84, 80).setOrigin(0).setInteractive({ useHandCursor: true });
  xhit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Ev) => {
    stop(ev);
    close();
  });
  body.add([xg, xx, xhit]);
  y = Math.max(y + ph, hy + 14) + 14;
  // What it does now (full width under the picture).
  if (info.now) {
    const now = scene.add.text(x + pad, y, info.now, { ...TXT.body(fs(20), INK.graphite, '600'), wordWrap: { width: inner }, lineSpacing: 2 });
    body.add(now);
    y += now.height + 14;
  }

  // A big action button: label, optional progress fill, enabled/disabled look.
  const bigButton = (id: CardActionId | null, label: string, tone: 'primary' | 'amber' | 'grey' | 'danger', h: number, progress = -1, bx = x + pad, bwid = inner) => {
    const gg = scene.add.graphics();
    const fill = tone === 'primary' ? C.teal : tone === 'amber' ? C.amber : tone === 'danger' ? C.coralInk : 0xe3e8ea;
    chip(gg, bx, y, bwid, h, fill, 1, 14, tone === 'grey' ? { color: 0xc6d4d9, width: 3 } : undefined);
    if (progress >= 0) {
      gg.fillStyle(C.teal, 1);
      gg.fillRect(bx + 3, y + 3, (bwid - 6) * Math.min(1, progress), h - 6);
    }
    const ink = tone === 'grey' && progress < 0 ? INK.dim : INK.white;
    const lab = scene.add.text(bx + bwid / 2, y + h / 2, label, { ...TXT.body(fs(23), ink, '800'), align: 'center' }).setOrigin(0.5);
    if (lab.width > bwid - 24) lab.setScale((bwid - 24) / lab.width);
    body.add([gg, lab]);
    if (id) {
      const hit = scene.add.zone(bx, y, bwid, h).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Ev) => {
        stop(ev);
        act(id);
      });
      body.add(hit);
    }
    y += h + 8;
  };
  const line = (s: string, color: string, size = 19, weight = '600', at = x + pad, width = inner) => {
    if (!s) return;
    const tl = scene.add.text(at, y, s, { ...TXT.body(fs(size), color, weight), wordWrap: { width }, lineSpacing: 2 });
    body.add(tl);
    y += tl.height + 6;
  };

  if (info.state === 'ruins' && info.rebuild) {
    bigButton('rebuild', t('building.card.rebuild', { cost: info.rebuild.cost }), info.rebuild.enabled ? 'primary' : 'grey', 88);
    line(info.rebuild.enabled ? t('building.card.rebuild_hint') : info.rebuild.reason, info.rebuild.enabled ? INK.dim : INK.coral);
  } else if (info.state === 'building' && info.cancel) {
    bigButton(null, `${Math.floor(info.progress * 100)} %`, 'grey', 56, info.progress);
    bigButton('cancel', t('building.card.cancel_build', { energy: info.cancel.refund }), 'grey', 76);
    line(t('building.card.cancel_build_hint'), INK.dim);
  } else if (info.state === 'demolishing') {
    bigButton(null, t('building.demolish.progress'), 'grey', 76, info.progress);
  } else {
    // Upgrade.
    if (info.state === 'upgrading') {
      bigButton(null, `${Math.floor(info.progress * 100)} %`, 'grey', 76, info.progress);
      line(info.upgradingLine, INK.teal, 19, '700');
    } else if (info.upgrade) {
      const max = info.level >= info.maxLevel;
      bigButton(max ? null : 'upgrade', info.upgrade.label, info.upgrade.enabled ? 'primary' : 'grey', 88);
      if (!max && info.upgrade.next) line(info.upgrade.next, info.upgrade.enabled ? INK.teal : INK.dim, 19, '700');
      if (!max && info.upgrade.reason) line(info.upgrade.reason, INK.coral, 19, '700');
    }
    // Boost heroes.
    if (info.boosts.length) {
      y += 6;
      body.add(scene.add.text(x + pad, y, t('building.card.boost').toUpperCase(), TXT.caps(INK.amber)));
      y += 30;
      const btnW = LANDSCAPE ? 190 : 200;
      for (const r of info.boosts) {
        const top = y;
        const textW = inner - btnW - 16;
        const nm = scene.add.text(x + pad, y, r.name, { ...TXT.body(fs(21), INK.graphite, '800'), wordWrap: { width: textW } });
        body.add(nm);
        y += nm.height + 2;
        line(r.enabled ? r.desc : r.reason, r.enabled ? INK.dim : INK.coral, 17, '500', x + pad, textW);
        const rowH = Math.max(76, y - top);
        // Button on the right: price, or the cooldown.
        const bx = x + w - pad - btnW;
        const gg = scene.add.graphics();
        chip(gg, bx, top, btnW, 76, r.enabled ? C.amber : 0xe3e8ea, 1, 14, r.enabled ? undefined : { color: 0xc6d4d9, width: 3 });
        const priceText = r.cd > 0 ? `${r.cd} с` : r.energy > 0 ? `${r.energy} ⚡` : '0 ⚡';
        const pt = scene.add.text(bx + btnW / 2, top + 38, priceText, TXT.num(fs(24), r.enabled ? INK.white : INK.dim)).setOrigin(0.5);
        const hit = scene.add.zone(bx, top, btnW, 76).setOrigin(0).setInteractive({ useHandCursor: true });
        hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Ev) => {
          stop(ev);
          act(`boost:${r.id}`);
        });
        body.add([gg, pt, hit]);
        y = top + rowH + 10;
        // The Forge asks which element (building.boost.element_coat.pick).
        if (armed === `boost:${r.id}` && r.id === 'element_coat') {
          line(t('building.boost.element_coat.pick'), INK.graphite, 19, '700');
          const techs = ['thermo', 'cryo', 'volt', 'toxin', 'impact'];
          const og = scene.add.graphics();
          body.add(og);
          const step = inner / techs.length;
          techs.forEach((tech, k) => {
            const ox = x + pad + step * k + step / 2;
            drawTechOrb(og, tech, ox, y + 30, 26);
            const oh = scene.add.zone(ox - step / 2, y, step, 64).setOrigin(0).setInteractive({ useHandCursor: true });
            oh.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Ev) => {
              stop(ev);
              act(`coat:${tech}`);
            });
            body.add(oh);
            body.add(scene.add.text(ox, y + 66, t(`tech.${tech}`), TXT.body(15, INK.dim, '700')).setOrigin(0.5, 0));
          });
          y += 96;
        }
      }
    }
      // Trophies: the forge and the rotation centre.
    if (info.trophies.length) {
      y += 6;
      body.add(scene.add.text(x + pad, y, t('building.card.trophy').toUpperCase(), TXT.caps(INK.amber)));
      y += 30;
      const btnW = LANDSCAPE ? 190 : 200;
      for (const r of info.trophies) {
        const top = y;
        const textW = inner - btnW - 16;
        const nm = scene.add.text(x + pad, y, r.name, { ...TXT.body(fs(21), INK.graphite, '800'), wordWrap: { width: textW } });
        body.add(nm);
        y += nm.height + 2;
        line(r.enabled ? r.desc : r.reason, r.enabled ? INK.dim : INK.coral, 17, '500', x + pad, textW);
        const rowH = Math.max(76, y - top);
        const bx = x + w - pad - btnW;
        const gg = scene.add.graphics();
        chip(gg, bx, top, btnW, 76, r.enabled ? C.amber : 0xe3e8ea, 1, 14, r.enabled ? undefined : { color: 0xc6d4d9, width: 3 });
        const priceText = r.cd > 0 ? `${r.cd} с` : r.energy > 0 ? `${r.energy} ⚡` : '0 ⚡';
        const pt = scene.add.text(bx + btnW / 2, top + 38, priceText, TXT.num(fs(24), r.enabled ? INK.white : INK.dim)).setOrigin(0.5);
        const hit = scene.add.zone(bx, top, btnW, 76).setOrigin(0).setInteractive({ useHandCursor: true });
        hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Ev) => {
          stop(ev);
          act(r.id);
        });
        body.add([gg, pt, hit]);
        y = top + rowH + 10;
        // The forge asks which element the trophy takes; the current one is not offered.
        if (armed === 'recolor' && r.id === 'recolor') {
          line(t('building.trophy.recolor.pick'), INK.graphite, 19, '700');
          const techs = ['thermo', 'cryo', 'volt', 'toxin', 'impact'];
          const og = scene.add.graphics();
          body.add(og);
          const step = inner / techs.length;
          techs.forEach((tech, k) => {
            const ox = x + pad + step * k + step / 2;
            drawTechOrb(og, tech, ox, y + 30, 26);
            const oh = scene.add.zone(ox - step / 2, y, step, 64).setOrigin(0).setInteractive({ useHandCursor: true });
            oh.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Ev) => {
              stop(ev);
              act(`recolor:${tech}`);
            });
            body.add(oh);
            body.add(scene.add.text(ox, y + 66, t(`tech.${tech}`), TXT.body(15, INK.dim, '700')).setOrigin(0.5, 0));
          });
          y += 96;
        }
      }
    }
    // Demolish: small, at the bottom, second tap confirms.
    if (info.demolish) {
      y += 6;
      const d = info.demolish;
      const isArmed = armed === 'demolish';
      const dw = isArmed ? inner : Math.min(inner, 300);
      const gg = scene.add.graphics();
      chip(gg, x + pad, y, dw, 60, isArmed ? C.coralInk : C.white, 1, 12, { color: d.enabled ? C.coralInk : 0xc6d4d9, width: 3 });
      const label = isArmed ? t('building.demolish.confirm') : t('building.card.demolish', { energy: d.refund });
      const dl = scene.add.text(x + pad + dw / 2, y + 30, label, TXT.body(fs(19), isArmed ? INK.white : d.enabled ? INK.coral : INK.dim, '800')).setOrigin(0.5);
      if (dl.width > dw - 20) dl.setScale((dw - 20) / dl.width);
      const hit = scene.add.zone(x + pad, y, dw, 60).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Ev) => {
        stop(ev);
        act('demolish');
      });
      body.add([gg, dl, hit]);
      if (!isArmed && (d.reason || d.lowHp)) {
        const note = scene.add.text(x + pad + dw + 14, y + 30, d.reason || t('building.demolish.low_hp'), { ...TXT.body(fs(16), d.reason ? INK.coral : INK.dim, '600'), wordWrap: { width: inner - dw - 14 } }).setOrigin(0, 0.5);
        body.add(note);
      }
      y += 60;
    }
  }
  y += pad;
  // Plate behind everything, anchored to the bottom of the box; very long cards shrink a little.
  const h = y;
  const k = h > maxH ? maxH / h : 1;
  const top = bottom - h * k;
  plate(g, x, top, w, h * k, 28);
  body.setPosition(x - x * k, top).setScale(k);
  eat.setPosition(x, top).setSize(w, h * k);
  eat.input?.hitArea.setTo(0, 0, w, h * k);
  return c;
}
