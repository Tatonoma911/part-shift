// Copies the game designer's tables and the writer's texts from the shared
// project folder into the repo. Run from the repo root: `npm run sync-data`.
// The shared folder layout is <root>/design/data, <root>/text, <root>/code (this repo).
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? '..');
const jobs = [
  { from: join(root, 'design/data'), to: 'src/data/design', pick: (f) => f.endsWith('.json') },
  { from: join(root, 'text'), to: 'src/data/text', pick: (f) => /^[a-z]{2}\.json$/.test(f) },
];
for (const { from, to, pick } of jobs) {
  if (!existsSync(from)) {
    console.warn(`skip: ${from} not found`);
    continue;
  }
  mkdirSync(to, { recursive: true });
  for (const f of readdirSync(from).filter(pick)) {
    copyFileSync(join(from, f), join(to, f));
    console.log(`${join(from, f)} -> ${join(to, f)}`);
  }
}
