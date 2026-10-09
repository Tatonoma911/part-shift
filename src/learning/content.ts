import buildingsJson from '../data/design/buildings.json';
import configJson from '../data/design/config.json';
import elementsJson from '../data/design/elements.json';
import enemiesJson from '../data/design/enemies.json';
import heroesJson from '../data/design/heroes.json';
import partsJson from '../data/design/parts.json';
import unitsJson from '../data/design/units.json';
import type { ClipId } from './clips';

/**
 * What the guide contains. Names and descriptions are the writer's keys from
 * text/ru.json; explanations are learning keys; numbers are read from the game
 * designer's JSON, so a balance change shows up here without edits. Every
 * number is optional: a field the current tables lack is simply not shown.
 */

export type Tech = 'volt' | 'cryo' | 'thermo' | 'toxin' | 'impact';

export type Visual =
  | { kind: 'anim'; set: string; anim: string; scale?: number }
  | { kind: 'image'; key: string; scale?: number }
  | { kind: 'glyph'; channel: 'threat' | 'finds' | 'boss' | 'safe' | 'danger' | 'caution' | 'many' | 'empty' }
  | { kind: 'cycle'; focus?: Tech };

export interface Entry {
  id: string;
  name: string;
  /** Short line under the name in lists, and the first paragraph of the entry. */
  desc: string;
  /** Further paragraphs ("how it works"). */
  how?: string[];
  /** Named sub-items (reactions, heroes' ally and unlock lines): [title key, text key]. */
  items?: [string, string][];
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
type Row = Record<string, unknown>;
const sec = (v: Num): string => `stat.sec|${v}`;
const en = (v: Num): string => `stat.energy|${v}`;
const plain = (v: Num): string => `|${v}`;
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const byId = (rows: unknown): Record<string, Row> => Object.fromEntries(((rows as Row[] | undefined) ?? []).map((r) => [r.id as string, r]));
const B = byId((buildingsJson as Row).buildings);
const U = byId((unitsJson as Row).units);
const E = byId((enemiesJson as Row).enemies);
const S = byId((enemiesJson as Row).sites);
const P = byId((partsJson as Row).parts);
const cfg = configJson as unknown as { economy?: Row };

interface Hero {
  id: string;
  tier: number;
  tech: string;
  enemy: { hp: number; damage: number; defense: number; speed: number; resist: Record<string, number>; flying?: boolean };
  drops: { slot: string; id: string }[];
}
const heroes = heroesJson as unknown as { heroes: Hero[]; bossPool?: { heroes?: string[] } };
export const HEROES: Hero[] = heroes.heroes;
const bossPool = new Set(heroes.bossPool?.heroes ?? []);
export const TECH_COLOR: Record<string, string> = Object.fromEntries(((elementsJson as Row).techs as { id: string; color: string }[]).map((t) => [t.id, t.color]));
/** Cycle order: each beats the next. */
export const CYCLE: Tech[] = ['volt', 'cryo', 'thermo', 'toxin', 'impact'];

/** Stat rows from whichever fields a table row has. */
function rows(r: Row | undefined, spec: [string, string, (v: Num) => string][]): [string, string][] {
  if (!r) return [];
  return spec.filter(([f]) => num(r[f])).map(([f, label, fmt]) => [label, fmt(r[f] as number)]);
}

function buildingStats(id: string): () => [string, string][] {
  return () =>
    rows(B[id], [
      ['cost', 'stat.cost', en],
      ['buildSeconds', 'stat.build', sec],
      ['hp', 'stat.hp', plain],
      ['territoryRadius', 'stat.radius', (v) => `stat.cells|${v}`],
    ]).filter(([k, v]) => !(k === 'stat.cost' && v === en(0)));
}

const FIGHT: [string, string, (v: Num) => string][] = [
  ['hp', 'stat.hp', plain],
  ['damage', 'stat.damage', plain],
  ['defense', 'stat.defense', plain],
  ['attackSeconds', 'stat.attack', sec],
  ['speed', 'stat.speed', plain],
];

function fighterStats(u: Row | undefined): () => [string, string][] {
  return () => {
    const out = rows(u, FIGHT);
    if (u && num(u.partDropChance)) out.push(['stat.chance', plain(`${Math.round(u.partDropChance * 100)} %`)]);
    return out;
  };
}

function partStats(id: string): () => [string, string][] {
  return () => {
    const tiers = (P[id]?.tiers as Record<string, number>[] | undefined) ?? [];
    return tiers.map((t) => {
      const bits: string[] = [];
      if (t.damage) bits.push(`+${t.damage} ⚔`);
      if (t.hp) bits.push(`+${t.hp} ♥`);
      if (t.defense) bits.push(`+${t.defense} ⛨`);
      if (t.speed) bits.push(`+${t.speed} »`);
      if (t.slowPercent) bits.push(`−${t.slowPercent}%`);
      return ['stat.tier', `|${t.tier}: ${bits.join(' ')}`] as [string, string];
    });
  };
}

/** Element names joined for a stat cell, as "tech.x,tech.y" resolved by the guide. */
const techList = (ids: string[]): string => `stat.techs|${ids.join(',')}`;

function heroStats(x: Hero): () => [string, string][] {
  return () => {
    const r = x.enemy.resist ?? {};
    const weak = CYCLE.filter((t) => (r[t] ?? 1) > 1);
    const strong = CYCLE.filter((t) => (r[t] ?? 1) < 1);
    const out: [string, string][] = [
      ['stat.level', plain(x.tier)],
      ['stat.tech', `tech.${x.tech}|`],
      ...rows(x.enemy as unknown as Row, FIGHT.slice(0, 3)),
    ];
    if (weak.length) out.push(['stat.weak', techList(weak)]);
    if (strong.length) out.push(['stat.resist', techList(strong)]);
    out.push(['hero.drops', `stat.parts|${x.drops.map((d) => d.id).join(',')}`]);
    if (bossPool.has(x.id)) out.push(['stat.boss', 'stat.yes|']);
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
  { id: 'elements', clip: 'elements' },
  { id: 'call', clip: 'call' },
];

const HERO_SCALE: Record<string, number> = { demon: 1.9, n73: 2.2 };

export const SECTIONS: Section[] = [
  {
    id: 'clues',
    icon: 'icon.marker',
    entries: [
      { id: 'clue.threat', name: 'clue.threat.name', desc: 'clue.threat.text', visual: { kind: 'glyph', channel: 'threat' }, clip: 'clue', related: ['clue.danger', 'enemy.nest', 'enemy.lair'] },
      { id: 'clue.boss', name: 'clue.boss.name', desc: 'clue.boss.text', visual: { kind: 'glyph', channel: 'boss' }, clip: 'call', related: ['enemy.boss', 'hero.call'] },
      { id: 'clue.finds', name: 'clue.finds.name', desc: 'clue.finds.text', visual: { kind: 'glyph', channel: 'finds' }, clip: 'clue', related: ['map.cache', 'map.survivor'] },
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
      {
        id: 'res.energy',
        name: 'resource.energy.name',
        desc: 'res.energy.text',
        how: ['res.energy.how'],
        visual: { kind: 'anim', set: 'fx', anim: 'energy_orb', scale: 2 },
        clip: 'energy',
        stats: () => rows(cfg.economy, [['startEnergy', 'stat.start', plain], ['energyPerDugTile', 'stat.per_block', plain], ['cacheEnergy', 'stat.cache', plain]]),
      },
      { id: 'res.residents', name: 'resource.residents.name', desc: 'res.residents.text', visual: { kind: 'anim', set: 'resident', anim: 'walk' }, related: ['unit.resident', 'building.home', 'building.school'] },
      { id: 'res.threat', name: 'res.threat.name', desc: 'res.threat.text', visual: { kind: 'image', key: 'icon.timer' }, clip: 'threat', tip: 'lesson.call.tip', related: ['hero.lairs'] },
    ],
  },
  {
    id: 'buildings',
    icon: 'icon.build',
    entries: ['command', 'home', 'reactor', 'cooler', 'school', 'medcenter'].map((id) => ({
      id: `building.${id}`,
      name: `building.${id}.name`,
      desc: `bld.${id}.text`,
      visual: { kind: 'image', key: `building.${id}`, scale: 2 } as Visual,
      clip: id === 'school' ? ('build' as ClipId) : id === 'reactor' ? ('energy' as ClipId) : id === 'command' ? ('start' as ClipId) : undefined,
      tip: id === 'school' || id === 'reactor' ? 'lesson.build.tip' : undefined,
      stats: buildingStats(id),
    })),
  },
  {
    id: 'people',
    icon: 'icon.resident',
    entries: [
      {
        id: 'unit.resident',
        name: 'unit.resident.name',
        desc: 'unit.resident.desc',
        how: ['res.residents.text', 'people.resident.how'],
        visual: { kind: 'anim', set: 'resident', anim: 'dig', scale: 3 },
        clip: 'order',
        stats: fighterStats(U.resident),
        related: ['parts.how', 'people.ranks', 'building.school'],
      },
      { id: 'people.ranks', name: 'people.ranks.name', desc: 'people.ranks.text', visual: { kind: 'anim', set: 'defender', anim: 'install_part', scale: 3 }, clip: 'parts' },
    ],
  },
  {
    id: 'parts',
    icon: 'icon.part',
    entries: [
      { id: 'parts.how', name: 'parts.how.name', desc: 'parts.how.text', how: ['parts.tech.text'], visual: { kind: 'anim', set: 'adaptant_thermo', anim: 'rip_part', scale: 3 }, clip: 'parts', tip: 'lesson.parts.tip', related: ['elem.cycle'] },
      { id: 'parts.heroes', name: 'parts.heroes.name', desc: 'parts.heroes.text', visual: { kind: 'anim', set: 'kiln', anim: 'rip_part', scale: 2.3 }, clip: 'heroes', related: ['hero.lairs'] },
      { id: 'parts.slots', name: 'parts.slots.name', desc: 'parts.slots.text', visual: { kind: 'anim', set: 'defender', anim: 'install_part', scale: 3 } },
      ...['thermo_arm', 'cryo_arm', 'volt_arm', 'toxin_arm', 'impact_arm', 'runner_leg', 'piston_leg'].map((id) => ({
        id: `part.${id}`,
        name: `part.${id}.label`,
        desc: `part.${id}.text`,
        visual: {
          kind: 'anim',
          set: { thermo_arm: 'adaptant_thermo', cryo_arm: 'adaptant_cryo', volt_arm: 'adaptant_volt', toxin_arm: 'adaptant_toxin' }[id] ?? 'heavy_adaptant',
          anim: 'idle',
          scale: id === 'impact_arm' || id === 'piston_leg' ? 2 : 3,
        } as Visual,
        stats: partStats(id),
      })),
    ],
  },
  {
    id: 'elements',
    icon: 'icon.attack',
    entries: [
      { id: 'elem.cycle', name: 'elem.cycle.name', desc: 'tech.cycle', visual: { kind: 'cycle' }, clip: 'elements', tip: 'lesson.elements.tip' },
      ...CYCLE.map((t) => ({ id: `elem.${t}`, name: `tech.${t}`, desc: `tech.${t}.desc`, visual: { kind: 'cycle', focus: t } as Visual, related: ['elem.cycle', `part.${t}_arm`] })),
      { id: 'elem.choose', name: 'elem.choose.name', desc: 'elem.choose.text', clip: 'elements', visual: { kind: 'anim', set: 'defender', anim: 'attack', scale: 3 } },
      { id: 'elem.mult', name: 'elem.mult.name', desc: 'elem.mult.text', visual: { kind: 'cycle' } },
      { id: 'elem.resist', name: 'elem.resist.name', desc: 'elem.resist.text', visual: { kind: 'anim', set: 'adaptant_thermo', anim: 'hit', scale: 3 } },
      {
        id: 'elem.reactions',
        name: 'elem.reactions.name',
        desc: 'elem.reactions.text',
        items: ['thermoshock', 'chain', 'shell_break', 'burnout', 'neuro'].map((r) => [`reaction.${r}`, `reaction.${r}.desc`] as [string, string]),
        visual: { kind: 'anim', set: 'fx', anim: 'hit_volt', scale: 3 },
      },
    ],
  },
  {
    id: 'heroes',
    icon: 'icon.lair',
    entries: [
      { id: 'hero.call', name: 'mode.call.name', desc: 'lesson.call.text', visual: { kind: 'glyph', channel: 'boss' }, clip: 'call', tip: 'lesson.call.tip', related: ['clue.boss', 'enemy.boss'] },
      { id: 'hero.lairs', name: 'hero.lairs.name', desc: 'hero.lairs.text', how: ['enemy.lair.how'], visual: { kind: 'anim', set: 'kiln', anim: 'idle', scale: 2.3 }, clip: 'heroes', related: ['clue.threat', 'parts.heroes'] },
      { id: 'hero.allies', name: 'hero.allies.name', desc: 'hero.allies.text', visual: { kind: 'anim', set: 'canopy', anim: 'idle', scale: 2.3 } },
      ...HEROES.map((x) => ({
        id: `hero.${x.id}`,
        name: `enemy.${x.id}.name`,
        desc: `enemy.${x.id}.desc`,
        how: [`ability.${x.id}`],
        items: [
          ['hero.as_ally', `ally.${x.id}.desc`],
          ['hero.unlock', `unlock.${x.id}`],
        ] as [string, string][],
        visual: { kind: 'anim', set: x.id, anim: 'idle', scale: HERO_SCALE[x.id] ?? 2.3 } as Visual,
        clip: x.id === 'kiln' ? ('heroes' as ClipId) : undefined,
        stats: heroStats(x),
        related: [`elem.${x.tech === 'kinetic' ? 'cycle' : x.tech}`, bossPool.has(x.id) ? 'hero.call' : 'hero.lairs'],
      })),
    ],
  },
  {
    id: 'enemies',
    icon: 'icon.danger',
    entries: [
      { id: 'enemy.adaptant', name: 'enemy.adaptant.name', desc: 'enemy.adaptant.desc', how: ['enemy.adaptant.how', 'enemy.adaptant.techs'], visual: { kind: 'anim', set: 'adaptant_cryo', anim: 'walk', scale: 3 }, clip: 'order', stats: fighterStats(E.adaptant), related: ['elem.cycle'] },
      { id: 'enemy.heavy', name: 'enemy.heavy_adaptant.name', desc: 'enemy.heavy_adaptant.desc', how: ['enemy.heavy.how'], visual: { kind: 'anim', set: 'heavy_adaptant', anim: 'attack', scale: 2 }, stats: fighterStats(E.heavy_adaptant) },
      { id: 'enemy.nest', name: 'site.nest.name', desc: 'site.nest.desc', how: ['enemy.nest.how'], visual: { kind: 'anim', set: 'nest', anim: 'pulse', scale: 3 }, clip: 'nest', stats: () => rows(S.nest, [['hp', 'stat.hp', plain], ['defense', 'stat.defense', plain], ['reward', 'stat.reward', en]]) },
      { id: 'enemy.heavy_nest', name: 'site.heavy_nest.name', desc: 'site.heavy_nest.desc', visual: { kind: 'anim', set: 'heavy_nest', anim: 'pulse', scale: 3 }, stats: () => rows(S.heavy_nest, [['hp', 'stat.hp', plain], ['reward', 'stat.reward', en]]) },
      { id: 'enemy.lair', name: 'site.hero_lair.name', desc: 'hero.lairs.text', how: ['enemy.lair.how'], visual: { kind: 'anim', set: 'heavy_nest', anim: 'pulse', scale: 3 }, clip: 'heroes', related: ['hero.lairs', 'parts.heroes'] },
      { id: 'enemy.boss', name: 'site.boss_hatch.name', desc: 'site.boss_hatch.desc', how: ['enemy.boss.how'], visual: { kind: 'anim', set: 'demon_hatch', anim: 'steam', scale: 3 }, clip: 'call', related: ['hero.call', 'clue.boss'] },
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
      { id: 'map.cache', name: 'site.cache.name', desc: 'site.cache.desc', how: ['map.cache.how'], visual: { kind: 'image', key: 'tile.cache', scale: 3 }, clip: 'energy', stats: () => rows(cfg.economy, [['cacheEnergy', 'stat.reward', en]]) },
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
      { id: 'world.heroes', name: 'world.heroes.name', desc: 'world.heroes.text', visual: { kind: 'anim', set: 'seraph', anim: 'tic', scale: 2.3 }, related: ['hero.lairs', 'hero.allies'] },
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
  build: { name: 'coach.build.name', title: 'lesson.build.title', text: 'lesson.build.text', clip: 'build', entry: 'building.reactor' },
  fight: { name: 'coach.fight.name', title: 'lesson.fight.title', text: 'lesson.fight.text', clip: 'nest', entry: 'unit.resident' },
  parts: { name: 'coach.parts.name', title: 'lesson.parts.title', text: 'lesson.parts.text', clip: 'parts', entry: 'parts.how' },
  elements: { name: 'coach.elements.name', title: 'coach.elements.title', text: 'coach.elements.text', clip: 'elements', entry: 'elem.cycle' },
  threat: { name: 'coach.threat.name', title: 'coach.threat.title', text: 'coach.threat.text', clip: 'threat', entry: 'res.threat' },
  hero: { name: 'coach.hero.name', title: 'coach.hero.title', text: 'coach.hero.text', clip: 'heroes', entry: 'hero.lairs' },
  call: { name: 'coach.call.name', title: 'coach.call.title', text: 'coach.call.text', clip: 'call', entry: 'hero.call' },
};

/**
 * Game events (core/world GameEvent.type) that open a coach card the first time.
 * Old names stay so a build on either side of the v0.4 rules keeps working.
 */
export const EVENT_TOPIC: Record<string, string> = {
  nest_open: 'fight',
  heavy_nest_open: 'fight',
  enemy_engaged: 'fight',
  part_attached: 'parts',
  elements_part: 'elements',
  reaction: 'elements',
  threat_level_up: 'threat',
  hero_lair_open: 'hero',
  hero_spawn: 'hero',
  boss_warning: 'call',
  boss_awake: 'call',
  demon_warning: 'call',
  demon_awake: 'call',
};
