import Phaser from 'phaser';
import { account } from '../account/cloud';
import { openAccountPanel } from '../account/panel';
import { config } from '../core/data';
import type { AssistMode } from '../core/state';
import { hasText, lang, setLang, t } from '../i18n';
import { introSeen, playIntro } from '../intro';
import { analytics, askAnalyticsConsent, closeConsent } from '../analytics';
import { canVibrate, comfort, PALETTES, setComfort, TEXT_SCALES } from './comfort';
import { learning, learningLang } from './learn';
import { volumeHeight, volumeSliders } from './volume';
import { BUILDING_ANCHOR, createArt, preloadArt } from './assets';
import { preloadComm } from './Comm';
import { sound } from './audio';
import type { GameStart } from './GameScene';
import { C, INK, LANDSCAPE, VIEW } from './layout';
import { menuIcon, type MenuIconId } from './menuIcons';
import { preloadMetaArt } from './meta/art';
import { loadMeta, pickAllies } from './meta/store';
import { allySelect } from './meta/AllySelect';
import { metaPreview } from './meta/preview';
import { clearSlot, lastSlot, loadSettings, loadSlot, saveSettings, SLOTS } from './saves';
import { tutorialDone } from './Tutorial';
import { setBackHandler } from '../platform/native';
import { chip, plate, TXT } from './ui';
import { closeSocial, dailySeed, dayId, heroOfWeek, invite, openBoard, openDonate, openFeedback, readChallenge, socialOpen } from '../social';

type Ev = Phaser.Types.Input.EventData;
type Page = 'main' | 'slots' | 'settings' | 'comfort';

/** HeroOut heroes, all of them infected villains now (lore/VILLAINS.md); the menu shows three at random. */
const MENU_HEROES = ['kiln', 'lineman', 'frostline', 'seraph', 'current', 'mason', 'beacon', 'canopy', 'sweep', 'patch', 'hive', 'n73', 'doctor', 'demon'];

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
  /** The ally picker before a new shift, while it is open. */
  private allyUi: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('menu');
  }

  preload(): void {
    preloadArt(this);
    preloadMetaArt(this);
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
    this.allyUi = null;
    if (!this.anims.exists('resident.idle')) createArt(this);

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
    metaPreview(this);
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
    } else {
      // Statistics are asked about once a shift has been played, not over the first menu (AR-09),
      // and only in a calm main menu: never over the ally choice or carried into the shift (QA-043).
      if (loadMeta().stats.runs_played) {
        this.time.delayedCall(1200, () => {
          if (this.sys.isActive() && this.current === 'main' && !this.allyUi) askAnalyticsConsent();
        });
      }
      this.events.once('shutdown', closeConsent);
      sound.playMusic('menu');
    }
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
        this.storyPlaying = false;
        if (this.scene.isActive()) {
          this.input.enabled = true;
          sound.playMusic('menu');
        }
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
      const tx = this.add.text(ax + 390, 276 + ay, `${t('social.hero_week', { name: h.name, score: h.score.toLocaleString('ru-RU') })}`, TXT.body(22, INK.amber, '700')).setOrigin(0.5);
      if (tx.width > 740) tx.setScale(740 / tx.width);
    });

    // A slice of the city: three infected heroes on call behind it (a fresh three each launch), buildings, residents at work.
    this.drawHeroes(ax, ay);
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

  /** Three random heroes behind the city: coral glow, name tag, tap for one of their lines (Антон 2026-10-09). */
  private drawHeroes(ax: number, ay: number): void {
    if (!this.textures.exists('menu.glow')) {
      const tex = this.textures.createCanvas('menu.glow', 128, 128)!;
      const c = tex.getContext();
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(239,92,115,0.55)');
      g.addColorStop(0.55, 'rgba(138,77,255,0.18)');
      g.addColorStop(1, 'rgba(138,77,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
      tex.refresh();
    }
    const pool = MENU_HEROES.filter((id) => this.textures.exists(`portrait.${id}`));
    const pick = Phaser.Utils.Array.Shuffle([...pool]).slice(0, 3);
    // Side heroes stand a little further back; the middle one is drawn last, in front.
    const slots = [
      { x: 140, foot: 572, scale: 2.1 },
      { x: 640, foot: 572, scale: 2.1 },
      { x: 390, foot: 590, scale: 2.5 },
    ];
    let bubble: Phaser.GameObjects.Container | null = null;
    pick.forEach((id, i) => {
      const s = slots[i];
      const x = ax + s.x;
      const foot = s.foot + ay;
      const glow = this.add.image(x, foot, 'menu.glow');
      const hero = this.add.image(x, foot, `portrait.${id}`).setOrigin(0.5, 1).setScale(s.scale);
      hero.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      const top = foot - hero.displayHeight;
      glow.setPosition(x, foot - hero.displayHeight * 0.45).setScale(hero.displayHeight / 90);
      this.tweens.add({ targets: hero, y: foot - 5, duration: 1500 + i * 230, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 400 });

      // Name tag: graphite chip with the hero's name and a coral "on call" line.
      const name = (hasText(`enemy.${id}.name`) ? t(`enemy.${id}.name`) : id).toUpperCase();
      const tagT = this.add.text(0, 0, name, TXT.num(18, INK.white)).setOrigin(0.5, 0.5);
      const callT = this.add.text(0, 0, t('menu.on_call').toUpperCase(), { ...TXT.caps(INK.coral), fontSize: '12px' }).setOrigin(0.5, 0.5);
      if (tagT.width > 200) tagT.setScale(200 / tagT.width);
      const w = Math.max(tagT.displayWidth, callT.width) + 36;
      const tg = this.add.graphics();
      chip(tg, -w / 2, -26, w, 52, C.graphite, 0.92, 12);
      tg.fillStyle(C.coral, 1);
      tg.fillCircle(-w / 2 + 14, 12, 4);
      tagT.setPosition(0, -9);
      callT.setPosition(6, 13);
      // Long names (СЕМЬДЕСЯТ ТРЕТИЙ) stay inside the screen (AR-07).
      const tx = Phaser.Math.Clamp(x, ax + w / 2 + 12, ax + 780 - w / 2 - 12);
      this.add.container(tx, 284 + ay, [tg, tagT, callT]);

      // Easter egg: tap a hero to hear one of their lines.
      hero.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        const lines = [1, 2, 3, 4, 5].map((n) => `hero.line.${id}.${n}`).filter((k) => hasText(k));
        if (!lines.length) return;
        bubble?.destroy();
        const txt = this.add.text(0, 0, t(Phaser.Utils.Array.GetRandom(lines)), { ...TXT.body(20, INK.graphite, '600'), wordWrap: { width: 300 }, align: 'center' }).setOrigin(0.5);
        const bw = txt.width + 36;
        const bh = txt.height + 26;
        const bg = this.add.graphics();
        plate(bg, -bw / 2, -bh / 2, bw, bh, 12);
        bg.fillStyle(C.paper, 1);
        bg.fillTriangle(-10, bh / 2 - 2, 10, bh / 2 - 2, 0, bh / 2 + 14);
        const by = Math.max(top + 40, 360 + ay);
        const bx = Phaser.Math.Clamp(x, ax + bw / 2 + 12, ax + 780 - bw / 2 - 12);
        const box = this.add.container(bx, by, [bg, txt]).setDepth(5).setScale(0.6).setAlpha(0);
        bubble = box;
        this.tweens.add({ targets: box, scale: 1, alpha: 1, duration: 180, ease: 'Back.easeOut' });
        this.tweens.add({ targets: box, alpha: 0, delay: 2800, duration: 300, onComplete: () => box.destroy() });
        this.tweens.add({ targets: hero, scaleY: s.scale * 1.06, duration: 110, yoyo: true });
        sound.play('ui_tap');
      });
    });
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
      // A label never touches the button edges (ART_REVIEW AR-10): shrink it to fit, larger text sizes included.
      const room = w - 64 - 56;
      if (tx.width > room) tx.setScale(room / tx.width);
      c.add([g, tx]);
      if (sub) {
        const st = this.add.text(cx, y + 78, sub, TXT.body(21, primary ? '#D9F3F8' : INK.dim, '500')).setOrigin(0.5);
        if (st.width > room) st.setScale(room / st.width);
        c.add(st);
      }
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
      // Meta progress: returned heroes, stats, records, rank (design/META.md §6).
      button(t('dossier.title'), () => this.scene.start('dossier'));
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
    } else if (page === 'comfort') {
      // «Удобство» (UI_SPEC §4.7): each row cycles its value on tap.
      const cf = comfort();
      const onOff = (v: boolean) => t(v ? 'comfort.on' : 'comfort.off');
      c.add(this.add.text(cx, y + 6, t('settings.comfort').toUpperCase(), TXT.caps()).setOrigin(0.5));
      y += 40;
      button(`${t('comfort.palette')}: ${t(`comfort.palette.${cf.palette}`)}`, () => {
        setComfort({ palette: PALETTES[(PALETTES.indexOf(cf.palette) + 1) % PALETTES.length] });
        this.show('comfort');
      }, false, t(`comfort.palette.${cf.palette}.hint`));
      // Swatch: what "safe" and "danger" look like in this palette.
      const sw = this.add.graphics();
      const sy = y - 16 - 110 + 78;
      sw.fillStyle(C.green, 1);
      sw.fillCircle(x0 + 80, sy, 10);
      sw.fillStyle(C.coral, 1);
      sw.fillTriangle(x0 + w - 92, sy + 9, x0 + w - 68, sy + 9, x0 + w - 80, sy - 11);
      c.add(sw);
      button(`${t('comfort.calm')}: ${onOff(cf.calm)}`, () => {
        setComfort({ calm: !cf.calm });
        this.show('comfort');
      }, false, t('comfort.calm.hint'));
      button(`${t('comfort.shake')}: ${onOff(cf.shake)}`, () => {
        setComfort({ shake: !cf.shake });
        this.show('comfort');
      });
      button(`${t('comfort.text')}: ${Math.round(cf.textScale * 100)}%`, () => {
        const i = TEXT_SCALES.indexOf(cf.textScale);
        setComfort({ textScale: TEXT_SCALES[(i + 1) % TEXT_SCALES.length] });
        this.show('comfort');
      });
      button(
        `${t('comfort.vibrate')}: ${canVibrate() ? onOff(cf.vibrate) : t('comfort.vibrate.none')}`,
        canVibrate()
          ? () => {
              setComfort({ vibrate: !cf.vibrate });
              if (!cf.vibrate) navigator.vibrate?.(40);
              this.show('comfort');
            }
          : null,
      );
      button(t('menu.back'), () => this.show('settings'), true);
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
      // Short name on the button, the current mode in the sub-line (AR-10: the long label did not fit).
      button(
        t('settings.assist'),
        () => {
          saveSettings({ ...st, assist: modes[(modes.indexOf(st.assist) + 1) % modes.length] });
          this.show('settings');
        },
        false,
        t(`assist.mode.${st.assist}.short`),
      );
      button(t('settings.comfort'), () => this.show('comfort'));
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
    // Brand icons, not system emoji (AR-21): emoji look different on every phone.
    const items: [MenuIconId, string, () => void, boolean][] = [
      ['leaderboard', t('social.menu.board'), () => openBoard({ playDaily: () => this.playDaily() }), false],
      ['invite', t('social.menu.invite'), () => invite('menu'), false],
      ['feedback', t('social.menu.feedback'), () => openFeedback('menu'), false],
      ['coffee', t('social.menu.coffee'), () => openDonate('menu'), true],
    ];
    const gap = 10;
    const bw = (w - gap * (items.length - 1)) / items.length;
    items.forEach(([icon, label, act, gold], i) => {
      const bx = x + i * (bw + gap);
      const g = this.add.graphics();
      chip(g, bx, y, bw, h, gold ? C.amber : C.graphite, gold ? 1 : 0.08, 14);
      const ic = menuIcon(this, bx + bw / 2, y + h * 0.34, LANDSCAPE ? 32 : 40, icon);
      const tx = this.add.text(bx + bw / 2, y + h * 0.74, label, TXT.body(LANDSCAPE ? 17 : 19, INK.graphite, '700')).setOrigin(0.5);
      if (tx.width > bw - 10) tx.setScale((bw - 10) / tx.width);
      const hit = this.add.zone(bx, y, bw, h).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Ev) => {
        ev.stopPropagation();
        sound.play('ui_tap');
        act();
      });
      c.add([g, ...ic, tx, hit]);
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
    closeConsent();
    // A new shift with heroes back on the team: pick who comes along first (META.md, allySelection).
    const meta = loadMeta();
    if (start.fresh && !start.tutorial && meta.unlocked.length && !this.allyUi) {
      this.allyUi = allySelect(
        this,
        meta,
        (ids) => {
          pickAllies(meta, ids);
          this.allyUi = null;
          this.scene.start('game', { ...start, allies: ids });
        },
        () => {
          this.allyUi?.destroy();
          this.allyUi = null;
        },
      );
      return;
    }
    this.scene.start('game', start);
  }

  private fmt(seconds: number): string {
    const s = Math.floor(seconds);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
}
