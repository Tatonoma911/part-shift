// Copies the game designer's tables, the writer's texts and the artist's and
// animator's exports (cell 52 set) from the shared project folder into the repo. Run from the repo root: `npm run sync-data`.
// The shared folder layout is <root>/design/data, <root>/text, <root>/code (this repo).
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? '..');
const BUILDINGS = ['command', 'home', 'reactor', 'cooler', 'school', 'medcenter'];
const jobs = [
  { from: join(root, 'design/data'), to: 'src/data/design', pick: (f) => f.endsWith('.json') },
  { from: join(root, 'text'), to: 'src/data/text', pick: (f) => /^[a-z]{2}\.json$/.test(f) },
  { from: join(root, 'art/export/x2/tiles'), to: 'src/assets/art/tiles', pick: (f) => f.endsWith('.png') },
  // objects_gpt: GPT-drawn tile objects — replace matching tile keys (nest, cache, etc.)
  { from: join(root, 'art/export/x2/objects_gpt'), to: 'src/assets/art/tiles', pick: (f) => f.endsWith('.png') && f !== 'objects_gpt.json' },
  // batch 4 find cells (ground + drawn find, slice_gpt_b4.py): tile.find_blueprint / find_armor / find_record / cache_v2
  { from: join(root, 'art/export/x2/tiles_gpt'), to: 'src/assets/art/tiles', pick: (f) => /^(find_(blueprint|armor|record)|cache_v2)\.png$/.test(f) },
  { from: join(root, 'art/export/x2/buildings'), to: 'src/assets/art/buildings', pick: (f) => BUILDINGS.includes(f.replace('.png', '')) },
  // buildings_gpt_big normal state (larger than a cell, Антон 2026-10-10): replace the old single-state building sprites
  {
    from: join(root, 'art/export/x2/buildings_gpt_big'),
    to: 'src/assets/art/buildings',
    pick: (f) => f.endsWith('_normal.png'),
    rename: (f) => f.replace('_normal.png', '.png'),
  },
  // buildings_gpt all states + json: for future state-aware rendering
  { from: join(root, 'art/export/x2/buildings_gpt_big'), to: 'src/assets/art/buildings_gpt', pick: (f) => f.endsWith('.png') || f === 'buildings_gpt.json' },
  // nests_gpt: element-specific revealed nest sprites
  { from: join(root, 'art/export/x2/nests_gpt'), to: 'src/assets/art/nests_gpt', pick: (f) => f.endsWith('.png') || f === 'nests_gpt.json' },
  // objects_b4: mines, bonus capsules, medkits, caches, finds, build overlays (batch 04)
  { from: join(root, 'art/export/x2/objects_gpt_b4'), to: 'src/assets/art/objects_b4', pick: (f) => f.endsWith('.png') || f === 'objects_gpt_b4.json' },
  // villains_mixed: heroes with spliced limbs
  { from: join(root, 'art/export/x2/units/villains_mixed'), to: 'src/assets/art/villains_mixed', pick: (f) => f.endsWith('.png') || f === 'villains_mixed.json' },
  { from: join(root, 'art/anim/x2'), to: 'src/assets/art/anim', pick: (f) => f.endsWith('.png') || f === 'anim.json' },
  { from: join(root, 'art/export/icons'), to: 'src/assets/art/icons', pick: (f) => f.endsWith('@2x.png') },
  { from: join(root, 'audio/sfx'), to: 'src/assets/audio/sfx', pick: (f) => f.endsWith('.mp3') },
  { from: join(root, 'audio/music'), to: 'src/assets/audio/music', pick: (f) => f.endsWith('.mp3') },
  { from: join(root, 'audio'), to: 'src/assets/audio', pick: (f) => f === 'sounds.json' },
  // Intro comic (Комикс-вступление thread): component, panels and sprites; its sounds come from the game's own audio.
  { from: join(root, 'comic'), to: 'src/intro', pick: (f) => f === 'intro-comic.js' },
  // clean: the comic drops panels between versions; stale ones would only bloat the one-file build.
  { from: join(root, 'comic/assets/panels'), to: 'src/assets/comic/panels', pick: (f) => /\.(jpg|png)$/.test(f), clean: true },
  // Comic illustrations over the win/lose sheets (ART_REVIEW AR-12): screen_win.png, screen_lose.png.
  { from: join(root, 'art/export/screens'), to: 'src/assets/art/screens', pick: (f, _i, all) => f.endsWith('.jpg') || (f.endsWith('.png') && !all.includes(f.slice(0, -4) + '.jpg')) },
  { from: join(root, 'comic/assets/sprites'), to: 'src/assets/comic/sprites', pick: (f) => f.endsWith('.png'), clean: true },
  // Dossier «Что заберут жители» tiles: one drawn part per heroes.json drop.
  { from: join(root, 'art/export/trophies'), to: 'src/assets/art/trophies', pick: (f) => f.endsWith('.png') },
  { from: join(root, 'art/export/portraits'), to: 'src/assets/art/portraits', pick: (f) => f.endsWith('.png') && !f.startsWith('s01') && (!f.startsWith('bld_') || f === 'bld_command.png') },
  // Hero comm pop-up (left corner): lines RU+EN and round artbook portraits.
  { from: join(root, 'text'), to: 'src/data/text', pick: (f) => ['comm.json', 'voice.json', 'en_voice.json', 'en_meta.json'].includes(f) },
  { from: join(root, 'art/comm/game'), to: 'src/assets/comm', pick: (f) => f.endsWith('.webp') },
];
for (const { from, to, pick, clean, rename } of jobs) {
  if (!existsSync(from)) {
    console.warn(`skip: ${from} not found`);
    continue;
  }
  if (clean) rmSync(to, { recursive: true, force: true });
  mkdirSync(to, { recursive: true });
  const files = readdirSync(from);
  for (const f of files.filter((f, i, a) => pick(f, i, a))) {
    const dest = rename ? rename(f) : f;
    copyFileSync(join(from, f), join(to, dest));
    console.log(`${join(from, f)} -> ${join(to, dest)}`);
  }
}
