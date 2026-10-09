import Phaser from 'phaser';
import { account } from '../account/cloud';
import { openAccountPanel } from '../account/panel';
import { config } from '../core/data';
import type { AssistMode } from '../core/state';
import { lang, setLang, t } from '../i18n';
import { introSeen, playIntro } from '../intro';
import { analytics, askAnalyticsConsent } from '../analytics';
import { learning, learningLang } from './learn';
import { volumeHeight, volumeSliders } from './volume';
import { BUILDING_ANCHOR, createArt, preloadArt } from './assets';
import { preloadComm } from './Comm';
import { sound } from './audio';
import type { GameStart } from './GameScene';
import { C, INK, LANDSCAPE, VIEW } from './layout';
import { clearSlot, lastSlot, loadSettings, loadSlot, saveSettings, SLOTS } from './saves';
import { tutorialDone } from './Tutorial';
import { setBackHandler } from '../platform/native';
import { chip, plate, TXT } from './ui';
import { closeSocial, dailySeed, dayId, heroOfWeek, invite, openBoard, openDonate, openFeedback, readChallenge, socialOpen } from '../social';

type Ev = Phaser.Types.Input.EventData;
type Page = 'main' | 'slots' | 'settings';

/**
 * Title screen: continue, new shift into one of three slots, the tutorial,
 * settings (sound, music, language, scout hints). Story comic and accounts
 * are placeholders until their threads deliver.
 */
export class MenuScene extends Phaser.Scene {
  private page: Phaser.GameObjects.Container | null = null;
  private armed: number | null = null;
  private current: Page = 'main';
  private storyPlaying = false;

  constructor() {
    super('menu');
  }

  preload(): void {
    preloadArt(this);
    preloadComm(this);
    const bar = this.add.graphics();
    this.load.on('progress', (v: number) => {
      bar.clear();
      bar.fillStyle(C.teal, 1);
      bar.fillRect(VIEW.width * 0.2, VIEW.height / 2, VIEW.width * 0.6 * v, 10);
    });
    this.load.once('complete', () => bar.destroy());
  }

  create(): void {
    if (!this.anims.exists('resident.idle')) createArt(this);
    const unlock = () => sound.unlock();
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    this.events.once('shutdown', () => {
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
    });

    // Links for tests and sharing: ?seed=…, ?tutorial=1 go straight to the board.
    const params = new URLSearchParams(location.search);
    if (!this.registry.get('deepLinked') && (params.has('seed') || params.get('tutorial') === '1')) {
      this.registry.set('deepLinked', true);
      // Seed links (a friend's "beat my score" challenge) play in slot 0, outside the three menu slots.
      const ch = readChallenge(params);
      const start: GameStart = params.get('tutorial') === '1' ? { tutorial: true } : { slot: 0, fresh: true, seed: Number(params.get('seed')) || undefined, challenge: ch ? { score: ch.score, name: ch.name } : undefined };
      this.scene.start('game', start);
      return;
    }
    this.drawBackdrop();
    this.show('main');
    analytics.where('menu');
    analytics.track('menu_view', { tutorial_done: tutorialDone(), has_run: lastSlot() !== null });
    // Android back: skips the intro comic, sub-pages return to the main page; on the main page the app goes to the background.
    setBackHandler(() => {
      if (learning().isOpen) return true;
      if (socialOpen()) {
        closeSocial();
        return true;
      }
      if (this.storyPlaying) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        return true;
      }
      if (this.current === 'main') return false;
      this.show('main');
      return true;
    });
    // First launch: the intro comic plays over the menu (its own tap gate unlocks sound).
    if (!introSeen() && !this.registry.get('introShown')) {
      this.registry.set('introShown', true);
      this.story(false);
    } else askAnalyticsConsent();
  }

  private story(skipGate: boolean): void {
    this.input.enabled = false;
    this.storyPlaying = true;
    const startedAt = Date.now();
    analytics.where('intro', () => ({ seconds: (Date.now() - startedAt) / 1000, auto: !skipGate }));
    analytics.track('intro_start', { auto: !skipGate });
    playIntro({ skipGate })
      .then((r) => analytics.track('intro_end', { auto: !skipGate, skipped: r.skipped, seconds: (Date.now() - startedAt) / 1000 }))
      .catch(() => undefined)
      .finally(() => {
        analytics.where('menu');
        // First launch asks about statistics after the comic, not over it.
        askAnalyticsConsent();
        this.storyPlaying = false;
        if (this.scene.isActive()) this.input.enabled = true;
      });
  }

  private drawBackdrop(): void {
    // Landscape: the art sits in the left half, the menu panel on the right.
    const ax = LANDSCAPE ? (VIEW.width / 2 - 780) / 2 + 40 : 0;
    const ay = LANDSCAPE ? 60 : 0;
    const g = this.add.graphics();
    g.fillGradientStyle(0xeaf5f8, 0xeaf5f8, C.sky2, C.sky2, 1);
    g.fillRect(0, 0, VIEW.width, VIEW.height);
    g.fillStyle(0xbfd9e2, 0.6);
    let x = 0;
    let k = 0;
    while (x < VIEW.width) {
      const w = 44 + ((k * 37) % 56);
      const h = 220 + ((k * 71) % 260);
      g.fillRect(x, (LANDSCAPE ? 760 : 980) - h, w, h + 700);
      x += w + 8;
      k++;
    }
    // Logo: PART graphite, SHIFT teal (BRAND_UI "Шрифты").
    const part = this.add.text(0, 150, 'PART', TXT.num(96, INK.graphite)).setOrigin(0, 0.5);
    const shift = this.add.text(0, 150, 'SHIFT', TXT.num(96, INK.teal)).setOrigin(0, 0.5);
    part.setStyle({ fontStyle: '900' });
    shift.setStyle({ fontStyle: '900' });
    const total = part.width + shift.width;
    part.x = ax + (780 - total) / 2;
    part.y = shift.y = 150 + ay;
    shift.x = part.x + part.width;
    this.add.text(ax + 390, 236 + ay, t('game.subtitle').toUpperCase(), TXT.caps()).setOrigin(0.5);
    // The week's leader gets their name on everyone's title screen.
    void heroOfWeek().then((h) => {
      if (!h || !this.scene.isActive()) return;
      const tx = this.add.text(ax + 390, 276 + ay, `🏆 ${t('social.hero_week', { name: h.name, score: h.score.toLocaleString('ru-RU') })}`, TXT.body(22, INK.amber, '700')).setOrigin(0.5);
      if (tx.width > 740) tx.setScale(740 / tx.width);
    });

    // A slice of the city: buildings, residents at work and the Demon looming behind.
    const demon = this.add.image(ax + 560, 560 + ay, 'portrait.demon').setOrigin(0.5, 1).setScale(2.2).setAlpha(0.9);
    demon.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const row: [string, number][] = [
      ['home', 120],
      ['reactor', 230],
      ['command', 360],
      ['school', 490],
      ['cooler', 600],
    ];
    for (const [id, bx] of row) {
      const a = BUILDING_ANCHOR[id];
      this.add.image(ax + bx, 610 + ay, `building.${id}`).setOrigin(a[0] / a[2], a[1] / a[3]).setScale(1.6);
    }
    [170, 300, 430, 560].forEach((rx, i) => this.add.sprite(ax + rx, 640 + ay, i % 2 ? 'defender' : 'resident').setOrigin(0.5, 1).setScale(1.4).play(i % 2 ? 'defender.idle' : 'resident.idle'));
  }

  private show(page: Page): void {
    this.current = page;
    this.page?.destroy();
    this.armed = null;
    const c = this.add.container(0, 0);
    this.page = c;
    const top = LANDSCAPE ? 60 : 690;
    // Panel spans x0..x0+w; buttons are inset 32 inside it.
    const x0 = LANDSCAPE ? VIEW.width / 2 + 40 : 32;
    const w = LANDSCAPE ? 680 : VIEW.width - 64;
    const cx = x0 + w / 2;
    const bg = this.add.graphics();
    c.add(bg);
    let y = top + 40;
    const button = (label: string, act: (() => void) | null, primary = false, sub?: string) => {
      // Landscape is short: slimmer rows so settings fit without scrolling.
      const h = sub ? 110 : LANDSCAPE ? 76 : 92;
      const g = this.add.graphics();
      chip(g, x0 + 32, y, w - 64, h, primary ? C.teal : C.graphite, act ? (primary ? 1 : 0.08) : 0.04, 18);
      if (primary) {
        g.fillStyle(C.graphite, 0.35);
        g.fillRect(x0 + 50, y + h - 6, w - 100, 6);
      }
      const color = primary ? INK.white : act ? INK.graphite : INK.dim;
      const tx = this.add.text(cx, y + (sub ? 38 : h / 2), label, TXT.body(29, color, '700')).setOrigin(0.5);
      c.add([g, tx]);
      if (sub) c.add(this.add.text(cx, y + 78, sub, TXT.body(21, primary ? '#D9F3F8' : INK.dim, '500')).setOrigin(0.5));
      if (act) {
        const hit = this.add.zone(x0 + 32, y, w - 64, h).setOrigin(0).setInteractive({ useHandCursor: true });
        hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Ev) => {
          ev.stopPropagation();
          sound.play('ui_tap');
          act();
        });
        c.add(hit);
      }
      y += h + 16;
    };

    if (page === 'main') {
      const last = lastSlot();
      if (last) {
        const s = loadSlot(last)!;
        button(t('menu.continue'), () => this.play({ slot: last }), true, `${t('menu.slot', { n: last })} · ${this.fmt(s.time)}`);
      } else if (!tutorialDone()) button(t('menu.tutorial'), () => this.play({ tutorial: true }), true);
      button(t('menu.new_run'), () => this.show('slots'), !last && tutorialDone());
      if (last || tutorialDone()) button(t('menu.tutorial'), () => this.play({ tutorial: true }));
      button(t('menu.guide'), () => learning().openGuide());
      button(t('menu.settings'), () => this.show('settings'));
      button(t('menu.story'), () => this.story(true));
      const acc = account.view;
      const accSub = acc.status === 'disabled' ? t('menu.soon') : acc.status === 'signed' ? acc.name || acc.email : undefined;
      button(t('menu.account'), () => openAccountPanel(), false, accSub);
      this.socialRow(c, x0 + 32, y, w - 64);
      y += (LANDSCAPE ? 76 : 92) + 16;
    } else if (page === 'slots') {
      c.add(this.add.text(cx, y + 6, t('menu.slots').toUpperCase(), TXT.caps()).setOrigin(0.5));
      y += 44;
      for (const slot of SLOTS) {
        const s = loadSlot(slot);
        const sub = s ? t('menu.slot_run', { time: this.fmt(s.time), level: Math.floor(s.time / config.threat.secondsPerLevel) }) : t('menu.slot_empty');
        const rowY = y;
        button(t('menu.slot', { n: slot }), () => this.play({ slot, fresh: !s }), false, sub);
        if (s) {
          // Erase needs a second tap.
          const g = this.add.graphics();
          chip(g, x0 + w - 152, rowY + 22, 140, 66, C.coralInk, 0.12, 12);
          const tx = this.add.text(x0 + w - 82, rowY + 55, t('menu.slot_restart'), TXT.body(20, INK.coral, '700')).setOrigin(0.5);
          const hit = this.add.zone(x0 + w - 152, rowY + 22, 140, 66).setOrigin(0).setInteractive({ useHandCursor: true });
          hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Ev) => {
            ev.stopPropagation();
            sound.play('ui_tap');
            if (this.armed === slot) {
              clearSlot(slot);
              this.play({ slot, fresh: true });
            } else {
              this.armed = slot;
              tx.setText(t('menu.slot_restart_confirm')).setFontSize(15);
            }
          });
          c.add([g, tx, hit]);
        }
      }
      button(t('menu.back'), () => this.show('main'));
    } else {
      const st = loadSettings();
      c.add(this.add.text(cx, y + 6, t('settings.volume').toUpperCase(), TXT.caps()).setOrigin(0.5));
      y += 40;
      c.add(volumeSliders(this, x0 + 64, y, w - 128));
      y += volumeHeight() + 8;
      button(`${t('settings.language')}: ${t(`settings.language.${lang}`)}`, () => {
        const next = lang === 'ru' ? 'en' : 'ru';
        setLang(next);
        learningLang(next);
        saveSettings({ ...st, lang: next });
        this.scene.restart();
      });
      const modes: AssistMode[] = ['full', 'scanner', 'off'];
      button(`${t('settings.assist.title')}: ${t(`assist.mode.${st.assist}`)}`, () => {
        saveSettings({ ...st, assist: modes[(modes.indexOf(st.assist) + 1) % modes.length] });
        this.show('settings');
      });
      button(`${t('analytics.setting')}: ${t(analytics.consent === 'granted' ? 'settings.on' : 'settings.off')}`, () => {
        analytics.setConsent(analytics.consent !== 'granted');
        this.show('settings');
      });
      button(t('settings.feedback'), () => openFeedback('settings'));
      button(t('settings.reset_hints'), () => {
        learning().resetProgress();
        this.show('settings');
      });
      button(t('menu.back'), () => this.show('main'), true);
    }
    const h = y - top + 24;
    plate(bg, x0, top, w, h, 28);
    // Keep the panel on screen when it grows (settings has six rows).
    const overflow = top + h + 24 - VIEW.height;
    if (overflow > 0) c.y = -overflow;
  }

  /** Ranking · Invite · Feedback · Coffee (the coffee chip is gold: supporting the author is one tap away). */
  private socialRow(c: Phaser.GameObjects.Container, x: number, y: number, w: number): void {
    const h = LANDSCAPE ? 76 : 92;
    const items: [string, string, () => void, boolean][] = [
      ['🏆', t('social.menu.board'), () => openBoard({ playDaily: () => this.playDaily() }), false],
      ['📣', t('social.menu.invite'), () => invite('menu'), false],
      ['✉', t('social.menu.feedback'), () => openFeedback('menu'), false],
      ['☕', t('social.menu.coffee'), () => openDonate('menu'), true],
    ];
    const gap = 10;
    const bw = (w - gap * (items.length - 1)) / items.length;
    items.forEach(([icon, label, act, gold], i) => {
      const bx = x + i * (bw + gap);
      const g = this.add.graphics();
      chip(g, bx, y, bw, h, gold ? C.amber : C.graphite, gold ? 1 : 0.08, 14);
      const ic = this.add.text(bx + bw / 2, y + h * 0.34, icon, TXT.body(LANDSCAPE ? 24 : 28)).setOrigin(0.5);
      const tx = this.add.text(bx + bw / 2, y + h * 0.74, label, TXT.body(LANDSCAPE ? 17 : 19, INK.graphite, '700')).setOrigin(0.5);
      if (tx.width > bw - 10) tx.setScale((bw - 10) / tx.width);
      const hit = this.add.zone(bx, y, bw, h).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Ev) => {
        ev.stopPropagation();
        sound.play('ui_tap');
        act();
      });
      c.add([g, ic, tx, hit]);
    });
  }

  /** City of the day: one map for everybody; slot 4 keeps today's run, a new day starts fresh. */
  private playDaily(): void {
    const day = dayId();
    const seed = dailySeed(day);
    const s = loadSlot(4);
    this.play({ slot: 4, fresh: !s || s.seed !== seed, seed, daily: day });
  }

  private play(start: GameStart): void {
    this.scene.start('game', start);
  }

  private fmt(seconds: number): string {
    const s = Math.floor(seconds);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
}
