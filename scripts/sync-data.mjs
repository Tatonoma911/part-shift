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
  { from: join(root, 'art/export/x2/buildings'), to: 'src/assets/art/buildings', pick: (f) => BUILDINGS.includes(f.replace('.png', '')) },
  { from: join(root, 'art/anim/x2'), to: 'src/assets/art/anim', pick: (f) => f.endsWith('.png') || f === 'anim.json' },
  { from: join(root, 'art/export/icons'), to: 'src/assets/art/icons', pick: (f) => f.endsWith('@2x.png') },
  { from: join(root, 'audio/sfx'), to: 'src/assets/audio/sfx', pick: (f) => f.endsWith('.mp3') },
  { from: join(root, 'audio/music'), to: 'src/assets/audio/music', pick: (f) => f.endsWith('.mp3') },
  { from: join(root, 'audio'), to: 'src/assets/audio', pick: (f) => f === 'sounds.json' },
  // Intro comic (Комикс-вступление thread): component, panels and sprites; its sounds come from the game's own audio.
  { from: join(root, 'comic'), to: 'src/intro', pick: (f) => f === 'intro-comic.js' },
  // clean: the comic drops panels between versions; stale ones would only bloat the one-file build.
  { from: join(root, 'comic/assets/panels'), to: 'src/assets/comic/panels', pick: (f) => /\.(jpg|png)$/.test(f), clean: true },
  { from: join(root, 'comic/assets/sprites'), to: 'src/assets/comic/sprites', pick: (f) => f.endsWith('.png'), clean: true },
  { from: join(root, 'art/export/portraits'), to: 'src/assets/art/portraits', pick: (f) => f.endsWith('.png') && !f.startsWith('s01') && (!f.startsWith('bld_') || f === 'bld_command.png') },
  // Hero comm pop-up (left corner): lines RU+EN and round artbook portraits.
  { from: join(root, 'text'), to: 'src/data/text', pick: (f) => f === 'comm.json' },
  { from: join(root, 'art/comm/game'), to: 'src/assets/comm', pick: (f) => f.endsWith('.webp') },
];
for (const { from, to, pick, clean } of jobs) {
  if (!existsSync(from)) {
    console.warn(`skip: ${from} not found`);
    continue;
  }
  if (clean) rmSync(to, { recursive: true, force: true });
  mkdirSync(to, { recursive: true });
  for (const f of readdirSync(from).filter(pick)) {
    copyFileSync(join(from, f), join(to, f));
    console.log(`${join(from, f)} -> ${join(to, f)}`);
  }
}
