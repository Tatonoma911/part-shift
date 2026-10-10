import Phaser from 'phaser';
import { BUILDABLE, buildings as buildingDefs } from '../core/data';
import type { World } from '../core/world';
import { hasText, t } from '../i18n';
import { drawPaper, fragmentBar } from './Blueprint';
import { C, INK, LANDSCAPE } from './layout';
import configJson from '../data/design/config.json';
import elementsJson from '../data/design/elements.json';
import heroesJson from '../data/design/heroes.json';
import { buildingUnlocked, fragmentNeed, fragments, HEROES, type MetaSave } from './meta/store';
import { drawTechOrb } from './Vitals';
import { chip, plate, TXT } from './ui';

/**
 * Building the city the way mobile strategies do it (Clash of Clans, Kingdom Rush,
 * Bad North; Антон 10.10: «понятно, приятно и знакомо по играм жанра»):
 *   1. a big «Строить» button in the dock;
 *   2. it slides up a catalog: tabs by group and a swipeable row of cards
 *      (picture, price in Energy, land it frees, and why it is closed: blueprint 2/4,
 *      «нужна Школа», «построено 2/2», not enough Energy);
 *   3. picking a card puts a ghost of the building on the board: green where it can stand,
 *      red with the reason where it can't; tap or drag on the board moves it; ✓ / ✕ above it;
 *      the land where it may stand pulses.
 * A tap on free liberated land is a shortcut (MVP_RULES §7.1): the catalog opens for that block.
 * UI layer: vector BRAND_UI plates; the buildings are the board's own pixel sprites.
 */

export type BuildGroup = 'base' | 'support' | 'boost' | 'stations';
export type BuildState = 'ok' | 'energy' | 'blueprint' | 'requires' | 'max' | 'soon';

export interface BuildOption {
  /** Building type («station» for hero stations). */
  id: string;
  /** Card key: the type, or «station:<hero>» for a hero station. */
  key: string;
  /** Hero station: the only hero it gives birth to. */
  hero?: string;
  /** Elements of the heroes this building gives birth to (Антон 10.10: see on the card what it prepares you for). */
  techs: string[];
  group: BuildGroup;
  cost: number;
  land: number;
  state: BuildState;
  /** Short reason line on the card («Нужна Школа», «Построено 2/2», «Не хватает 30»). */
  note: string;
  /** Hero station (MVP_RULES §3.4): the cell element its hero digs fast, the element it beats, and whether such a zone is open near the base. */
  digs?: string;
  strong?: string;
  useful?: boolean;
  /** Blueprint fragments, for locked cards. */
  have?: number;
  need?: number;
}

/** Catalog groups (design/BUILDINGS.md): basics, support/defence/scouting, late-game boosts, hero stations. */
export const GROUP_OF: Record<string, BuildGroup> = {
  home: 'base',
  reactor: 'base',
  cooler: 'base',
  school: 'base',
  medcenter: 'base',
  outpost: 'base',
  civ_shelter: 'support',
  repair: 'support',
  jammer: 'support',
  watchtower: 'support',
  relay: 'support',
  backup_lab: 'boost',
  forge: 'boost',
  rotation_center: 'boost',
  station: 'stations',
};
/** Stations right after the basics: picking elements for the district is the main decision (Антон 10.10). */
const GROUPS: BuildGroup[] = ['base', 'stations', 'support', 'boost'];

/** Fields of design/data/buildings.json that the core may not type yet. */
type DefExtra = { maxCount?: number | null; requires?: { schools?: number; nestsDestroyed?: number } | null };

/** Hero stations (heroes.json ourSide.birth.stations): one per squad hero, price and requirements by tier. */
type StationRules = { costByTier: Record<string, number>; territoryRadius?: number; maxPerHero?: number; requires?: Record<string, { schools?: number }> };
const STATIONS = (heroesJson as unknown as { ourSide?: { birth?: { stations?: StationRules } } }).ourSide?.birth?.stations;

/** Up to which hero tier a birth building releases (MVP_RULES §4): home ≤2, school ≤3 (≤4 with 3 schools). */
const BIRTH_TIER: Record<string, (schools: number) => number> = { home: () => 2, school: (n) => (n >= 3 ? 4 : 3) };

export const techOf = (id: string) => HEROES.find((h) => h.id === id)?.tech ?? 'kinetic';
const tierOf = (id: string) => HEROES.find((h) => h.id === id)?.tier ?? 1;
/** Cell element → the element that digs it fast (config.json dig.cellDurability.cellWeakTo, Антон 10:45). */
const CELL_WEAK_TO: Record<string, string> = (configJson as unknown as { dig?: { cellDurability?: { cellWeakTo?: Record<string, string> } } }).dig?.cellDurability?.cellWeakTo ?? {
  cryo: 'thermo',
  thermo: 'cryo',
  volt: 'impact',
  toxin: 'volt',
  impact: 'toxin',
};
const BEATS = (elementsJson as unknown as { beats: Record<string, string> }).beats;
/** The zone a hero of `tech` digs fast (fire melts ice), or undefined for heroes without an element. */
export const digsZone = (tech: string) => Object.keys(CELL_WEAK_TO).find((cell) => CELL_WEAK_TO[cell] === tech);
/** Which element a hero of `tech` is strong against in a fight (elements.json beats). */
export const beatsTech = (tech: string) => BEATS[tech];
/** Element of a closed cell (core field `element`, MVP_RULES §3.4). */
export const cellElement = (c: unknown) => (c as { element?: string }).element;

/**
 * Cell elements of closed zones that touch what is already open within 8 cells of our Command Center:
 * the «Пригодится: лёд рядом» badge on a station card.
 */
export function zonesNearBase(world: World, me: number): Set<string> {
  const out = new Set<string>();
  const s = world.s as unknown as { width?: number; height?: number; cells: { revealed: boolean }[]; buildings: { owner: number; type: string; x: number; y: number }[] };
  const W = s.width ?? 0;
  const H = s.height ?? Math.floor(s.cells.length / Math.max(1, W));
  const hq = s.buildings.find((b) => b.owner === me && b.type === 'command');
  if (!hq || !W) return out;
  for (let y = Math.max(0, hq.y - 8); y <= Math.min(H - 1, hq.y + 8); y++)
    for (let x = Math.max(0, hq.x - 8); x <= Math.min(W - 1, hq.x + 8); x++) {
      const c = s.cells[y * W + x];
      const el = c && !c.revealed ? cellElement(c) : undefined;
      if (!el || out.has(el)) continue;
      const open = [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => s.cells[(y + dy) * W + x + dx]?.revealed && x + dx >= 0 && x + dx < W));
      if (open) out.add(el);
    }
  return out;
}

/** Price of a hero's station by the hero's tier (40 / 80 / 140 / 220). */
export const stationPrice = (hero: string) => STATIONS?.costByTier[String(tierOf(hero))] ?? 0;

/**
 * The catalog for this player right now, in display order. `squad` = heroes picked on «Сводка смены»:
 * birth buildings show their elements, and each gets its own station card.
 */
export function buildOptions(world: World, meta: MetaSave, me: number, squad: string[] = []): BuildOption[] {
  const p = world.player(me);
  const own = world.s.buildings.filter((b) => b.owner === me);
  const schools = own.filter((b) => b.type === 'school' && b.complete).length;
  const out: BuildOption[] = [];
  const uniq = (a: string[]) => [...new Set(a)];
  for (const id of BUILDABLE) {
    if (id === 'station') continue;
    const def = buildingDefs[id] as (typeof buildingDefs)[string] & DefExtra;
    const cost = typeof def.cost === 'number' ? def.cost : 0;
    const maxTier = BIRTH_TIER[id]?.(schools);
    const techs = maxTier ? uniq(squad.filter((h) => tierOf(h) <= maxTier).map(techOf)) : [];
    const o: BuildOption = { id, key: id, techs, group: GROUP_OF[id] ?? 'base', cost, land: def.territoryRadius ?? 0, state: 'ok', note: '' };
    const count = own.filter((b) => b.type === id).length;
    const req = def.requires ?? {};
    if (!buildingUnlocked(meta, id)) {
      o.state = 'blueprint';
      o.have = fragments(meta, 'building', id);
      o.need = fragmentNeed('building', id);
      o.note = t('build.state.blueprint', { have: o.have, need: o.need });
    } else if ((req.schools ?? 0) > schools) {
      o.state = 'requires';
      o.note = t(req.schools === 1 ? 'build.state.requires.school' : 'build.state.requires.schools', { count: req.schools ?? 0 });
    } else if ((req.nestsDestroyed ?? 0) > p.stats.nests) {
      o.state = 'requires';
      o.note = t('build.state.requires.nest');
    } else if (def.maxCount && count >= def.maxCount) {
      o.state = 'max';
      o.note = t('build.state.max', { count, max: def.maxCount });
    } else if (p.energy < cost) {
      o.state = 'energy';
      o.note = t('build.state.energy', { count: Math.ceil(cost - p.energy) });
    }
    out.push(o);
  }
  // A station per squad hero: «Станция Течения» gives birth only to Течение.
  if (STATIONS) {
    const coreReady = BUILDABLE.includes('station');
    const near = zonesNearBase(world, me);
    for (const hero of squad) {
      const tier = tierOf(hero);
      const cost = STATIONS.costByTier[String(tier)] ?? 0;
      const tech = techOf(hero);
      const zone = digsZone(tech);
      const o: BuildOption = { id: 'station', key: `station:${hero}`, hero, techs: [tech], group: 'stations', cost, land: STATIONS.territoryRadius ?? 1, state: 'ok', note: '', digs: zone, strong: beatsTech(tech), useful: !!zone && near.has(zone) };
      const need = STATIONS.requires?.[String(tier)]?.schools ?? 0;
      const count = own.filter((b) => b.type === 'station' && (b as { hero?: string }).hero === hero).length;
      if (!coreReady) {
        o.state = 'soon';
        o.note = t('build.state.soon');
      } else if (need > schools) {
        o.state = 'requires';
        o.note = t(need === 1 ? 'build.state.requires.school' : 'build.state.requires.schools', { count: need });
      } else if (STATIONS.maxPerHero && count >= STATIONS.maxPerHero) {
        o.state = 'max';
        o.note = t('build.state.max', { count, max: STATIONS.maxPerHero });
      } else if (p.energy < cost) {
        o.state = 'energy';
        o.note = t('build.state.energy', { count: Math.ceil(cost - p.energy) });
      }
      out.push(o);
    }
  }
  // Stable order: by group, then the order of buildings.json.
  return out.sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group));
}

/** What a tap on a closed card says. */
export function heroName(id: string): string {
  return hasText(`ally.${id}.name`) ? t(`ally.${id}.name`) : t(`enemy.${id}.name`);
}

export function optionName(o: BuildOption): string {
  return o.hero ? t('building.station.name', { hero: heroName(o.hero) }) : t(`building.${o.id}.name`);
}

export function refusal(o: BuildOption): string {
  const name = optionName(o);
  if (o.state === 'blueprint') return t('blueprint.locked', { name, have: o.have ?? 0, need: o.need ?? 0 });
  if (o.state === 'energy') return t('build.toast.energy', { name, count: o.note.replace(/\D+/g, '') });
  return `${name}: ${o.note}`;
}

/** Texture of a building; hero stations come painted in their hero's element (art pack 03 hero_station_normal_<tech>). */
export function buildingKey(scene: Phaser.Scene, id: string, hero?: string): string {
  if (hero) {
    const k = `building.station_${techOf(hero)}`;
    if (scene.textures.exists(k)) return k;
  }
  return `building.${id}`;
}

/** Fits a building sprite into a w×h box, standing on its bottom edge. */
export function buildingPic(scene: Phaser.Scene, id: string, cx: number, bottom: number, w: number, h: number, hero?: string): Phaser.GameObjects.Image | null {
  const key = buildingKey(scene, id, hero);
  if (!scene.textures.exists(key)) return null;
  const img = scene.add.image(cx, bottom, key).setOrigin(0.5, 1);
  // The sprite fills the box; NEAREST filtering (createArt) keeps the pixels sharp.
  img.setScale(Math.min(w / img.width, h / img.height));
  return img;
}

// ------------------------------------------------------------------ button

/** The big «Строить» button of the dock. `pulse` makes it blink amber (tutorial asks for a building). */
export function buildButton(scene: Phaser.Scene, x: number, y: number, w: number, h: number, depth: number, onTap: () => void) {
  const c = scene.add.container(x, y).setDepth(depth);
  const g = scene.add.graphics();
  c.add(g);
  const icon = scene.textures.exists('icon.build') ? scene.add.image(w / 2, h * 0.36, 'icon.build') : null;
  if (icon) {
    icon.setScale((h * 0.38) / icon.height);
    c.add(icon);
  }
  const label = scene.add.text(w / 2, icon ? h * 0.76 : h / 2, t('build.button').toUpperCase(), TXT.num(h > 120 ? 26 : 22, INK.white)).setOrigin(0.5);
  if (label.width > w - 24) label.setScale((w - 24) / label.width);
  c.add(label);
  // Badge: how many buildings can be placed right now.
  const badge = scene.add.container(w - 8, 8);
  const bg = scene.add.graphics();
  bg.fillStyle(C.coral, 1);
  bg.fillCircle(0, 0, 20);
  bg.lineStyle(3, C.white, 1);
  bg.strokeCircle(0, 0, 20);
  const bt = scene.add.text(0, 0, '', TXT.num(19, INK.white)).setOrigin(0.5);
  badge.add([bg, bt]);
  c.add(badge);
  const hit = scene.add.zone(0, 0, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
  hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
    ev.stopPropagation();
    scene.tweens.add({ targets: c, scale: { from: 0.96, to: 1 }, duration: 120 });
    onTap();
  });
  c.add(hit);
  const draw = (pulse: number, active: boolean) => {
    g.clear();
    g.fillStyle(C.night, 0.18);
    g.fillPoints(cutPts(4, 6, w, h, 18), true);
    chip(g, 0, 0, w, h, active ? C.deep : C.teal, 1, 18, { color: pulse > 0 ? C.amber : C.seam, width: pulse > 0 ? 4 + 3 * pulse : 3 });
  };
  draw(0, false);
  return {
    container: c,
    update(now: number, ready: number, wanted: boolean, active: boolean) {
      draw(wanted ? 0.5 + 0.5 * Math.sin(now / 180) : 0, active);
      badge.setVisible(ready > 0 && !active);
      bt.setText(String(Math.min(9, ready)));
    },
  };
}

function cutPts(x: number, y: number, w: number, h: number, cut: number): Phaser.Math.Vector2[] {
  const V = Phaser.Math.Vector2;
  return [new V(x + cut, y), new V(x + w, y), new V(x + w, y + h - cut), new V(x + w - cut, y + h), new V(x, y + h), new V(x, y + cut)];
}

// ----------------------------------------------------------------- catalog

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The catalog sheet: header (title, Energy, ✕), group tabs, a swipeable row of cards.
 * Mouse wheel scrolls the row on PC. Cards redraw live while it is open (Energy grows).
 */
export class BuildDrawer {
  private root: Phaser.GameObjects.Container | null = null;
  private strip: Phaser.GameObjects.Container | null = null;
  private cards: { o: BuildOption; c: Phaser.GameObjects.Container; x: number }[] = [];
  private tabs: { group: BuildGroup; g: Phaser.GameObjects.Graphics; t: Phaser.GameObjects.Text; x: number; w: number }[] = [];
  private energyText: Phaser.GameObjects.Text | null = null;
  private scroll = 0;
  private maxScroll = 0;
  private sig = '';
  private highlight: string[] = [];
  private selected: string | null = null;
  readonly cardW: number;
  readonly cardH: number;

  constructor(
    private scene: Phaser.Scene,
    private box: Box,
    private depth: number,
    private on: { pick: (o: BuildOption) => void; close: () => void },
  ) {
    this.cardW = LANDSCAPE ? 190 : 200;
    this.cardH = box.h - 196;
  }

  get isOpen(): boolean {
    return this.root !== null;
  }

  open(options: BuildOption[], energy: number, highlight: string[] = [], selected: string | null = null): void {
    this.close(true);
    this.highlight = highlight;
    this.selected = selected;
    const { x, y, w, h } = this.box;
    const s = this.scene;
    const root = s.add.container(0, 0).setDepth(this.depth);
    this.root = root;
    // Eats taps so they don't reach the board under the sheet.
    const eat = s.add.zone(x, y, w, h).setOrigin(0).setInteractive();
    eat.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => ev.stopPropagation());
    root.add(eat);
    const g = s.add.graphics();
    plate(g, x, y, w, h, 28);
    root.add(g);
    // Header.
    const pad = 26;
    root.add(s.add.text(x + pad + 6, y + 44, t('build.drawer.title').toUpperCase(), TXT.num(28, INK.graphite)).setOrigin(0, 0.5));
    const eg = s.add.graphics();
    chip(eg, x + w - pad - 84 - 190, y + 18, 180, 52, 0xd9f3f8, 1, 12);
    root.add(eg);
    if (s.textures.exists('icon.energy')) root.add(s.add.image(x + w - pad - 84 - 190 + 32, y + 44, 'icon.energy').setScale(1.2));
    this.energyText = s.add.text(x + w - pad - 84 - 190 + 58, y + 44, '', TXT.num(24, INK.cobalt)).setOrigin(0, 0.5);
    root.add(this.energyText);
    const cg = s.add.graphics();
    chip(cg, x + w - pad - 72, y + 14, 72, 60, C.graphite, 1, 12);
    const ct = s.add.text(x + w - pad - 36, y + 44, '✕', TXT.num(28, INK.white)).setOrigin(0.5);
    const chit = s.add.zone(x + w - pad - 80, y + 6, 88, 76).setOrigin(0).setInteractive({ useHandCursor: true });
    chit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      this.on.close();
    });
    root.add([cg, ct, chit]);
    // Tabs: one per group present; a tap scrolls the row to that group.
    const groups = GROUPS.filter((gr) => options.some((o) => o.group === gr));
    let tx = x + pad;
    this.tabs = [];
    for (const gr of groups) {
      const label = s.add.text(0, y + 112, t(`build.group.${gr}`), TXT.body(LANDSCAPE ? 19 : 21, INK.graphite, '700')).setOrigin(0.5);
      const tw = label.width + 36;
      label.setX(tx + tw / 2);
      const tg = s.add.graphics();
      const hit = s.add.zone(tx, y + 88, tw, 48).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        const first = this.cards.find((c) => c.o.group === gr);
        if (first) this.scrollTo(first.x - 4, true);
      });
      root.add([tg, label, hit]);
      this.tabs.push({ group: gr, g: tg, t: label, x: tx, w: tw });
      tx += tw + 10;
    }
    // Card row.
    const sy = y + 152;
    const sx = x + pad;
    const sw = w - pad * 2;
    const strip = s.add.container(sx, sy);
    this.strip = strip;
    root.add(strip);
    const mask = s.make.graphics({}, false);
    mask.fillRect(sx - 2, sy - 6, sw + 4, this.cardH + 14);
    strip.setMask(mask.createGeometryMask());
    this.cards = [];
    let cx = 0;
    let last: BuildGroup | null = null;
    for (const o of options) {
      if (last && o.group !== last) cx += 22;
      last = o.group;
      const c = s.add.container(cx, 0);
      strip.add(c);
      this.cards.push({ o, c, x: cx });
      cx += this.cardW + 14;
    }
    this.maxScroll = Math.max(0, cx - 14 - sw);
    this.drawCards(options);
    // Swipe and tap on the row: a drag scrolls, a tap without a drag picks the card under the finger.
    const zone = s.add.zone(sx, sy, sw, this.cardH).setOrigin(0).setInteractive({ useHandCursor: true });
    let downX = 0;
    let startScroll = 0;
    let dragged = false;
    zone.on('pointerdown', (p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      downX = p.x;
      startScroll = this.scroll;
      dragged = false;
    });
    zone.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      if (Math.abs(p.x - downX) > 12) dragged = true;
      if (dragged) this.scrollTo(startScroll - (p.x - downX));
    });
    zone.on('pointerup', (p: Phaser.Input.Pointer, lx: number) => {
      if (dragged) return;
      const at = lx + this.scroll;
      const hit = this.cards.find((c) => at >= c.x && at <= c.x + this.cardW);
      if (hit) this.on.pick(hit.o);
      void p;
    });
    zone.on('wheel', (_p: Phaser.Input.Pointer, dx: number, dy: number, _dz: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      this.scrollTo(this.scroll + (Math.abs(dx) > Math.abs(dy) ? dx : dy));
    });
    root.add(zone);
    // Hint under the row.
    root.add(s.add.text(x + w / 2, y + h - 22, t('build.drawer.hint'), TXT.body(LANDSCAPE ? 17 : 19, INK.dim, '500')).setOrigin(0.5));
    // Open on the highlighted card (tutorial) or the selected one.
    const focus = this.cards.find((c) => highlight.includes(c.o.id)) ?? this.cards.find((c) => c.o.key === selected);
    if (focus) this.scrollTo(focus.x - (sw - this.cardW) / 2);
    this.setEnergy(energy);
    root.setY(40).setAlpha(0);
    s.tweens.add({ targets: root, y: 0, alpha: 1, duration: 180, ease: 'Cubic.easeOut' });
  }

  /** Live refresh while open: states change as Energy comes in. */
  refresh(options: BuildOption[], energy: number, highlight: string[] = this.highlight): void {
    if (!this.root) return;
    this.highlight = highlight;
    this.setEnergy(energy);
    this.drawCards(options);
  }

  close(instant = false): void {
    const r = this.root;
    if (!r) return;
    this.root = null;
    this.strip = null;
    this.cards = [];
    this.sig = '';
    if (instant) {
      r.destroy();
      return;
    }
    this.scene.tweens.add({ targets: r, y: 40, alpha: 0, duration: 140, onComplete: () => r.destroy() });
  }

  private setEnergy(e: number): void {
    this.energyText?.setText(String(Math.floor(e)));
  }

  private scrollTo(v: number, ease = false): void {
    const to = Phaser.Math.Clamp(v, 0, this.maxScroll);
    this.scroll = to;
    if (!this.strip) return;
    const sx = this.box.x + 26;
    if (ease) this.scene.tweens.add({ targets: this.strip, x: sx - to, duration: 220, ease: 'Cubic.easeOut' });
    else this.strip.x = sx - to;
    this.drawTabs();
  }

  private drawTabs(): void {
    // The active tab: the last group that starts in the left half of the visible row.
    const at = this.scroll + (this.box.w - 52) / 2;
    const starts = this.cards.filter((c, k) => k === 0 || this.cards[k - 1].o.group !== c.o.group);
    const cur = [...starts].reverse().find((c) => c.x <= at)?.o.group ?? this.cards[0]?.o.group;
    for (const tb of this.tabs) {
      const on = tb.group === cur;
      tb.g.clear();
      chip(tb.g, tb.x, this.box.y + 88, tb.w, 48, on ? C.graphite : 0xe6eef0, 1, 10);
      tb.t.setColor(on ? INK.white : INK.graphite);
    }
  }

  private drawCards(options: BuildOption[]): void {
    const sig = options.map((o) => `${o.key}:${o.state}:${o.note}`).join('|') + this.highlight.join(',') + this.selected;
    if (sig === this.sig) return;
    this.sig = sig;
    for (const card of this.cards) {
      const o = options.find((x) => x.key === card.o.key) ?? card.o;
      card.o = o;
      card.c.removeAll(true);
      drawCard(this.scene, card.c, o, this.cardW, this.cardH, this.highlight.includes(o.id), o.key === this.selected);
    }
    this.drawTabs();
  }
}

/** One catalog card, drawn into `c` at (0, 0). */
function drawCard(s: Phaser.Scene, c: Phaser.GameObjects.Container, o: BuildOption, w: number, h: number, hl: boolean, sel: boolean): void {
  const g = s.add.graphics();
  c.add(g);
  const locked = o.state === 'blueprint';
  const dim = o.state === 'requires' || o.state === 'max' || o.state === 'soon';
  const picH = Math.round(h * 0.5);
  if (locked) drawPaper(g, 0, 0, w, h);
  else {
    chip(g, 0, 0, w, h, sel ? 0xd9f3f8 : C.white, 1, 14, { color: hl ? C.amber : sel ? C.seam : 0xc6d4d9, width: hl ? 5 : sel ? 4 : 2 });
    // Picture well: pale sky behind the sprite.
    g.fillStyle(dim ? 0xe3e8ea : 0xeaf5f8, 1);
    g.fillRect(8, 8, w - 16, picH - 8);
  }
  const pic = buildingPic(s, o.id, w / 2, picH - 4, w - 40, picH - 20, o.hero);
  if (pic) {
    if (locked) pic.setTintFill(0xffffff).setAlpha(0.85);
    else if (dim) pic.setTint(0x8a969c).setAlpha(0.75);
    c.add(pic);
  }
  // Hero station: the hero's round comic portrait in the picture corner.
  if (o.hero && s.textures.exists(`comm.${o.hero}`)) {
    const r = 30;
    const pg = s.add.graphics();
    pg.fillStyle(C.white, 1);
    pg.fillCircle(w - 14 - r, picH - 8 - r, r + 3);
    c.add(pg);
    const face = s.add.image(w - 14 - r, picH - 8 - r, `comm.${o.hero}`);
    face.setScale((r * 2) / face.width);
    c.add(face);
    const ring = s.add.graphics();
    ring.lineStyle(3, C.graphite, 1);
    ring.strokeCircle(w - 14 - r, picH - 8 - r, r);
    c.add(ring);
  }
  // Elements of the heroes it gives birth to: the same orbs as the enemies' weaknesses (Антон 10.10).
  if (o.techs.length && !locked) {
    const og = s.add.graphics();
    o.techs.slice(0, 5).forEach((tech, k) => drawTechOrb(og, tech, 30 + k * 36, 30, 15));
    c.add(og);
  }
  // Land it frees: a small corner tag.
  // Hidden under the «why not» strip.
  if (o.land > 0 && !locked && o.state === 'ok') {
    // Bottom-left of the picture: the top row belongs to the element orbs.
    const lt = s.add.text(14, picH - 8, t('build.card.land', { count: o.land }), { ...TXT.body(16, INK.teal, '700'), backgroundColor: '#FFFFFFCC', padding: { x: 6, y: 2 } }).setOrigin(0, 1);
    c.add(lt);
  }
  // A station card names only the hero (the picture says «station»), on one line: the two element lines need the room.
  const station = !!o.hero && !locked;
  const name = s.add.text(14, picH + 10, station ? heroName(o.hero!) : optionName(o), { ...TXT.body(LANDSCAPE ? 18 : 20, locked ? INK.white : INK.graphite, '700'), wordWrap: { width: station ? 9999 : w - 28 }, lineSpacing: 0 });
  if (station && name.width > w - 28) name.setScale((w - 28) / name.width);
  if (name.height > 54) name.setScale(54 / name.height);
  c.add(name);
  if (station) {
    // «Быстро копает: лёд» / «Силён против: Токсин», each with its element dot (MVP_RULES §3.4).
    const rows: [string, string | undefined][] = [
      [o.digs ? t('build.station.digs', { zone: t(`zone.short.${o.digs}`) }) : t('build.station.digs_none'), o.digs],
      [o.strong ? t('build.station.strong', { tech: t(`tech.${o.strong}`) }) : '', o.strong],
    ];
    const dg = s.add.graphics();
    c.add(dg);
    let ry = picH + 10 + name.displayHeight + 4;
    for (const [text, tech] of rows) {
      if (!text) continue;
      if (tech) drawTechOrb(dg, tech, 21, ry + 10, 7);
      const tl = s.add.text(tech ? 34 : 14, ry, text, TXT.body(15, INK.graphite, '600'));
      if (tl.width > w - (tech ? 44 : 24)) tl.setScale((w - (tech ? 44 : 24)) / tl.width);
      c.add(tl);
      ry += 22;
    }
    // «Пригодится: лёд рядом»: an amber badge on the picture when such a zone is open near the base.
    if (o.useful && o.digs) {
      const bt = s.add.text(w - 12, 14, t('build.station.useful', { zone: t(`zone.short.${o.digs}`) }), { ...TXT.body(14, INK.graphite, '800'), backgroundColor: '#FFC94D', padding: { x: 6, y: 3 } }).setOrigin(1, 0);
      if (bt.width > w - 60) bt.setScale((w - 60) / bt.width);
      c.add(bt);
    }
  }
  const fy = h - 34;
  if (locked) {
    const fg = s.add.graphics();
    fragmentBar(fg, 14, fy - 30, w - 28, 12, o.have ?? 0, o.need ?? 1);
    c.add(fg);
    c.add(s.add.text(w / 2, fy + 2, t('build.state.blueprint', { have: o.have ?? 0, need: o.need ?? 0 }), TXT.body(18, '#DCEBFF', '700')).setOrigin(0.5));
    return;
  }
  // Price: ⚡ 40, red when short.
  const short = o.state === 'energy';
  const cost = s.add.text(w / 2 + 14, fy, String(o.cost), TXT.num(24, short ? INK.coral : INK.cobalt)).setOrigin(0.5);
  c.add(cost);
  if (s.textures.exists('icon.energy')) c.add(s.add.image(cost.x - cost.width / 2 - 16, fy, 'icon.energy').setScale(1.1));
  if (o.state !== 'ok') {
    // Why it can't be built now: a strip over the picture.
    const ng = s.add.graphics();
    const col = short ? C.coral : C.graphite;
    ng.fillStyle(col, 0.92);
    ng.fillRect(8, picH - 40, w - 16, 34);
    c.add(ng);
    const nt = s.add.text(w / 2, picH - 23, o.note, TXT.body(16, INK.white, '700')).setOrigin(0.5);
    if (nt.width > w - 24) nt.setScale((w - 24) / nt.width);
    c.add(nt);
  }
}

// ------------------------------------------------------------- placing bar

/** Dock content while a ghost is on the board: the building, its price, what it does, and ✕. */
export function placeBar(scene: Phaser.Scene, box: Box, id: string, cost: number, valid: boolean, reason: string, depth: number, onCancel: () => void, hero?: string): Phaser.GameObjects.Container {
  const { x, y, w, h } = box;
  const c = scene.add.container(0, 0).setDepth(depth);
  const pad = 26;
  const g = scene.add.graphics();
  // Its own plate over the dock, so nothing of the dig pane shows through.
  plate(g, x, y, w, h, 28);
  // Eats taps on the bar so they don't reach the board.
  const eat = scene.add.zone(x, y, w, h).setOrigin(0).setInteractive();
  eat.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => ev.stopPropagation());
  c.add(eat);
  g.fillStyle(0xeaf5f8, 1);
  g.fillRect(x + pad, y + pad, 132, h - pad * 2);
  c.add(g);
  const pic = buildingPic(scene, id, x + pad + 66, y + h - pad - 20, 116, Math.min(170, h - pad * 2 - 30), hero);
  if (pic) c.add(pic);
  const tx = x + pad + 152;
  const tw = w - (tx - x) - pad - 150;
  const title = hero ? optionName({ id, key: `station:${hero}`, hero, techs: [], group: 'stations', cost, land: 0, state: 'ok', note: '' }) : t(`building.${id}.name`);
  c.add(scene.add.text(tx, y + pad + 4, title, { ...TXT.body(LANDSCAPE ? 23 : 26, INK.graphite, '800'), wordWrap: { width: tw } }));
  const costT = scene.add.text(tx + 34, y + pad + 58, String(cost), TXT.num(22, INK.cobalt)).setOrigin(0, 0.5);
  if (scene.textures.exists('icon.energy')) c.add(scene.add.image(tx + 14, y + pad + 58, 'icon.energy').setScale(1.1));
  c.add(costT);
  // Where to put it, or why it can't stand here.
  const hint = scene.add.text(tx, y + pad + 84, valid ? t('build.place.hint') : reason, { ...TXT.body(LANDSCAPE ? 18 : 20, valid ? INK.dim : INK.coral, valid ? '500' : '700'), wordWrap: { width: tw } });
  c.add(hint);
  let desc = hasText(`building.${id}.desc`) ? t(`building.${id}.desc`, hero ? { hero: heroName(hero) } : {}) : '';
  if (hero) {
    // Station: what its hero digs fast and whom it beats, in full words (MVP_RULES §3.4).
    const tech = techOf(hero);
    const zone = digsZone(tech);
    const strong = beatsTech(tech);
    desc = [zone ? t('build.station.digs', { zone: t(`zone.${zone}`) }) : t('build.station.digs_none'), strong ? t('build.station.strong', { tech: t(`tech.${strong}`) }) : ''].filter(Boolean).join('. ') + '.';
  }
  if (desc && !LANDSCAPE) {
    const d = scene.add.text(tx, hint.y + hint.height + 8, desc, { ...TXT.body(17, INK.dim, '500'), wordWrap: { width: tw } });
    if (d.y + d.height > y + h - 16) d.setVisible(false);
    c.add(d);
  }
  // ✕ on the right: big, the same place as the drawer's close.
  const bw = 130;
  const bh = 96;
  const bx = x + w - pad - bw;
  const by = y + (h - bh) / 2;
  const bg = scene.add.graphics();
  chip(bg, bx, by, bw, bh, C.graphite, 1, 14);
  c.add(bg);
  c.add(scene.add.text(bx + bw / 2, by + 34, '✕', TXT.num(30, INK.white)).setOrigin(0.5));
  c.add(scene.add.text(bx + bw / 2, by + 72, t('dock.cancel'), TXT.body(18, INK.white, '700')).setOrigin(0.5));
  const hit = scene.add.zone(bx, by, bw, bh).setOrigin(0).setInteractive({ useHandCursor: true });
  hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
    ev.stopPropagation();
    onCancel();
  });
  c.add(hit);
  return c;
}

/** ✓ / ✕ over the ghost. ✓ is grey when the block doesn't fit (a tap then says why). */
export function ghostActions(scene: Phaser.Scene, x: number, y: number, valid: boolean, depth: number, ok: () => void, cancel: () => void): Phaser.GameObjects.Container {
  const mk = (dx: number, kind: 'ok' | 'cancel', act: () => void) => {
    const g = scene.add.graphics();
    const fill = kind === 'ok' ? (valid ? C.green : 0x9aa7ad) : C.white;
    chip(g, dx - 42, -42, 84, 84, fill, 1, 14, { color: kind === 'ok' ? C.graphite : C.coral, width: 3 });
    const tx = scene.add.text(dx, 0, kind === 'ok' ? '✓' : '✕', TXT.num(36, kind === 'ok' ? INK.white : INK.coral)).setOrigin(0.5);
    const hit = scene.add.zone(dx - 42, -42, 84, 84).setOrigin(0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      act();
    });
    return [g, tx, hit];
  };
  return scene.add.container(x, y, [...mk(-50, 'ok', ok), ...mk(50, 'cancel', cancel)]).setDepth(depth);
}
