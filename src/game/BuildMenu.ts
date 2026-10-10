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
 *   2. it slides up a catalog: one vertical grid of every building, with a scrollable list
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
/** The element that digs a closed block fast, or undefined for blocks without an element. */
export const cellFastTech = (c: unknown) => CELL_WEAK_TO[cellElement(c) ?? ''];
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
 * The catalog sheet: header (title, Energy, ✕) and one vertical grid of every building.
 * Drag or mouse wheel scrolls the list. Cards redraw live while it is open (Energy grows).
 */
export class BuildDrawer {
  private root: Phaser.GameObjects.Container | null = null;
  private strip: Phaser.GameObjects.Container | null = null;
  private cols = 3;
  private gap = 10;
  private cards: { o: BuildOption; c: Phaser.GameObjects.Container; x: number; y: number }[] = [];
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
    this.cols = LANDSCAPE ? 4 : 3;
    this.gap = 10;
    const sw = box.w - 52;
    this.cardW = Math.floor((sw - this.gap * (this.cols - 1)) / this.cols);
    // Show ~2 full rows + peek of a third so the user sees there is more to scroll.
    const sh = box.h - 196;
    this.cardH = Math.floor((sh - this.gap * 2) / 2.5);
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
        if (first) this.scrollTo(first.y - 4, true);
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
    mask.fillRect(sx - 2, sy - 6, sw + 4, (this.box.h - 196) + 14);
    strip.setMask(mask.createGeometryMask());
    this.cards = [];
    let col = 0;
    let row = 0;
    let lastGroup: BuildGroup | null = null;
    for (const o of options) {
      // New group always starts on a fresh row.
      if (lastGroup !== null && o.group !== lastGroup && col > 0) { row++; col = 0; }
      lastGroup = o.group;
      const cx = col * (this.cardW + this.gap);
      const cy = row * (this.cardH + this.gap);
      const c = s.add.container(cx, cy);
      strip.add(c);
      this.cards.push({ o, c, x: cx, y: cy });
      col++;
      if (col >= this.cols) { col = 0; row++; }
    }
    const totalRows = row + (col > 0 ? 1 : 0);
    const totalH = totalRows * (this.cardH + this.gap) - this.gap;
    this.maxScroll = Math.max(0, totalH - (this.box.h - 196));
    this.drawCards(options);
    // Swipe and tap on the row: a drag scrolls, a tap without a drag picks the card under the finger.
    const zone = s.add.zone(sx, sy, sw, this.box.h - 196).setOrigin(0).setInteractive({ useHandCursor: true });
    let downY = 0;
    let startScroll = 0;
    let dragged = false;
    zone.on('pointerdown', (p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      downY = p.y;
      startScroll = this.scroll;
      dragged = false;
    });
    zone.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      if (Math.abs(p.y - downY) > 12) dragged = true;
      if (dragged) this.scrollTo(startScroll - (p.y - downY));
    });
    zone.on('pointerup', (_p: Phaser.Input.Pointer, lx: number, ly: number) => {
      if (dragged) return;
      const atY = ly + this.scroll;
      const hit = this.cards.find((c) => lx >= c.x && lx <= c.x + this.cardW && atY >= c.y && atY <= c.y + this.cardH);
      if (hit) this.on.pick(hit.o);
    });
    zone.on('wheel', (_p: Phaser.Input.Pointer, _dx: number, dy: number, _dz: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      this.scrollTo(this.scroll + dy);
    });
    root.add(zone);
    // Hint under the row.
    root.add(s.add.text(x + w / 2, y + h - 22, t('build.drawer.hint'), TXT.body(LANDSCAPE ? 17 : 19, INK.dim, '500')).setOrigin(0.5));
    // Open on the highlighted card (tutorial) or the selected one.
    const focus = this.cards.find((c) => highlight.includes(c.o.id)) ?? this.cards.find((c) => c.o.key === selected);
    if (focus) this.scrollTo(focus.y - ((this.box.h - 196) - this.cardH) / 2);
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
    const sy = this.box.y + 152;
    if (ease) this.scene.tweens.add({ targets: this.strip, y: sy - to, duration: 220, ease: 'Cubic.easeOut' });
    else this.strip.y = sy - to;
    this.drawTabs();
  }

  private drawTabs(): void {
    // The active tab: the last group that starts in the upper half of the visible strip.
    const at = this.scroll + (this.box.h - 196) / 2;
    const starts = this.cards.filter((c, k) => k === 0 || this.cards[k - 1].o.group !== c.o.group);
    const cur = [...starts].reverse().find((c) => c.y <= at)?.o.group ?? this.cards[0]?.o.group;
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
  }
}

/**
 * One catalog card, drawn into `c` at (0, 0).
 *
 * Layout (redesigned Антон 2026-10-10):
 *   TOP ROW  (y 0–nameH)  — name (left) + element orbs (right, small)
 *   PICTURE  (y nameH–h-42) — art/sketch, pale sky well, hero portrait corner if station
 *   FOOT ROW (y h-42–h)   — price chip (OK/energy) or locked progress / dim reason
 *
 * No overlapping strips: every status goes into the dedicated foot row.
 */
function drawCard(s: Phaser.Scene, c: Phaser.GameObjects.Container, o: BuildOption, w: number, h: number, hl: boolean, sel: boolean): void {
  const locked = o.state === 'blueprint';
  const dim = o.state === 'requires' || o.state === 'max' || o.state === 'soon';
  const short = o.state === 'energy';
  const station = !!o.hero && !locked;

  // ── card plate ─────────────────────────────────────────────────────────────
  const g = s.add.graphics();
  c.add(g);
  if (locked) {
    drawPaper(g, 0, 0, w, h);
  } else {
    const borderCol = hl ? C.amber : sel ? C.seam : short ? C.coral : dim ? 0xb0bec5 : 0xc6d4d9;
    const borderW = hl ? 5 : sel ? 4 : short ? 3 : 2;
    chip(g, 0, 0, w, h, sel ? 0xd9f3f8 : C.white, 1, 14, { color: borderCol, width: borderW });
  }

  // ── TOP ROW: name + element orbs ───────────────────────────────────────────
  const nameColor = locked ? INK.white : dim ? INK.dim : INK.graphite;
  const nameLabel = station ? heroName(o.hero!) : optionName(o);
  const nameFS = LANDSCAPE ? 16 : 18;
  // Leave room on right for orbs if present
  const orbsW = o.techs.length && !locked ? Math.min(o.techs.length, 4) * 26 + 4 : 0;
  const nameMaxW = w - 14 - orbsW - 10;
  const name = s.add.text(10, 10, nameLabel, {
    ...TXT.body(nameFS, nameColor, '700'),
    wordWrap: { width: nameMaxW },
    lineSpacing: -2,
  });
  if (name.height > 46) name.setScale(46 / name.height);
  c.add(name);

  // Element orbs: small row top-right of the name band
  if (o.techs.length && !locked) {
    const og = s.add.graphics();
    const orbR = 10;
    o.techs.slice(0, 4).forEach((tech, k) => drawTechOrb(og, tech, w - orbsW + 4 + k * 26 + orbR, 22, orbR));
    c.add(og);
  }

  // ── PICTURE WELL ───────────────────────────────────────────────────────────
  const nameH = Math.max(46, name.displayHeight) + 16; // dynamic based on name wrap
  const footH = 42;
  const picTop = nameH;
  const picBot = h - footH;
  const picH = picBot - picTop;
  const picMidX = w / 2;
  const picMidY = picTop + picH / 2;

  if (!locked) {
    g.fillStyle(dim ? 0xe3e8ea : 0xeaf5f8, 1);
    g.fillRect(8, picTop + 2, w - 16, picH - 4);
    // Thin separator line above name (accent)
    if (!dim) {
      g.lineStyle(2, hl ? C.amber : sel ? C.seam : C.teal, 0.5);
      g.lineBetween(10, picTop - 1, w - 10, picTop - 1);
    }
  }

  const pic = buildingPic(s, o.id, picMidX, picMidY, w - 32, picH - 16, o.hero);
  if (pic) {
    if (locked) pic.setTintFill(0xffffff).setAlpha(0.75);
    else if (dim) pic.setTint(0x8a969c).setAlpha(0.72);
    c.add(pic);
  }

  // Hero station: round comic portrait in the top-right corner of the picture.
  if (o.hero && s.textures.exists(`comm.${o.hero}`)) {
    const r = 26;
    const px = w - 14 - r, py = picTop + 10 + r;
    const pg = s.add.graphics();
    pg.fillStyle(C.white, 1);
    pg.fillCircle(px, py, r + 2);
    pg.lineStyle(2, C.graphite, 0.8);
    pg.strokeCircle(px, py, r + 2);
    c.add(pg);
    const face = s.add.image(px, py, `comm.${o.hero}`);
    face.setScale((r * 2) / face.width);
    c.add(face);
  }

  // «Пригодится» badge: amber chip on the picture (station only).
  if (station && o.useful && o.digs) {
    const bt = s.add.text(w / 2, picBot - 6, t('build.station.useful', { zone: t(`zone.short.${o.digs}`) }), {
      ...TXT.body(13, INK.graphite, '800'),
      backgroundColor: '#FFC94D',
      padding: { x: 6, y: 2 },
    }).setOrigin(0.5, 1);
    if (bt.width > w - 24) bt.setScale((w - 24) / bt.width);
    c.add(bt);
  }

  // Land freed: bottom-left of picture (OK state only, below orbs).
  if (o.land > 0 && !locked && o.state === 'ok') {
    const lt = s.add.text(10, picBot - 4, t('build.card.land', { count: o.land }), {
      ...TXT.body(14, INK.teal, '700'),
      backgroundColor: '#FFFFFFCC',
      padding: { x: 5, y: 2 },
    }).setOrigin(0, 1);
    c.add(lt);
  }

  // Station detail rows (digs fast / strong against) below the name inside the picture area.
  if (station) {
    const rows: [string, string | undefined][] = [
      [o.digs ? t('build.station.digs', { zone: t(`zone.short.${o.digs}`) }) : t('build.station.digs_none'), o.digs],
      [o.strong ? t('build.station.strong', { tech: t(`tech.${o.strong}`) }) : '', o.strong],
    ];
    const dg = s.add.graphics();
    c.add(dg);
    let ry = picTop + 8;
    for (const [text, tech] of rows) {
      if (!text) continue;
      const orbR2 = 7;
      if (tech) drawTechOrb(dg, tech, 18, ry + orbR2, orbR2);
      const tl = s.add.text(tech ? 32 : 10, ry, text, TXT.body(13, locked ? '#DCEBFF' : INK.graphite, '600'));
      if (tl.width > w - (tech ? 42 : 20)) tl.setScale((w - (tech ? 42 : 20)) / tl.width);
      c.add(tl);
      ry += 20;
    }
  }

  // ── FOOT ROW: price / locked / dim ─────────────────────────────────────────
  const fy = h - footH + footH / 2; // centre of foot row

  if (locked) {
    // Blueprint progress bar + label.
    const fg = s.add.graphics();
    fragmentBar(fg, 12, h - footH + 6, w - 24, 10, o.have ?? 0, o.need ?? 1);
    c.add(fg);
    c.add(
      s.add.text(w / 2, h - footH / 2 + 8, t('build.state.blueprint', { have: o.have ?? 0, need: o.need ?? 0 }), TXT.body(16, '#DCEBFF', '700')).setOrigin(0.5),
    );
    return;
  }

  if (dim) {
    // Dimmed reason: just a small label in the foot row.
    const nt = s.add.text(w / 2, fy, o.note, TXT.body(15, INK.dim, '600')).setOrigin(0.5);
    if (nt.width > w - 20) nt.setScale((w - 20) / nt.width);
    c.add(nt);
    return;
  }

  // Affordable or short: price chip.
  const priceCol = short ? INK.coral : INK.cobalt;
  const priceBg = short ? 0xfde8ec : 0xe8f2fd;
  const pg2 = s.add.graphics();
  const chipW = 104, chipH = 32, chipX = (w - chipW) / 2, chipY = h - footH + 5;
  chip(pg2, chipX, chipY, chipW, chipH, priceBg, 1, 10, { color: short ? C.coral : C.cobalt, width: 2 });
  c.add(pg2);
  const costT = s.add.text(w / 2 + 10, chipY + chipH / 2, String(o.cost), TXT.num(20, priceCol)).setOrigin(0.5);
  c.add(costT);
  if (s.textures.exists('icon.energy')) c.add(s.add.image(w / 2 - costT.width / 2 - 4, chipY + chipH / 2, 'icon.energy').setScale(1.0).setOrigin(1, 0.5));
  // If short: small "not enough energy" label above the chip.
  if (short) {
    const nt = s.add.text(w / 2, h - footH + 2, o.note, TXT.body(12, INK.coral, '600')).setOrigin(0.5, 1);
    if (nt.width > w - 16) nt.setScale((w - 16) / nt.width);
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
