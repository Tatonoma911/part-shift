import { COL, type ClipDef } from './clip';

/**
 * The teaching clips. Each one shows one mechanic on a few real cells, with
 * the game's sprites, a finger and captions from learning/text. Times are in
 * seconds; work is sped up compared with the real game (a dig takes 9 s there).
 */

const THERMO = '#FF8A3D';
const CRYO = '#3DD6FF';
const VOLT = '#FFE14D';
const TOXIN = '#8CE04A';

/** Tap anywhere: the Command Center lands there (no pre-selected cells, Антон 2026-10-09). */
const start: ClipDef = {
  cols: 5,
  rows: 4,
  hud: true,
  length: 6.4,
  script(s) {
    s.caption(0.2, 'cap.tap_anywhere');
    s.fingerTo(0.4, 0.9, s.px(2, 1.15), s.px(4.4, 3.6));
    s.tap(1.5);
    const ring: [number, number][] = [];
    for (let y = 0; y <= 2; y++) for (let x = 1; x <= 3; x++) ring.push([x, y]);
    ring.forEach(([x, y]) => s.open(1.6 + Math.hypot(x - 2, y - 1) * 0.12, x, y, {}, x === 2 && y === 1));
    s.building(1.75, 'command', 2, 1);
    s.spawnFx(1.75, 'fx', 'explosion', 2, 1, 0.8);
    s.fingerHide(2.1);
    s.caption(2.4, 'cap.command_up');
    s.spawnFx(2.6, 'fx', 'resident_born', 2, 2);
    const r = s.spawn(2.7, 'resident', 2, 2);
    s.walk(3.5, r, [[2, 2], [3, 2]], 2);
    s.spawnFx(3.9, 'fx', 'resident_born', 2, 2);
    const r2 = s.spawn(4.0, 'resident', 2, 2);
    s.walk(4.6, r2, [[2, 2], [1, 2]], 2);
  },
};

/** Swipe to queue, residents walk and dig, the ring closes, Energy flies home. */
const dig: ClipDef = {
  cols: 6,
  rows: 4,
  hud: true,
  length: 8.4,
  script(s) {
    s.openRect(0, 0, 2, 3);
    s.building(0, 'command', 1, 1);
    const r1 = s.actor('resident', 2, 1);
    const r2 = s.actor('resident', 2, 2);
    s.caption(0.2, 'cap.swipe');
    s.fingerTo(0.4, 0.7, s.px(3, 0.15), s.px(5.5, 3.8));
    s.swipe(1.2, [[3, 0], [3, 1], [3, 2]], 0.35, (x, y, t) => s.set(t, x, y, { queued: true }));
    s.fingerHide(2.3);
    s.caption(2.1, 'cap.residents_go');
    const at1 = s.walk(2.1, r1, [[2, 1], [2, 0]], 2.6, 'dig');
    s.work(at1, 2, 3, 0);
    s.open(at1 + 2, 3, 0);
    s.play(at1 + 2, r1, 'idle');
    s.orb(at1 + 2.05, 3, 0);
    s.play(2.2, r2, 'dig');
    s.work(2.2, 2, 3, 2);
    s.open(4.2, 3, 2);
    s.orb(4.25, 3, 2);
    s.caption(4.4, 'cap.energy');
    const at2 = s.walk(4.4, r2, [[2, 2], [2, 1]], 2.6, 'dig');
    s.work(at2 + 0.1, 1.8, 3, 1);
    s.open(at2 + 1.9, 3, 1);
    s.play(at2 + 1.9, r2, 'idle');
    s.orb(at2 + 1.95, 3, 1);
  },
};

/** A number counts its 8 neighbours: tap it and see them. */
const clue: ClipDef = {
  cols: 5,
  rows: 5,
  length: 8.8,
  script(s) {
    s.openRect(1, 2, 3, 2);
    s.openRect(0, 3, 4, 4);
    s.openNow([[4, 2]], 'water_1');
    s.cell(1, 2).clue = { threat: 1, finds: 1 };
    s.cell(2, 2).clue = { threat: 1 };
    s.cell(3, 2).clue = { threat: 1 };
    s.cell(0, 3).clue = { finds: 1 };
    s.cell(1, 3).clue = { finds: 1 };
    s.actor('resident', 3, 4);
    s.caption(0.3, 'cap.tap_number');
    s.fingerTo(0.5, 0.7, s.px(2, 2.15), s.px(4.2, 4.6));
    s.tap(1.4);
    s.showFrame(1.45, 2, 2, COL.coral, 4.6);
    s.caption(1.6, 'cap.eight');
    s.fingerTo(4.7, 0.6, s.px(0, 3.15));
    s.tap(5.5);
    s.showFrame(5.55, 0, 3, COL.teal, 8.4);
    s.caption(5.6, 'cap.finds');
    s.fingerHide(6.2);
  },
};

/** The classic deduction: a 1 with one closed neighbour, then the overlap makes a cell safe. */
const deduce: ClipDef = {
  cols: 5,
  rows: 4,
  length: 9.2,
  script(s) {
    s.openRect(0, 2, 4, 3);
    s.openNow([[0, 1]], 'water_0');
    s.openNow([[4, 1]], 'water_2');
    s.cell(0, 2).clue = { threat: 1 };
    s.cell(1, 2).clue = { threat: 1 };
    s.cell(2, 2).clue = { threat: 1, finds: 1 };
    s.cell(3, 2).clue = { finds: 1 };
    s.cell(4, 2).clue = { finds: 1 };
    s.actor('resident', 2, 3);
    s.caption(0.3, 'cap.tap_number');
    s.fingerTo(0.5, 0.7, s.px(0, 2.15), s.px(3.5, 3.8));
    s.tap(1.3);
    s.showFrame(1.35, 0, 2, COL.coral, 3.6);
    s.caption(1.6, 'cap.one_closed');
    s.mark(2.6, 1, 1, 'threat');
    s.fingerTo(3.6, 0.5, s.px(1, 2.15));
    s.tap(4.3);
    s.showFrame(4.35, 1, 2, COL.coral, 7.2);
    s.caption(4.5, 'cap.overlap');
    s.mark(5.6, 2, 1, 'safe');
    s.caption(5.7, 'cap.safe');
    s.mark(6.6, 3, 1, 'safe');
    s.fingerHide(7.3);
  },
};

/** An empty block: every neighbour is safe, the scanner ticks them, you choose what to dig. */
const cascade: ClipDef = {
  cols: 5,
  rows: 3,
  length: 8.4,
  script(s) {
    s.openRect(0, 0, 1, 2);
    const r = s.actor('resident', 1, 1, 'dig');
    const r2 = s.actor('resident', 1, 0);
    s.set(0, 2, 1, { queued: true });
    s.work(0.3, 1.8, 2, 1);
    s.open(2.1, 2, 1);
    s.play(2.1, r, 'idle');
    s.caption(2.2, 'cap.cascade');
    const ring: [number, number][] = [[2, 0], [3, 0], [3, 1], [3, 2], [2, 2]];
    ring.forEach(([x, y], i) => s.mark(2.6 + i * 0.12, x, y, 'safe'));
    s.caption(3.4, 'cap.cascade2');
    s.fingerTo(3.4, 0.5, s.px(2, 0.1), s.px(4.4, 2.8));
    s.swipe(4.0, [[2, 0], [3, 0], [3, 1]], 0.3, (x, y, t) => s.set(t, x, y, { queued: true, mark: undefined }));
    s.fingerHide(5.1);
    s.play(4.3, r2, 'dig');
    s.work(4.3, 0.9, 2, 0);
    s.open(5.2, 2, 0, { clue: { finds: 1 } });
    s.walk(4.6, r, [[1, 1], [2, 1]], 3, 'dig');
    s.work(5.0, 1.0, 3, 1);
    s.open(6.0, 3, 1, { clue: { threat: 1 } });
    s.walk(5.3, r2, [[1, 0], [2, 0]], 3, 'dig');
    s.work(5.7, 1.0, 3, 0);
    s.open(6.7, 3, 0, { clue: { threat: 1 } });
    s.play(6.0, r, 'idle');
    s.play(6.7, r2, 'idle');
  },
};

/** Build tab, pick the School, tap a glowing tile; a resident builds it and every resident gets stronger. */
const build: ClipDef = {
  cols: 5,
  rows: 4,
  hud: true,
  dock: true,
  length: 10,
  script(s) {
    s.openRect(0, 0, 4, 3);
    s.building(0, 'command', 1, 1);
    s.building(0, 'reactor', 0, 3);
    const r = s.actor('resident', 2, 2);
    const r2 = s.actor('resident', 2, 0, 'dig');
    s.setEnergy(0, 180);
    s.caption(0.3, 'cap.open_build');
    s.fingerTo(0.5, 0.6, s.dockButton('build'), s.px(4, 3.4));
    s.tap(1.3);
    s.tl.at(1.35, () => (s.dock = { active: 'build', picker: true, sel: null, t0: 1.35 }));
    s.caption(1.5, 'cap.pick');
    s.fingerTo(1.7, 0.5, s.pickerSlot(1));
    s.tap(2.4);
    s.tl.at(2.45, () => s.dock && (s.dock.sel = 'school'));
    s.tl.at(2.8, () => s.dock && (s.dock.picker = false));
    const spots: [number, number][] = [[3, 1], [3, 2], [3, 0], [2, 3], [3, 3], [4, 2], [4, 1]];
    for (const [x, y] of spots) s.set(2.8, x, y, { glow: COL.seam });
    s.caption(2.9, 'cap.place');
    s.fingerTo(3.0, 0.5, s.px(3, 2.15));
    s.tap(3.7);
    for (const [x, y] of spots) s.set(3.75, x, y, { glow: undefined });
    s.tl.at(3.75, () => s.dock && (s.dock.active = 'dig'));
    s.setEnergy(3.75, 80);
    s.fingerHide(4.1);
    s.building(4.2, 'school', 3, 2, 2.4);
    s.play(4.0, r, 'build');
    s.caption(4.2, 'cap.built');
    s.play(6.6, r, 'idle');
    s.play(6.6, r2, 'idle');
    s.caption(6.9, 'cap.trained');
    for (const a of [r, r2]) {
      s.spawnFx(6.9, 'fx', 'resident_born', a.x, a.y);
      s.tl.at(6.95, () => (a.glow = COL.seam));
      s.tl.tween(6.95, 0.35, (k) => (a.scale = 1 + 0.18 * Math.sin(k * Math.PI)));
    }
    s.showCard(7.3, 'building.school.name', 'card.level_up', COL.teal, 9.8);
    s.play(8.0, r2, 'dig');
  },
};

/** Residents drop their work to fight a nearby enemy, go back to digging, and a tap sends them all. */
const order: ClipDef = {
  cols: 6,
  rows: 4,
  length: 11,
  script(s) {
    s.openRect(0, 0, 5, 3);
    Object.assign(s.cell(1, 0), { open: false });
    Object.assign(s.cell(2, 0), { open: false });
    s.building(0, 'command', 0, 2);
    const r1 = s.actor('resident', 1, 1, 'dig', { hp: 1 });
    const r2 = s.actor('resident', 2, 1, 'dig', { hp: 1 });
    s.work(0, 1.0, 1, 0, 1, 0.6);
    s.work(0, 1.0, 2, 0, 0.9, 0.5);
    const e1 = s.spawn(0.2, 'adaptant_volt', 5, 2, 'idle', { hp: 1 });
    s.walk(0.2, e1, [[5, 2], [3, 2]], 2.4);
    s.caption(0.6, 'cap.drop_tools');
    s.walk(1.0, r2, [[2, 1], [2, 2]], 3);
    s.walk(1.0, r1, [[1, 1], [2, 2.6]], 3);
    s.face(1.5, r2, 1);
    s.face(1.5, r1, 1);
    s.hit(1.4, e1, r2, 0.8, 'hit_volt');
    s.hit(1.7, r2, e1, 0.6);
    s.hit(2.0, r1, e1, 0.3);
    s.hit(2.4, r2, e1, 0, 'hit_impact');
    s.play(2.8, e1, 'death');
    s.fade(3.5, e1, 0);
    s.caption(3.2, 'cap.back_to_work');
    s.walk(3.3, r2, [[2, 2], [2, 1]], 3, 'dig');
    s.walk(3.3, r1, [[2, 2.6], [1, 1]], 3, 'dig');
    s.work(3.9, 1.5, 2, 0, 0.5, 0.2);
    s.work(4.0, 1.5, 1, 0, 0.6, 0.3);
    const e2 = s.spawn(5.0, 'adaptant_thermo', 5, 3, 'idle', { hp: 1, flip: true });
    s.caption(5.2, 'cap.tap_enemy');
    s.fingerTo(5.3, 0.6, s.px(5, 3.05), s.px(3.5, 4.2));
    s.tap(6.1);
    s.setTarget(6.15, 5, 3, 9.3);
    s.fingerHide(6.4);
    s.walk(6.2, r1, [[1, 1], [3, 2], [4, 3]], 3);
    s.walk(6.2, r2, [[2, 1], [4, 2]], 3);
    s.face(7.4, r1, 1);
    s.face(7.4, r2, 1);
    s.hit(7.4, r2, e2, 0.6);
    s.hit(7.7, r1, e2, 0.3);
    s.hit(8.1, r2, e2, 0);
    s.play(8.4, e2, 'death');
    s.fade(9.2, e2, 0);
    s.caption(9.0, 'cap.back_to_work');
    s.walk(9.2, r2, [[4, 2], [2, 1]], 3, 'dig');
    s.walk(9.2, r1, [[4, 3], [1, 1]], 3, 'dig');
  },
};

/** A proven nest: tap the mark, confirm, residents fight what comes out, then destroy the nest. */
const nest: ClipDef = {
  cols: 6,
  rows: 4,
  length: 11.4,
  script(s) {
    s.openRect(0, 0, 3, 3);
    s.cell(3, 0).clue = { threat: 1 };
    s.cell(3, 1).clue = { threat: 1 };
    s.cell(3, 2).clue = { threat: 1 };
    s.mark(0, 4, 1, 'threat');
    s.building(0, 'reactor', 0, 2);
    const d1 = s.actor('resident', 2, 1, 'idle', { hp: 1 });
    const d2 = s.actor('resident', 2, 2, 'idle', { hp: 1 });
    s.caption(0.3, 'cap.tap_marker');
    s.fingerTo(0.5, 0.6, s.px(4, 1.15), s.px(5.5, 3.6));
    s.tap(1.3);
    s.chipAt(1.35, 'chip.confirm', 4, 1, 2.2, 2.4);
    s.fingerTo(1.6, 0.4, s.chipPos(4, 1));
    s.tap(2.2);
    s.fingerHide(2.6);
    s.open(2.4, 4, 1, { tile: 'nest' }, false);
    s.spawnFx(2.4, 'fx', 'explosion', 4, 1);
    s.caption(2.5, 'cap.nest_open');
    const e1 = s.spawn(2.7, 'adaptant_thermo', 4, 1, 'idle', { hp: 1 });
    const e2 = s.spawn(3.0, 'adaptant_toxin', 4, 1, 'idle', { hp: 1 });
    s.spawnFx(2.65, 'nest', 'spawn', 4, 1);
    s.spawnFx(2.95, 'nest', 'spawn', 4, 1);
    s.walk(2.7, e1, [[4, 1], [3, 1]], 2.4);
    s.walk(3.0, e2, [[4, 1], [3, 2]], 2.4);
    s.caption(3.4, 'cap.auto_fight');
    s.hit(3.3, e1, d1, 0.85, 'hit_thermo');
    s.hit(3.5, d1, e1, 0.55);
    s.hit(3.8, d2, e2, 0.55);
    s.hit(4.1, d1, e1, 0.1);
    s.hit(4.2, e2, d2, 0.8, 'hit_impact');
    s.hit(4.5, d2, e2, 0.15);
    s.hit(4.6, d1, e1, 0);
    s.play(4.9, e1, 'death');
    s.hit(5.0, d2, e2, 0);
    s.play(5.3, e2, 'death');
    s.fade(5.8, e1, 0);
    s.fade(6.1, e2, 0);
    s.caption(6.3, 'cap.tap_enemy');
    s.fingerTo(6.3, 0.5, s.px(4, 1.15), s.px(5, 3.5));
    s.tap(7.0);
    s.setTarget(7.05, 4, 1, 9.5);
    s.fingerHide(7.3);
    s.walk(7.1, d1, [[2, 1], [3, 0]], 2.8);
    s.walk(7.1, d2, [[2, 2], [3, 1]], 2.8);
    s.face(7.8, d1, 1);
    s.strike(7.9, d2, 4, 1);
    s.strike(8.2, d1, 4, 1);
    s.strike(8.6, d2, 4, 1);
    s.strike(9.0, d1, 4, 1);
    s.set(9.4, 4, 1, { tile: 'nest_dead' });
    s.spawnFx(9.4, 'nest', 'destroy', 4, 1);
    s.spawnFx(9.45, 'fx', 'explosion', 4, 1);
    s.orb(9.6, 4, 1, 0.8, 40);
    s.caption(9.6, 'cap.nest_down');
  },
};

/** The killing blow takes the enemy's arm and fits it. */
const parts: ClipDef = {
  cols: 4,
  rows: 3,
  length: 8,
  script(s) {
    s.openRect(0, 0, 3, 2);
    const d = s.actor('resident', 1, 1, 'idle', { hp: 1 });
    const e = s.actor('adaptant_thermo', 2, 1, 'idle', { hp: 1, flip: true });
    s.hit(0.4, d, e, 0.7);
    s.hit(0.9, e, d, 0.85, 'hit_thermo');
    s.hit(1.4, d, e, 0.35);
    s.hit(1.9, e, d, 0.7, 'hit_thermo');
    s.caption(2.2, 'cap.last_hit');
    s.hit(2.4, d, e, 0);
    s.play(2.75, e, 'rip_part');
    s.caption(2.9, 'cap.takes_part');
    s.flyIcon(3.1, 'icon.part', [2, 1], [1, 1], 0.5);
    s.play(3.25, e, 'death');
    s.fade(4.2, e, 0, 0.4);
    s.play(3.6, d, 'install_part');
    s.tl.at(3.9, () => (d.glow = THERMO));
    s.tl.tween(3.9, 0.35, (k) => (d.scale = 1 + 0.15 * Math.sin(k * Math.PI)));
    s.play(4.3, d, 'idle');
    s.spawnFx(3.9, 'fx', 'hit_thermo', 1, 0.6);
    s.showCard(4.3, 'card.module', 'card.thermo_arm', THERMO, 7.8, 'card.rank');
    s.caption(4.5, 'cap.stronger');
  },
};

/** The element cycle in a fight: cryogel melts a thermo adaptant, barely scratches a cryo one; volt finishes it. */
const elements: ClipDef = {
  cols: 5,
  rows: 4,
  length: 10.6,
  script(s) {
    s.openRect(0, 0, 4, 3);
    const cryo = s.actor('resident', 1, 1, 'idle', { hp: 1, glow: CRYO });
    const volt = s.actor('resident', 0, 0, 'idle', { hp: 1, glow: VOLT });
    const e1 = s.spawn(0.2, 'adaptant_thermo', 4, 1, 'idle', { hp: 1 });
    s.walk(0.2, e1, [[4, 1], [2, 1]], 2.4);
    s.face(1.0, cryo, 1);
    s.hit(1.1, cryo, e1, 0.45, 'hit_cryo');
    s.pop(1.35, 2, 1, '×1.5', CRYO);
    s.caption(1.3, 'cap.strong');
    s.hit(1.9, cryo, e1, 0, 'hit_cryo');
    s.pop(2.15, 2, 1, '×1.5', CRYO);
    s.play(2.4, e1, 'death');
    s.fade(3.1, e1, 0);
    const e2 = s.spawn(3.4, 'adaptant_cryo', 4, 1, 'idle', { hp: 1 });
    s.walk(3.4, e2, [[4, 1], [2, 1]], 2.4);
    s.hit(4.3, cryo, e2, 0.88, 'hit_cryo');
    s.pop(4.55, 2, 1, '×0.5', '#9AA7AE');
    s.caption(4.5, 'cap.weak');
    s.hit(5.1, cryo, e2, 0.78, 'hit_cryo');
    s.pop(5.35, 2, 1, '×0.5', '#9AA7AE');
    s.hit(5.4, e2, cryo, 0.7, 'hit_cryo');
    s.caption(6.0, 'cap.picks');
    s.walk(5.9, volt, [[0, 0], [2, 0]], 3);
    s.face(6.6, volt, 1);
    s.hit(6.7, volt, e2, 0.42, 'hit_volt');
    s.pop(6.95, 2, 1, '×1.5', VOLT);
    s.hit(7.4, volt, e2, 0.05, 'hit_volt');
    s.pop(7.65, 2, 1, '×1.5', VOLT);
    s.hit(7.9, cryo, e2, 0, 'hit_cryo');
    s.play(8.2, e2, 'death');
    s.fade(9.0, e2, 0);
  },
};

/** A hero lair opens by itself; residents swarm the hero, it drops two parts. */
const heroes: ClipDef = {
  cols: 6,
  rows: 4,
  length: 11.2,
  script(s) {
    s.openRect(0, 0, 3, 3);
    s.cell(3, 0).clue = { threat: 1 };
    s.cell(3, 1).clue = { threat: 1 };
    s.cell(3, 2).clue = { threat: 1 };
    s.mark(0, 4, 1, 'threat');
    s.building(0, 'command', 0, 1);
    const rs = [
      s.actor('resident', 2, 0, 'idle', { hp: 1, glow: CRYO }),
      s.actor('resident', 2, 1, 'idle', { hp: 1 }),
      s.actor('resident', 2, 2, 'idle', { hp: 1, glow: TOXIN }),
      s.actor('resident', 1, 2, 'idle', { hp: 1 }),
      s.actor('resident', 1, 0, 'idle', { hp: 1 }),
    ];
    s.caption(0.4, 'cap.hero_out');
    s.tl.tween(0.4, 0.8, (k) => (s.cell(4, 1).glow = k < 1 ? COL.coral : undefined));
    s.open(1.2, 4, 1, { tile: 'hatch_1', mark: undefined }, false);
    s.spawnFx(1.2, 'fx', 'explosion', 4, 1, 1.3);
    const kiln = s.spawn(1.4, 'kiln', 4, 1, 'idle', { hp: 1, flip: true });
    s.play(1.5, kiln, 'tic');
    s.walk(2.3, kiln, [[4, 1], [3, 1]], 1.6);
    s.caption(2.6, 'cap.swarm');
    const spots: [number, number][] = [[3, 0], [2.4, 1], [3, 2], [4, 2], [4, 0]];
    rs.forEach((r, i) => s.walk(2.6 + i * 0.08, r, [[r.x, r.y], spots[i]], 3.2));
    rs.forEach((r, i) => s.face(3.6, r, i < 3 ? 1 : -1));
    s.hit(3.4, kiln, rs[1], 0.45, 'hit_impact');
    const blows: [number, number, string][] = [[0, 0.88, 'hit_cryo'], [2, 0.76, 'hit_thermo'], [3, 0.68, 'hit_impact'], [4, 0.6, 'hit_impact'], [1, 0.52, 'hit_impact'], [0, 0.4, 'hit_cryo'], [2, 0.28, 'hit_thermo'], [3, 0.18, 'hit_impact'], [4, 0.1, 'hit_impact']];
    blows.forEach(([i, hp, fx], n) => s.hit(3.7 + n * 0.28, rs[i], kiln, hp, fx));
    s.hit(5.2, kiln, rs[3], 0.5, 'hit_impact');
    s.hit(6.3, rs[0], kiln, 0, 'hit_cryo');
    s.play(6.6, kiln, 'rip_part');
    s.caption(6.8, 'cap.two_parts');
    s.flyIcon(6.9, 'icon.part', [3, 1], [3, 0], 0.5);
    s.flyIcon(7.1, 'icon.part', [3, 1], [3, 2], 0.6);
    s.play(7.3, kiln, 'death');
    s.fade(8.4, kiln, 0, 0.5);
    s.tl.at(7.45, () => (rs[0].glow = '#C9B8A3'));
    s.tl.at(7.75, () => (rs[2].glow = '#C9B8A3'));
    s.showCard(7.7, 'card.hero_part', 'card.kiln_arm', '#9C7F5C', 10.9, 'part.kiln_leg.label');
  },
};

/** The call: purple numbers lead to the target's lair, the hero comes out, residents beat it and close the shift. */
const call: ClipDef = {
  cols: 6,
  rows: 4,
  length: 11.2,
  script(s) {
    s.openRect(0, 0, 3, 3);
    s.cell(3, 0).clue = { demon: 1 };
    s.cell(3, 1).clue = { demon: 1 };
    s.cell(3, 2).clue = { demon: 1, threat: 1 };
    s.mark(0, 4, 1, 'demon');
    const d1 = s.actor('resident', 2, 1, 'idle', { hp: 1, glow: CRYO });
    const d2 = s.actor('resident', 2, 2, 'idle', { hp: 1, glow: CRYO });
    const d3 = s.actor('resident', 1, 1, 'idle', { hp: 1, glow: THERMO });
    s.caption(0.3, 'cap.boss');
    s.showFrame(0.3, 3, 1, COL.violet, 1.2);
    s.fingerTo(0.6, 0.6, s.px(4, 1.15), s.px(5.5, 3.6));
    s.tap(1.4);
    s.chipAt(1.45, 'chip.confirm', 4, 1, 2.2, 2.4);
    s.fingerTo(1.6, 0.4, s.chipPos(4, 1));
    s.tap(2.2);
    s.fingerHide(2.6);
    s.open(2.4, 4, 1, { tile: 'hatch_1' }, false);
    s.spawnFx(2.4, 'demon_hatch', 'open', 4, 1);
    const dm = s.spawn(2.8, 'demon', 4, 1, 'emerge', { hp: 1 });
    s.play(3.8, dm, 'idle');
    s.caption(3.9, 'cap.windup');
    s.play(3.9, dm, 'tail_swing');
    s.tl.at(3.9, () => (s.lane = { x0: 3.4, y: 1, x1: 0.6, t0: 3.9 }));
    s.walk(4.0, d1, [[2, 1], [2, 0]], 3.2);
    s.walk(4.0, d3, [[1, 1], [1, 0]], 3.2);
    s.play(4.7, dm, 'steam');
    s.caption(4.8, 'cap.steam');
    for (let x = 1; x <= 3; x++) s.set(4.8 + (3 - x) * 0.08, x, 1, { hot: true });
    s.spawnFx(4.8, 'fx', 'heat_haze', 3, 1);
    s.spawnFx(4.9, 'fx', 'heat_haze', 2, 1);
    s.spawnFx(5.0, 'fx', 'heat_haze', 1, 1);
    s.tl.at(5.2, () => (s.lane = null));
    s.play(5.3, dm, 'idle');
    for (let x = 1; x <= 3; x++) s.set(7.6, x, 1, { hot: false });
    s.walk(5.3, d1, [[2, 0], [3, 0]], 2.8);
    s.walk(5.3, d2, [[2, 2], [3, 2]], 2.8);
    s.walk(5.3, d3, [[1, 0], [2, 0], [3, 0.4]], 2.8);
    s.face(5.8, d1, 1);
    s.face(5.8, d2, 1);
    s.hit(5.8, d1, dm, 0.82, 'hit_cryo');
    s.pop(6.05, 4, 1, '×1.5', CRYO);
    s.hit(6.1, d2, dm, 0.64, 'hit_cryo');
    s.hit(6.5, dm, d2, 0.6, 'hit_impact');
    s.hit(6.6, d3, dm, 0.58, 'hit_thermo');
    s.pop(6.85, 4, 1, '×0.5', '#9AA7AE');
    s.hit(6.9, d1, dm, 0.38, 'hit_cryo');
    s.hit(7.2, d2, dm, 0.2, 'hit_cryo');
    s.hit(7.5, d1, dm, 0, 'hit_cryo');
    s.play(7.8, dm, 'death');
    s.caption(8.0, 'cap.demon_down');
    s.flyIcon(8.1, 'icon.part', [4, 1], [3, 0], 0.5);
    s.flyIcon(8.3, 'icon.part', [4, 1], [3, 2], 0.6);
    s.showCard(8.6, 'card.boss', 'card.win', COL.violet, 11);
  },
};

/** The threat ring fills; at the next level enemies grow tougher. */
const threat: ClipDef = {
  cols: 5,
  rows: 4,
  hud: true,
  length: 6.6,
  script(s) {
    s.openRect(0, 0, 4, 3);
    s.building(0, 'command', 1, 1);
    s.actor('resident', 2, 2, 'dig');
    const e1 = s.actor('adaptant_cryo', 4, 1, 'walk', { flip: true });
    const e2 = s.actor('adaptant_volt', 4, 3, 'walk', { flip: true });
    s.tl.at(0, () => s.hud && (s.hud.threat = 1));
    s.caption(0.3, 'cap.threat_ring');
    s.tl.tween(0.3, 2.7, (k) => s.hud && (s.hud.frac = 0.15 + 0.85 * k));
    s.tl.at(3.0, () => {
      if (!s.hud) return;
      s.hud.threat = 2;
      s.hud.frac = 0;
      s.hud.threatBumpT = 3.0;
    });
    s.caption(3.1, 'cap.threat_up');
    s.tl.tween(3.1, 0.5, (k) => {
      e1.scale = e2.scale = 1 + 0.25 * k;
    });
    s.tl.at(3.1, () => (e1.glow = e2.glow = COL.coral));
    s.tl.tween(3.6, 3, (k) => s.hud && (s.hud.frac = 0.3 * k), (k) => k);
  },
};

/** Hold to flag a block; swipes go around it. */
const caution: ClipDef = {
  cols: 5,
  rows: 3,
  length: 6.6,
  script(s) {
    s.openRect(1, 2, 3, 2);
    s.openNow([[0, 2]], 'water_1');
    s.openNow([[4, 2]], 'water_3');
    s.cell(1, 2).clue = { threat: 1 };
    s.cell(2, 2).clue = { threat: 1 };
    s.cell(3, 2).clue = { threat: 1 };
    s.caption(0.3, 'cap.hold');
    s.fingerTo(0.5, 0.5, s.px(2, 1.15), s.px(4.2, 2.8));
    s.hold(1.2, 0.8);
    s.mark(2.0, 2, 1, 'caution');
    s.caption(2.1, 'cap.caution');
    s.fingerTo(2.6, 0.4, s.px(0, 1.15));
    s.caption(3.1, 'cap.swipe_skips');
    s.swipe(3.2, [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]], 0.3, (x, y, t) => {
      if (x !== 2) s.set(t, x, y, { queued: true });
    });
    s.fingerHide(4.8);
  },
};

/** Where Energy comes from besides digging: veins, reactors, caches. */
const energy: ClipDef = {
  cols: 5,
  rows: 4,
  hud: true,
  length: 8.2,
  script(s) {
    s.openRect(0, 0, 4, 3);
    s.openNow([[3, 1]], 'vein_0_1');
    Object.assign(s.cell(4, 3), { open: false });
    const r1 = s.actor('resident', 2, 1, 'dig');
    const reactor = s.building(0, 'reactor', 1, 2);
    s.caption(0.3, 'cap.vein');
    for (const t of [0.3, 1.1, 1.9, 2.7]) s.spawnFx(t, 'fx', 'vein_spark', 3, 1);
    for (const t of [0.8, 1.6, 2.4]) s.orb(t, 3, 1, 0.7, 1);
    s.play(3.0, r1, 'idle');
    s.caption(3.0, 'cap.reactor');
    s.buildingAnim(3.0, reactor, 'working');
    for (const t of [3.3, 4.1]) s.orb(t, 1, 2, 0.7, 1);
    s.set(4.6, 4, 3, { queued: true });
    const r2 = s.spawn(4.6, 'resident', 3, 3, 'dig');
    s.caption(4.8, 'cap.cache');
    s.work(4.7, 1.2, 4, 3);
    s.open(5.9, 4, 3, { tile: 'cache' });
    s.spawnFx(5.95, 'fx', 'cache_open', 4, 3);
    s.play(5.9, r2, 'idle');
    s.orb(6.1, 4, 3, 0.8, 60);
  },
};

export const CLIPS: Record<string, ClipDef> = { start, dig, clue, deduce, cascade, build, order, nest, parts, elements, heroes, call, threat, caution, energy };
export type ClipId = keyof typeof CLIPS;
