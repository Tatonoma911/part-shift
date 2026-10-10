/**
 * Cinematic comic reader for the universe site.
 * Shows full-page comic images with Ken Burns effect, crossfade transitions, and background music.
 * Opens as a fullscreen overlay; tap/click or auto-advance after HOLD_MS.
 */
import type { Lang } from './content';

const HOLD_MS = 7000;    // how long to linger on each page before auto-advancing
const FADE_MS = 500;     // crossfade duration

// Ken Burns presets: [fromScale, toScale, xSign, ySign]
// Sign controls pan direction (0 = centred)
const KB: [number, number, number, number][] = [
  [1.0, 1.06,  1,  0],
  [1.06, 1.0, -1,  0],
  [1.0, 1.07,  0,  1],
  [1.07, 1.0,  0, -1],
  [1.0, 1.05,  1,  1],
  [1.06, 1.0, -1, -1],
];

const LORE_MUSIC_GLOB = import.meta.glob(
  '../src/assets/audio/music/lore.mp3',
  { eager: true, query: '?url', import: 'default' }
) as Record<string, string>;
const PAGE_TURN_GLOB = import.meta.glob(
  '../src/assets/audio/sfx/ui_tap.mp3',
  { eager: true, query: '?url', import: 'default' }
) as Record<string, string>;

const loreUrl  = Object.values(LORE_MUSIC_GLOB)[0]  ?? '';
const tapUrl   = Object.values(PAGE_TURN_GLOB)[0]   ?? '';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

/** Play all pages of a comic as a cinematic fullscreen experience. */
export function playComic(urls: string[], title: string, lang: Lang): void {
  if (!urls.length) return;

  // ── overlay ──────────────────────────────────────────────────────────
  const overlay = el('div', 'cpr-overlay');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', title);

  const canvas = el('div', 'cpr-canvas');
  overlay.appendChild(canvas);

  // progress bar
  const progressWrap = el('div', 'cpr-progress');
  const progressBar  = el('div', 'cpr-progress-bar');
  progressWrap.appendChild(progressBar);
  overlay.appendChild(progressWrap);

  // page counter
  const counter = el('div', 'cpr-counter');
  overlay.appendChild(counter);

  // close button
  const closeBtn = el('button', 'cpr-close');
  closeBtn.textContent = '✕';
  closeBtn.title = lang === 'ru' ? 'Закрыть' : 'Close';
  overlay.appendChild(closeBtn);

  // nav hint
  const hint = el('div', 'cpr-hint');
  hint.textContent = lang === 'ru' ? 'Нажми, чтобы перелистнуть' : 'Tap to turn page';
  overlay.appendChild(hint);

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  // ── audio ─────────────────────────────────────────────────────────────
  let music: HTMLAudioElement | null = null;
  let tapSfx: HTMLAudioElement | null = null;
  let userInteracted = false;

  function startAudio(): void {
    if (!userInteracted) return;
    if (!music && loreUrl) {
      music = new Audio(loreUrl);
      music.loop = true;
      music.volume = 0.35;
      music.play().catch(() => {});
    }
    if (!tapSfx && tapUrl) {
      tapSfx = new Audio(tapUrl);
      tapSfx.volume = 0.5;
    }
  }

  function playTap(): void {
    if (!tapSfx) return;
    tapSfx.currentTime = 0;
    tapSfx.play().catch(() => {});
  }

  function stopAudio(): void {
    if (music) { music.pause(); music = null; }
  }

  // ── page management ───────────────────────────────────────────────────
  let page = 0;
  let autoTimer: ReturnType<typeof setTimeout> | null = null;
  let progressTimer: ReturnType<typeof requestAnimationFrame> | null = null;
  let progressStart = 0;
  let closed = false;

  function close(): void {
    if (closed) return;
    closed = true;
    stopAudio();
    if (autoTimer) clearTimeout(autoTimer);
    if (progressTimer) cancelAnimationFrame(progressTimer);
    overlay.classList.add('cpr-out');
    setTimeout(() => {
      overlay.remove();
      document.body.style.overflow = '';
    }, FADE_MS);
  }

  function tickProgress(): void {
    if (closed) return;
    const elapsed = Date.now() - progressStart;
    const pct = Math.min(elapsed / HOLD_MS, 1);
    progressBar.style.transform = `scaleX(${pct})`;
    if (pct < 1) progressTimer = requestAnimationFrame(tickProgress);
  }

  function showPage(idx: number): void {
    if (closed) return;
    page = idx;
    if (autoTimer) clearTimeout(autoTimer);
    if (progressTimer) cancelAnimationFrame(progressTimer);

    // counter
    counter.textContent = `${idx + 1} / ${urls.length}`;

    // KB preset cycling
    const [fromS, toS, dx, dy] = KB[idx % KB.length];

    // create new image element
    const img = el('div', 'cpr-page');
    img.style.backgroundImage = `url(${urls[idx]})`;
    // start state
    img.style.transform = `scale(${fromS}) translate(${dx * 1.5}%, ${dy * 1.5}%)`;
    canvas.appendChild(img);

    // fade out old page(s)
    const old = canvas.querySelectorAll<HTMLElement>('.cpr-page:not(:last-child)');
    old.forEach((o) => {
      o.style.opacity = '0';
      setTimeout(() => o.remove(), FADE_MS);
    });

    // kick off Ken Burns
    requestAnimationFrame(() => {
      img.style.transition = `transform ${HOLD_MS + FADE_MS}ms linear, opacity ${FADE_MS}ms`;
      img.style.transform = `scale(${toS}) translate(${dx * -1.5}%, ${dy * -1.5}%)`;
      img.style.opacity = '1';
    });

    // progress bar
    progressStart = Date.now();
    progressBar.style.transition = 'none';
    progressBar.style.transform = 'scaleX(0)';
    requestAnimationFrame(() => tickProgress());

    // hint: hide after first interaction
    if (idx > 0) hint.style.opacity = '0';

    autoTimer = setTimeout(() => advance(), HOLD_MS);
  }

  function advance(): void {
    userInteracted = true;
    startAudio();
    playTap();
    if (page + 1 >= urls.length) {
      close();
    } else {
      showPage(page + 1);
    }
  }

  overlay.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.cpr-close')) {
      close();
      return;
    }
    userInteracted = true;
    startAudio();
    advance();
  });

  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'q') close();
    if (e.key === 'ArrowRight' || e.key === ' ') advance();
  });

  closeBtn.addEventListener('click', close);

  // show first page
  showPage(0);
  overlay.focus();
}

// ── styles ─────────────────────────────────────────────────────────────────
const style = document.createElement('style');
style.textContent = `
.cpr-overlay {
  position: fixed; inset: 0; z-index: 9000;
  background: #000;
  display: flex; flex-direction: column;
  cursor: pointer;
  animation: cpr-in ${FADE_MS}ms ease forwards;
}
.cpr-overlay.cpr-out { animation: cpr-out ${FADE_MS}ms ease forwards; }
@keyframes cpr-in  { from { opacity: 0 } to { opacity: 1 } }
@keyframes cpr-out { from { opacity: 1 } to { opacity: 0 } }

.cpr-canvas {
  position: absolute; inset: 0;
  overflow: hidden;
}
.cpr-page {
  position: absolute; inset: -8%;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  opacity: 0;
  will-change: transform, opacity;
}

.cpr-progress {
  position: absolute; bottom: 0; left: 0; right: 0;
  height: 3px; background: rgba(255,255,255,.15);
  z-index: 2;
}
.cpr-progress-bar {
  height: 100%; background: rgba(255,255,255,.7);
  transform-origin: left;
  transform: scaleX(0);
}

.cpr-counter {
  position: absolute; top: 18px; right: 58px;
  font: 600 13px/1 system-ui, sans-serif;
  letter-spacing: .06em;
  color: rgba(255,255,255,.65);
  z-index: 3;
  text-shadow: 0 1px 4px #000;
}

.cpr-close {
  position: absolute; top: 10px; right: 14px;
  width: 36px; height: 36px;
  border: none; border-radius: 50%;
  background: rgba(255,255,255,.12);
  color: #fff; font-size: 16px; line-height: 1;
  cursor: pointer; z-index: 4;
  transition: background .15s;
}
.cpr-close:hover { background: rgba(255,255,255,.25); }

.cpr-hint {
  position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%);
  font: 12px/1 system-ui, sans-serif; letter-spacing: .08em;
  color: rgba(255,255,255,.4);
  text-transform: uppercase; z-index: 3;
  transition: opacity .4s;
  pointer-events: none;
  white-space: nowrap;
}
`;
document.head.appendChild(style);
