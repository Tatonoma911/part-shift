import buildingsJson from '../data/design/buildings.json';
import configJson from '../data/design/config.json';
import enemiesJson from '../data/design/enemies.json';
import partsJson from '../data/design/parts.json';
import unitsJson from '../data/design/units.json';
import type { ClipId } from './clips';

/**
 * What the guide contains. Names and descriptions are the writer's keys from
 * text/ru.json; explanations are learning keys; numbers are read from the game
 * designer's JSON, so a balance change shows up here without edits.
 */

export type Visual =
  | { kind: 'anim'; set: string; anim: string; scale?: number }
  | { kind: 'image'; key: string; scale?: number }
  | { kind: 'glyph'; channel: 'threat' | 'finds' | 'demon' | 'safe' | 'danger' | 'caution' | 'many' | 'empty' };

export interface Entry {
  id: string;
  name: string;
  /** Short line under the name in lists, and the first paragraph of the entry. */
  desc: string;
  /** Further paragraphs ("how it works"). */
  how?: string[];
  visual?: Visual;
  clip?: ClipId;
  tip?: string;
  stats?: () => [string, string][];
  related?: string[];
}

export interface Lesson {
  id: string;
  clip: ClipId;
}

export interface Section {
  id: string;
  icon: string;
  entries: Entry[];
}

type Num = number | string;
const sec = (v: Num): string => `stat.sec|${v}`;
const en = (v: Num): string => `stat.energy|${v}`;
const plain = (v: Num): string => `|${v}`;

const B = Object.fromEntries((buildingsJson as { buildings: Record<string, unknown>[] }).buildings.map((b) => [b.id as string, b])) as Record<string, Record<string, unknown> & { cost: number; buildSeconds: number; hp: number }>;
const U = Object.fromEntries((unitsJson as { units: Record<string, unknown>[] }).units.map((u) => [u.id as string, u])) as Record<string, Record<string, number>>;
const E = Object.fromEntries((enemiesJson as { enemies: Record<string, unknown>[] }).enemies.map((u) => [u.id as string, u])) as Record<string, Record<string, number>>;
const S = Object.fromEntries((enemiesJson as { sites: Record<string, unknown>[] }).sites.map((u) => [u.id as string, u])) as Record<string, Record<string, number>>;
const P = Object.fromEntries((partsJson as { parts: { id: string; tiers: Record<string, number>[] }[] }).parts.map((p) => [p.id, p])) as Record<string, { tiers: Record<string, number>[] }>;
const cfg = configJson as unknown as { defenders: { trainCost: number; trainSeconds: number }; population: { spawnSeconds: number }; economy: { startEnergy: number; energyPerDugTile: number; cacheEnergy: number } };

function buildingStats(id: string): () => [string, string][] {
  return () => {
    const b = B[id];
    const out: [string, string][] = [];
    if (b.cost) out.push(['stat.cost', en(b.cost)]);
    if (b.buildSeconds) out.push(['stat.build', sec(b.buildSeconds)]);
    out.push(['stat.hp', plain(b.hp)]);
    if (b.residentSlots) out.push(['stat.slots', plain(b.residentSlots as number)]);
    if (b.territoryRadius) out.push(['stat.radius', `stat.cells|${b.territoryRadius}`]);
    return out;
  };
}

function fighterStats(u: Record<string, number>, chance?: number): () => [string, string][] {
  return () => {
    const out: [string, string][] = [
      ['stat.hp', plain(u.hp)],
      ['stat.damage', plain(u.damage)],
      ['stat.defense', plain(u.defense)],
      ['stat.attack', sec(u.attackSeconds)],
      ['stat.speed', plain(u.speed)],
    ];
    if (chance !== undefined) out.push(['stat.chance', plain(`${Math.round(chance * 100)} %`)]);
    if (u.reward) out.push(['stat.reward', en(u.reward)]);
    return out;
  };
}

function partStats(id: string): () => [string, string][] {
  return () => {
    const tiers = P[id]?.tiers ?? [];
    const out: [string, string][] = [];
    for (const t of tiers) {
      const bits: string[] = [];
      if (t.damage) bits.push(`+${t.damage} ⚔`);
      if (t.hp) bits.push(`+${t.hp} ♥`);
      if (t.defense) bits.push(`+${t.defense} ⛨`);
      if (t.speed) bits.push(`+${t.speed} »`);
      if (t.slowPercent) bits.push(`−${t.slowPercent}%`);
      out.push([`stat.tier`, `|${t.tier}: ${bits.join(' ')}`]);
    }
    return out;
  };
}

export const LESSONS: Lesson[] = [
  { id: 'start', clip: 'start' },
  { id: 'dig', clip: 'dig' },
  { id: 'clue', clip: 'clue' },
  { id: 'deduce', clip: 'deduce' },
  { id: 'build', clip: 'build' },
  { id: 'fight', clip: 'order' },
  { id: 'parts', clip: 'parts' },
  { id: 'demon', clip: 'demon' },
];

export const SECTIONS: Section[] = [
  {
    id: 'clues',
    icon: 'icon.danger',
    entries: [
      { id: 'clue.threat', name: 'clue.threat.name', desc: 'clue.threat.text', visual: { kind: 'glyph', channel: 'threat' }, clip: 'clue', related: ['clue.danger', 'enemy.nest'] },
      { id: 'clue.finds', name: 'clue.finds.name', desc: 'clue.finds.text', visual: { kind: 'glyph', channel: 'finds' }, clip: 'clue', related: ['map.cache', 'map.survivor'] },
      { id: 'clue.demon', name: 'clue.demon.name', desc: 'clue.demon.text', visual: { kind: 'glyph', channel: 'demon' }, clip: 'demon', related: ['enemy.hatch', 'enemy.demon'] },
      { id: 'clue.many', name: 'clue.many.name', desc: 'clue.many.text', visual: { kind: 'glyph', channel: 'many' } },
      { id: 'clue.empty', name: 'clue.empty.name', desc: 'clue.empty.text', visual: { kind: 'glyph', channel: 'empty' }, clip: 'cascade' },
      { id: 'clue.safe', name: 'clue.safe.name', desc: 'clue.safe.text', visual: { kind: 'glyph', channel: 'safe' }, clip: 'deduce', tip: 'lesson.deduce.tip' },
      { id: 'clue.danger', name: 'clue.danger.name', desc: 'clue.danger.text', visual: { kind: 'glyph', channel: 'danger' }, clip: 'nest' },
      { id: 'clue.caution', name: 'clue.caution.name', desc: 'clue.caution.text', visual: { kind: 'glyph', channel: 'caution' }, clip: 'caution' },
      { id: 'clue.scanner', name: 'clue.scanner.name', desc: 'clue.scanner.text', visual: { kind: 'image', key: 'icon.marker' }, clip: 'deduce' },
      { id: 'clue.accident', name: 'clue.accident.name', desc: 'clue.accident.text', visual: { kind: 'anim', set: 'nest', anim: 'pulse' } },
    ],
  },
  {
    id: 'resources',
    icon: 'icon.energy',
    entries: [
      { id: 'res.energy', name: 'resource.energy.name', desc: 'res.energy.text', how: ['res.energy.how'], visual: { kind: 'anim', set: 'fx', anim: 'energy_orb', scale: 2 }, clip: 'energy', stats: () => [['stat.start', plain(cfg.economy.startEnergy)], ['stat.per_block', plain(cfg.economy.energyPerDugTile)], ['stat.cache', plain(cfg.economy.cacheEnergy)]] },
      { id: 'res.residents', name: 'resource.residents.name', desc: 'res.residents.text', visual: { kind: 'anim', set: 'resident', anim: 'walk' }, related: ['building.home', 'unit.resident'] },
      { id: 'res.squad', name: 'resource.squad_cap.name', desc: 'res.squad.text', visual: { kind: 'image', key: 'icon.defender' }, related: ['building.school'] },
      { id: 'res.threat', name: 'res.threat.name', desc: 'res.threat.text', visual: { kind: 'image', key: 'icon.timer' }, clip: 'threat', tip: 'lesson.demon.tip' },
    ],
  },
  {
    id: 'buildings',
    icon: 'icon.build',
    entries: ['command', 'home', 'reactor', 'cooler', 'school', 'medcenter'].map((id) => ({
      id: `building.${id}`,
      name: `building.${id}.name`,
      desc: `building.${id}.desc`,
      visual: { kind: 'image', key: `building.${id}`, scale: 2 } as Visual,
      clip: id === 'school' ? ('build' as ClipId) : id === 'reactor' ? ('energy' as ClipId) : id === 'command' ? ('start' as ClipId) : undefined,
      tip: id === 'school' ? 'lesson.build.tip' : undefined,
      stats: buildingStats(id),
    })),
  },
  {
    id: 'people',
    icon: 'icon.resident',
    entries: [
      { id: 'unit.resident', name: 'unit.resident.name', desc: 'unit.resident.desc', how: ['people.resident.how'], visual: { kind: 'anim', set: 'resident', anim: 'dig', scale: 3 }, clip: 'dig', stats: () => [['stat.hp', plain(U.resident.hp)], ['stat.speed', plain(U.resident.speed)]] },
      {
        id: 'unit.defender',
        name: 'unit.defender.name',
        desc: 'unit.defender.desc',
        how: ['people.defender.how'],
        visual: { kind: 'anim', set: 'defender', anim: 'attack', scale: 3 },
        clip: 'order',
        stats: () => [...fighterStats(U.defender)(), ['stat.cost', en(cfg.defenders.trainCost)]],
        related: ['parts.how', 'people.ranks'],
      },
      { id: 'people.ranks', name: 'people.ranks.name', desc: 'people.ranks.text', visual: { kind: 'anim', set: 'defender', anim: 'install_part', scale: 3 }, clip: 'parts' },
    ],
  },
  {
    id: 'parts',
    icon: 'icon.part',
    entries: [
      { id: 'parts.how', name: 'parts.how.name', desc: 'parts.how.text', how: ['parts.tech.text'], visual: { kind: 'anim', set: 'adaptant_thermo', anim: 'rip_part', scale: 3 }, clip: 'parts', tip: 'lesson.parts.tip' },
      { id: 'parts.slots', name: 'parts.slots.name', desc: 'parts.slots.text', visual: { kind: 'anim', set: 'defender', anim: 'install_part', scale: 3 } },
      ...['thermo_arm', 'cryo_arm', 'volt_arm', 'impact_arm', 'runner_leg', 'piston_leg', 'drill_tail'].map((id) => ({
        id: `part.${id}`,
        name: `part.${id}.label`,
        desc: `part.${id}.text`,
        visual: { kind: 'anim', set: id === 'thermo_arm' ? 'adaptant_thermo' : id === 'cryo_arm' ? 'adaptant_cryo' : id === 'volt_arm' ? 'adaptant_volt' : id === 'drill_tail' ? 'demon' : 'heavy_adaptant', anim: 'idle', scale: id === 'drill_tail' || id === 'impact_arm' || id === 'piston_leg' ? 2 : 3 } as Visual,
        stats: partStats(id),
      })),
    ],
  },
  {
    id: 'enemies',
    icon: 'icon.lair',
    entries: [
      { id: 'enemy.adaptant', name: 'enemy.adaptant.name', desc: 'enemy.adaptant.desc', how: ['enemy.adaptant.how', 'enemy.adaptant.techs'], visual: { kind: 'anim', set: 'adaptant_cryo', anim: 'walk', scale: 3 }, clip: 'order', stats: fighterStats(E.adaptant, E.adaptant.partDropChance) },
      { id: 'enemy.heavy', name: 'enemy.heavy_adaptant.name', desc: 'enemy.heavy_adaptant.desc', how: ['enemy.heavy.how'], visual: { kind: 'anim', set: 'heavy_adaptant', anim: 'attack', scale: 2 }, stats: fighterStats(E.heavy_adaptant, E.heavy_adaptant.partDropChance) },
      { id: 'enemy.nest', name: 'site.nest.name', desc: 'site.nest.desc', how: ['enemy.nest.how'], visual: { kind: 'anim', set: 'nest', anim: 'pulse', scale: 3 }, clip: 'nest', stats: () => [['stat.hp', plain(S.nest.hp)], ['stat.defense', plain(S.nest.defense)], ['stat.reward', en(S.nest.reward)]] },
      { id: 'enemy.heavy_nest', name: 'site.heavy_nest.name', desc: 'site.heavy_nest.desc', visual: { kind: 'anim', set: 'heavy_nest', anim: 'pulse', scale: 3 }, stats: () => [['stat.hp', plain(S.heavy_nest.hp)], ['stat.reward', en(S.heavy_nest.reward)]] },
      { id: 'enemy.demon', name: 'enemy.demon.name', desc: 'enemy.demon.desc', how: ['enemy.demon.how'], visual: { kind: 'anim', set: 'demon', anim: 'tail_swing', scale: 2.4 }, clip: 'demon', tip: 'lesson.demon.tip', stats: fighterStats(E.demon) },
      { id: 'enemy.hatch', name: 'site.demon_hatch.name', desc: 'site.demon_hatch.desc', how: ['enemy.hatch.how'], visual: { kind: 'anim', set: 'demon_hatch', anim: 'steam', scale: 3 }, clip: 'demon' },
    ],
  },
  {
    id: 'map',
    icon: 'icon.house',
    entries: [
      { id: 'map.ground', name: 'terrain.ground.name', desc: 'terrain.ground.desc', visual: { kind: 'image', key: 'tile.ground_grass_1', scale: 3 } },
      { id: 'map.rubble', name: 'terrain.rubble.name', desc: 'terrain.rubble.desc', how: ['map.rubble.how'], visual: { kind: 'image', key: 'tile.rubble_0', scale: 3 } },
      { id: 'map.vein', name: 'terrain.energy_vein.name', desc: 'terrain.energy_vein.desc', how: ['map.vein.how'], visual: { kind: 'image', key: 'tile.vein_0_1', scale: 3 }, clip: 'energy' },
      { id: 'map.water', name: 'terrain.water.name', desc: 'terrain.water.desc', how: ['map.water.how'], visual: { kind: 'image', key: 'tile.water_1', scale: 3 } },
      { id: 'map.cache', name: 'site.cache.name', desc: 'site.cache.desc', how: ['map.cache.how'], visual: { kind: 'image', key: 'tile.cache', scale: 3 }, clip: 'energy', stats: () => [['stat.reward', en(cfg.economy.cacheEnergy)]] },
      { id: 'map.survivor', name: 'site.survivor.name', desc: 'site.survivor.desc', how: ['map.survivor.how'], visual: { kind: 'anim', set: 'resident', anim: 'idle', scale: 3 } },
    ],
  },
  {
    id: 'controls',
    icon: 'icon.dig',
    entries: [
      { id: 'ctrl.tap', name: 'ctrl.tap.name', desc: 'ctrl.tap.text', clip: 'start' },
      { id: 'ctrl.swipe', name: 'ctrl.swipe.name', desc: 'ctrl.swipe.text', clip: 'dig' },
      { id: 'ctrl.hold', name: 'ctrl.hold.name', desc: 'ctrl.hold.text', clip: 'caution' },
      { id: 'ctrl.order', name: 'ctrl.order.name', desc: 'ctrl.order.text', clip: 'order' },
      { id: 'ctrl.build', name: 'ctrl.build.name', desc: 'ctrl.build.text', clip: 'build' },
      { id: 'ctrl.pause', name: 'ctrl.pause.name', desc: 'ctrl.pause.text', visual: { kind: 'image', key: 'icon.pause', scale: 3 } },
      { id: 'ctrl.keys', name: 'ctrl.keys.name', desc: 'ctrl.keys.text', visual: { kind: 'image', key: 'icon.settings', scale: 3 } },
    ],
  },
  {
    id: 'world',
    icon: 'portrait.bld_command',
    entries: [
      { id: 'world.city', name: 'world.city.name', desc: 'world.city.text', visual: { kind: 'image', key: 'portrait.bld_command', scale: 1 } },
      { id: 'world.heroout', name: 'world.heroout.name', desc: 'world.heroout.text', visual: { kind: 'image', key: 'building.medcenter', scale: 2 } },
      { id: 'world.splice', name: 'world.splice.name', desc: 'world.splice.text', visual: { kind: 'anim', set: 'defender', anim: 'install_part', scale: 3 } },
      { id: 'world.catastrophe', name: 'world.catastrophe.name', desc: 'world.catastrophe.text', visual: { kind: 'anim', set: 'bld_reactor', anim: 'damaged', scale: 2 } },
      { id: 'world.adaptants', name: 'world.adaptants.name', desc: 'world.adaptants.text', visual: { kind: 'anim', set: 'adaptant_volt', anim: 'walk', scale: 3 } },
      { id: 'world.control', name: 'world.control.name', desc: 'world.control.text', visual: { kind: 'image', key: 'icon.settings', scale: 3 } },
      { id: 'world.you', name: 'world.you.name', desc: 'world.you.text', visual: { kind: 'image', key: 'building.command', scale: 2 } },
    ],
  },
];

/** Quick lookup for related links and coach topics. */
export const ENTRY = new Map<string, Entry>(SECTIONS.flatMap((s) => s.entries.map((e) => [e.id, e] as [string, Entry])));

/** Section that holds an entry. */
export function sectionOf(id: string): Section | undefined {
  return SECTIONS.find((s) => s.entries.some((e) => e.id === id));
}

/** Just-in-time cards: which clip and texts a game moment shows the first time it happens. */
export const COACH: Record<string, { name: string; title: string; text: string; clip: ClipId; entry?: string }> = {
  clue: { name: 'coach.clue.name', title: 'lesson.clue.title', text: 'lesson.clue.text', clip: 'clue', entry: 'clue.threat' },
  deduce: { name: 'coach.clue.name', title: 'lesson.deduce.title', text: 'lesson.deduce.text', clip: 'deduce', entry: 'clue.safe' },
  finds: { name: 'coach.finds.name', title: 'coach.finds.title', text: 'coach.finds.text', clip: 'clue', entry: 'clue.finds' },
  build: { name: 'coach.build.name', title: 'lesson.build.title', text: 'lesson.build.text', clip: 'build', entry: 'building.school' },
  fight: { name: 'coach.fight.name', title: 'lesson.fight.title', text: 'lesson.fight.text', clip: 'nest', entry: 'enemy.nest' },
  parts: { name: 'coach.parts.name', title: 'lesson.parts.title', text: 'lesson.parts.text', clip: 'parts', entry: 'parts.how' },
  threat: { name: 'coach.threat.name', title: 'coach.threat.title', text: 'coach.threat.text', clip: 'threat', entry: 'res.threat' },
  demon: { name: 'coach.demon.name', title: 'lesson.demon.title', text: 'lesson.demon.text', clip: 'demon', entry: 'enemy.demon' },
};

/** Game events (core/world GameEvent.type) that open a coach card the first time. */
export const EVENT_TOPIC: Record<string, string> = {
  nest_open: 'fight',
  heavy_nest_open: 'fight',
  part_attached: 'parts',
  threat_level_up: 'threat',
  demon_warning: 'demon',
  demon_awake: 'demon',
};
