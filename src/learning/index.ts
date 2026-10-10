import { loadArt } from './art';
import { ClipPlayer, type ClipPlayerOptions } from './clip';
import { CLIPS, type ClipId } from './clips';
import { showCoach } from './coach';
import { COACH, EVENT_TOPIC } from './content';
import { Guide } from './guide';
import { progress } from './progress';
import { injectStyles } from './styles';
import { setLang, tr, type Lang } from './text';

/**
 * Learning layer for Part Shift: the field guide, teaching clips and one-time
 * "new mechanic" cards. Plain DOM + canvas over the Phaser canvas, no Phaser
 * dependency, so the same code runs in the game and in the preview page.
 *
 * Game hookup (see learning/HANDOFF.md):
 *   const learning = createLearning({ lang, onPause, onResume, onPlayIntro });
 *   menu button "Справочник"   -> learning.openGuide()
 *   HUD "?" button              -> learning.openGuide()
 *   each GameEvent              -> learning.onGameEvent(e.type)
 *   first clue / first build    -> learning.coach('clue') / learning.coach('build')
 */

export interface LearningOptions {
  lang?: Lang;
  host?: HTMLElement;
  /** Called when a guide or coach card opens: pause the match (single player). */
  onPause?: () => void;
  /** Called when it closes. */
  onResume?: () => void;
  /** Plays the comic intro (from the "World" section). Omit to hide the button. */
  onPlayIntro?: () => void;
  /** Online matches have no pause: coach cards are skipped there. */
  online?: () => boolean;
  /** A fight is on: cards wait for it to end (FEEL_AUDIT F-08). */
  busy?: () => boolean;
  /** At least this long between two coach cards; a card that comes sooner waits. Default 60 s. */
  gapSeconds?: number;
}

export interface Learning {
  openGuide(at?: string): void;
  /** Shows a coach card unless seen before, switched off, online, or something else is open. Returns true if shown. */
  coach(topic: keyof typeof COACH, force?: boolean): boolean;
  /** Call every frame: shows a card that waited for a quiet moment. */
  tick(): void;
  /** Feed core GameEvent types; the first nest, trophy, threat level and Demon warning open a card. */
  onGameEvent(type: string): boolean;
  /** A clip anywhere (e.g. the main menu or the tutorial card). */
  playClip(host: HTMLElement, id: ClipId, opts?: ClipPlayerOptions): ClipPlayer;
  readonly isOpen: boolean;
  setLang(lang: Lang): void;
  resetProgress(): void;
  /** Resolves when the sprites are decoded. */
  ready: Promise<void>;
}

export function createLearning(opts: LearningOptions = {}): Learning {
  injectStyles();
  setLang(opts.lang ?? 'ru');
  const ready = loadArt();
  let open = false;
  // Cards that came during a fight or too soon after the last one, oldest first.
  const waiting: (keyof typeof COACH)[] = [];
  let lastShown = -Infinity;
  const gapMs = (opts.gapSeconds ?? 60) * 1000;
  const quiet = () => !opts.busy?.() && performance.now() - lastShown >= gapMs;

  const opened = () => {
    open = true;
    opts.onPause?.();
  };
  const closed = () => {
    open = false;
    opts.onResume?.();
  };

  const api: Learning = {
    ready,
    get isOpen() {
      return open;
    },
    openGuide(at?: string) {
      if (open) return;
      opened();
      void ready.then(() => new Guide({ host: opts.host, startAt: at, onClose: closed, onPlayIntro: opts.onPlayIntro }));
    },
    coach(topic, force = false) {
      if (open || !COACH[topic]) return false;
      if (!force && (progress.coachOff || progress.coachSeen(topic) || opts.online?.())) return false;
      if (!force && !quiet()) {
        if (!waiting.includes(topic)) waiting.push(topic);
        return false;
      }
      const i = waiting.indexOf(topic);
      if (i >= 0) waiting.splice(i, 1);
      lastShown = performance.now();
      opened();
      void ready.then(() =>
        showCoach(topic, {
          host: opts.host,
          onClose: closed,
          onOpenGuide: (entry) => {
            // the coach already resumed the game; the guide pauses it again
            api.openGuide(entry);
          },
        }),
      );
      return true;
    },
    tick() {
      while (waiting.length && !open && quiet()) if (api.coach(waiting.shift()!)) break;
    },
    onGameEvent(type) {
      const topic = EVENT_TOPIC[type];
      return topic ? api.coach(topic) : false;
    },
    playClip(host, id, o) {
      return new ClipPlayer(host, CLIPS[id], o);
    },
    setLang,
    resetProgress: () => progress.reset(),
  };
  return api;
}

export { tr, CLIPS, COACH };
export type { ClipId, Lang };
