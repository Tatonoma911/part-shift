// Turns the Vite build into the claude.ai Artifact: one HTML page with the game script, plus the
// art and audio files it loads (published next to the page, see artifact/files.json).
// `npm run artifact` builds with ARTIFACT=1 and calls this.
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';

const js = readdirSync('dist-artifact/assets').find((f) => f.endsWith('.js'));
// Reference the JS as an external file rather than inlining it — the inline bundle triggered
// the Artifact service's pr-review size check at ~6 MB; an external src avoids that entirely.
const html = `<title>Part Shift</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700;800&family=Unbounded:wght@700;800;900&display=swap">
<style>
  :root { --bg: #dfeef3; color-scheme: light; }
  html, body { height: 100%; margin: 0; background: var(--bg); overflow: hidden; }
  #app { width: 100%; height: 100%; touch-action: none; user-select: none; -webkit-user-select: none; }
  /* Splash until the game's loading screen is up (LoadingScene removes #boot). */
  #boot { position: fixed; inset: 0; z-index: 5; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 28px; background: linear-gradient(#eaf5f8, #c9e2ea); transition: opacity 0.4s; }
  #boot.gone { opacity: 0; pointer-events: none; }
  #boot .logo { font: 900 clamp(40px, 11vw, 72px)/1 Unbounded, "Golos Text", system-ui, sans-serif; }
  #boot b { color: #10171c; font-weight: 900; }
  #boot i { color: #007e89; font-style: normal; }
  #boot .tape { width: min(60vw, 360px); height: 16px; border: 3px solid #10171c; background: repeating-linear-gradient(120deg, #e8a33a 0 12px, #10171c 12px 24px); animation: tape 0.8s linear infinite; }
  @keyframes tape { to { background-position: 27.7px 0; } }
</style>
<div id="app"></div>
<div id="boot"><div class="logo"><b>PART</b><i>SHIFT</i></div><div class="tape"></div></div>
<script type="module" src="./files/${js}"></script>
`;
rmSync('artifact', { recursive: true, force: true });
mkdirSync('artifact/files', { recursive: true });
writeFileSync('artifact/part-shift.html', html);
// All assets including the JS bundle go into artifact/files/ next to the page.
const files = readdirSync('dist-artifact/assets');
for (const f of files) copyFileSync(`dist-artifact/assets/${f}`, `artifact/files/${f}`);
// The in-game comics shelf and artbook (src/game/library.ts) read site images from ./universe/ next to the page:
// copy only the ones site/content.ts lists between COMICS and DISTRICTS (plus the hero cards it builds by name).
const content = readFileSync('site/content.ts', 'utf8');
const lib = content.slice(content.indexOf('export const COMICS'), content.indexOf('export const DISTRICTS'));
const uni = new Set([...lib.matchAll(/['`]([\w/.-]+\.(?:webp|png))['`]/g)].map((m) => m[1]).filter((f) => !f.includes('$')));
for (const k of lib.matchAll(/\[([^\]]*)\]\.map\(\(\w+\) => \(\{\s*src: `card-/g)) for (const id of k[1].match(/[a-z0-9]+/g)) uni.add(`card-${id}.webp`);
uni.add('comics/intro-cover.webp');
for (const k of [1, 2, 3, 4]) for (const l of ['ru', 'en']) uni.add(`comics/last-donut-${k}-${l}.webp`);
for (const f of uni) {
  try {
    mkdirSync(`artifact/files/universe/${f}`.replace(/\/[^/]+$/, ''), { recursive: true });
    copyFileSync(`public/universe/${f}`, `artifact/files/universe/${f}`);
    files.push(`universe/${f}`);
  } catch {
    /* not built (yet) */
  }
}
writeFileSync('artifact/files.json', JSON.stringify(files));
console.log(`artifact/part-shift.html: ${(html.length / 1024).toFixed(0)} KB + ${files.length} files in artifact/files`);
