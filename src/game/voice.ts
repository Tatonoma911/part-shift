import Phaser from 'phaser';
import type { GameEvent, World } from '../core/world';
import voiceJson from '../data/text/voice.json';
import { hasLangText, lang, t } from '../i18n';
import { sound } from './audio';
import { UI_DEPTH } from './cameras';
import { BOARD, C, INK } from './layout';
import { chip, TXT } from './ui';

/**
 * The city's voice (text/VOICE.md, text/voice.json; writer's lines in ru.json):
 * Контроль announcements at the bottom of the board, the HERO | OUT ad ticker
 * in quiet moments, and speech bubbles over maddened heroes and survivors.
 * Jokes never block play: nothing here pauses the game or takes taps.
 * The hero's corner portrait on spawn belongs to Comm.ts, so spawn lines stay there.
 */
interface Trigger {
  event: string;
  channel: string;
  pool?: string[];
  poolByHero?: Record<string, string[]>;
  byHero?: string;
  chance?: number;
  first?: boolean;
  priority?: boolean;
  delaySeconds?: number;
  everySeconds?: number;
  afterQuietSeconds?: number;
}
interface Channel {
  cooldownSeconds?: number;
  maxPerMinute?: number;
  showSeconds?: number;
}

const TRIGGERS = voiceJson.triggers as Trigger[];
const CHANNELS = voiceJson.channels as Record<string, Channel>;

/** Engine event → voice.json event name, where they differ. */
const ALIAS: Record<string, string> = {
  boss_warning: 'demon_warning',
  boss_awake: 'demon_awake',
  training_up: 'defender_trained',
  survivor_joined: 'survivor_found',
};

const BAR_H = 76;
const DEPTH = UI_DEPTH + 2;

export class Voice {
  private last = new Map<string, string>();
  private fired = new Set<string>();
  private lastShown: Record<string, number> = {};
  private minute: number[] = [];
  private quietSince = 0;
  private idleDone = new Set<string>();
  private heroTick = 0;
  private bar: Phaser.GameObjects.Container | null = null;
  private typer: Phaser.Time.TimerEvent | null = null;

  constructor(
    private scene: Phaser.Scene,
    private world: World,
    private me: number,
    /** Board point over a unit's head, or over a cell when there is no unit. */
    private bubbleAt: (at: { unit?: number; x?: number; y?: number }) => { x: number; y: number } | null,
  ) {}

  /** A fresh run: Контроль says good morning. */
  start(fresh: boolean): void {
    if (fresh) this.fire({ type: 'run_start' });
  }

  onEvent(e: GameEvent): void {
    if (e.owner !== undefined && e.owner !== this.me && e.owner >= 0) return;
    this.quiet();
    if (e.type === 'build_refused' && e.text === 'build.not_enough_energy') return this.fire({ ...e, type: 'energy_low' });
    this.fire({ ...e, type: ALIAS[e.type] ?? e.type });
  }

  /** Pause and the menu: a tip, sometimes a Контроль line. */
  onPause(): void {
    this.fire({ type: 'pause' });
  }

  /** Called every frame: idle lines, the ad ticker, heroes muttering. */
  update(): void {
    const s = this.world.s;
    if (s.outcome !== 'playing' || !this.world.started) return;
    const quiet = s.time - this.quietSince;
    for (const tr of TRIGGERS) {
      if (tr.event !== 'idle' || !tr.afterQuietSeconds) continue;
      const key = `${tr.channel}:${tr.afterQuietSeconds}`;
      if (quiet >= tr.afterQuietSeconds && !this.idleDone.has(key)) {
        this.idleDone.add(key);
        this.play(tr, { type: 'idle' });
      }
    }
    // Maddened heroes on the board mutter now and then (hero_tick).
    if (s.time - this.heroTick >= 15) {
      this.heroTick = s.time;
      const heroes = s.units.filter((u) => u.kind === 'hero' && u.hp > 0);
      const u = heroes[Math.floor(Math.random() * heroes.length)];
      if (u) for (const tr of TRIGGERS.filter((x) => x.event === 'hero_tick')) this.play(tr, { type: 'hero_tick', text: u.hero, unit: u.id });
    }
  }

  /** Combat and arrivals reset the quiet clock; the idle lines may come again. */
  private quiet(): void {
    this.quietSince = this.world.s.time;
    this.idleDone.clear();
  }

  private fire(e: GameEvent): void {
    for (const tr of TRIGGERS) if (tr.event === e.type) this.play(tr, e);
  }

  private play(tr: Trigger, e: GameEvent): void {
    if (tr.first) {
      const key = `${tr.event}:${tr.channel}`;
      if (this.fired.has(key)) return;
      this.fired.add(key);
    }
    if (tr.chance !== undefined && Math.random() >= tr.chance) return;
    const line = this.pick(tr, e.text);
    if (!line) return;
    const go = () => this.show(tr, line, e);
    if (tr.delaySeconds) this.scene.time.delayedCall(tr.delaySeconds * 1000, go);
    else go();
  }

  /** A random line from the pool, never the last one shown from it; only lines that exist in the player's language. */
  private pick(tr: Trigger, hero?: string): string | null {
    let pool: string[] | undefined = tr.pool;
    if (!pool && hero) pool = tr.poolByHero?.[hero] ?? (tr.byHero ? [tr.byHero.replace('{hero}', hero)] : undefined);
    if (!pool?.length) return null;
    pool = pool.filter((k) => hasLangText(lang, k));
    if (!pool.length) return null;
    const id = `${tr.event}:${tr.channel}`;
    const fresh = pool.length > 1 ? pool.filter((k) => k !== this.last.get(id)) : pool;
    const key = fresh[Math.floor(Math.random() * fresh.length)];
    this.last.set(id, key);
    return key;
  }

  private show(tr: Trigger, key: string, e: GameEvent): void {
    const now = this.world.s.time;
    const ch = CHANNELS[tr.channel] ?? {};
    if (!tr.priority && now - (this.lastShown[tr.channel] ?? -1e9) < (ch.cooldownSeconds ?? 0)) return;
    if (tr.channel === 'control' && !tr.priority) {
      this.minute = this.minute.filter((m) => now - m < 60);
      if (this.minute.length >= (ch.maxPerMinute ?? 99)) return;
    }
    switch (tr.channel) {
      case 'control':
        this.minute.push(now);
        this.lastShown.control = now;
        this.banner(t(key, { hero: e.text ? t(`enemy.${e.text}.name`) : '', n: e.amount ?? '', count: e.amount ?? '' }), ch.showSeconds ?? 4.5, false);
        sound.play('voice_control');
        return;
      case 'ad':
        // Ads wait for a free slot: Контроль always wins it.
        if (this.bar) return;
        this.lastShown.ad = now;
        this.banner(t(key), 7, true);
        return;
      case 'hero':
      case 'survivor': {
        this.lastShown[tr.channel] = now;
        const unit = e.unit ?? (e.text ? this.world.s.units.find((u) => u.hero === e.text && u.hp > 0)?.id : undefined);
        const pos = this.bubbleAt({ unit, x: e.x, y: e.y });
        if (!pos) return;
        this.bubble(t(key), pos.x, pos.y, ch.showSeconds ?? 3, tr.channel === 'hero');
        if (tr.channel === 'survivor') sound.play('voice_survivor');
        else if (e.text) sound.play(`voice_hero_${e.text}`);
        return;
      }
    }
  }

  /** Контроль's PA strip (white helmet mask, blue smile) or the HERO | OUT billboard, typed out letter by letter. */
  private banner(text: string, seconds: number, ad: boolean): void {
    const s = this.scene;
    this.bar?.destroy();
    this.typer?.remove();
    const w = Math.min(BOARD.w - 32, 720);
    const x = BOARD.x + BOARD.w / 2;
    const items: Phaser.GameObjects.GameObject[] = [];
    let left = -w / 2 + 18;
    let tag: Phaser.GameObjects.Text | null = null;
    if (ad) {
      tag = s.add.text(left, 0, 'HERO | OUT', { ...TXT.caps(INK.white), fontSize: '18px', backgroundColor: '#10171C', padding: { x: 8, y: 6 } }).setOrigin(0, 0.5);
      left += tag.width + 14;
    } else left += 58;
    const prefix = ad ? '' : `${t('voice.control_prefix')} `;
    const full = prefix + text;
    // Measure the whole line first so the strip has its final height while the text types out.
    const body = s.add.text(left, 0, full, { ...TXT.body(21, ad ? INK.graphite : INK.white, '600'), lineSpacing: 2, wordWrap: { width: w / 2 - 18 - left, useAdvancedWrap: true } });
    const h = Math.max(BAR_H, body.height + 24);
    body.setY(-body.height / 2);
    const g = s.add.graphics();
    chip(g, -w / 2, -h / 2, w, h, ad ? C.amber : C.graphite, 0.94, 14, { color: ad ? C.graphite : C.seam, width: 3 });
    items.push(g);
    if (tag) items.push(tag);
    else {
      // Контроль's mask: white helmet, blue line of a smile.
      const m = s.add.graphics();
      const mx = -w / 2 + 18;
      m.fillStyle(C.white, 1).fillRoundedRect(mx, -24, 44, 48, 18);
      m.lineStyle(4, C.seam, 1).beginPath().arc(mx + 22, -2, 12, 0.35, Math.PI - 0.35).strokePath();
      m.fillStyle(C.graphite, 1).fillRect(mx + 10, -12, 9, 4).fillRect(mx + 25, -12, 9, 4);
      items.push(m);
    }
    items.push(body);
    const y = BOARD.y + BOARD.h - 16 - h / 2;
    const box = s.add.container(x, y + 20, items).setDepth(DEPTH).setAlpha(0);
    this.bar = box;
    s.tweens.add({ targets: box, y, alpha: 1, duration: 200 });
    let n = prefix.length;
    body.setText(full.slice(0, n));
    this.typer = s.time.addEvent({
      delay: 22,
      repeat: full.length - n - 1,
      callback: () => body.setText(full.slice(0, ++n)),
    });
    s.time.delayedCall(seconds * 1000 + full.length * 22, () => {
      if (this.bar !== box) return;
      this.bar = null;
      s.tweens.add({ targets: box, alpha: 0, y: y + 16, duration: 220, onComplete: () => box.destroy() });
    });
  }

  /** Comic speech bubble over a sprite on the board (board camera). */
  private bubble(text: string, x: number, y: number, seconds: number, villain: boolean): void {
    const s = this.scene;
    const body = s.add.text(0, 0, text, { ...TXT.body(20, INK.graphite, '700'), align: 'center', wordWrap: { width: 300, useAdvancedWrap: true } }).setOrigin(0.5);
    const bw = body.width + 28;
    const bh = body.height + 20;
    const g = s.add.graphics();
    const ink = villain ? C.coralInk : C.graphite;
    g.fillStyle(ink, 1).fillRoundedRect(-bw / 2 - 3, -bh / 2 - 3, bw + 6, bh + 6, 16);
    g.fillTriangle(-12, bh / 2, 12, bh / 2, 0, bh / 2 + 18);
    g.fillStyle(C.white, 1).fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 14);
    g.fillTriangle(-8, bh / 2 - 2, 8, bh / 2 - 2, 0, bh / 2 + 12);
    const box = s.add.container(x, y - bh / 2 - 20, [g, body]).setDepth(16).setScale(0.6).setAlpha(0);
    s.tweens.add({ targets: box, scale: 1, alpha: 1, duration: 160, ease: 'Back.Out' });
    s.time.delayedCall(seconds * 1000, () => s.tweens.add({ targets: box, alpha: 0, duration: 200, onComplete: () => box.destroy() }));
  }
}
