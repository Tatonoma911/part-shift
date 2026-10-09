# Learning layer: field guide, teaching clips, "new mechanic" cards

Owner: the Learning thread («Обучение и справочник»). For the Programmer.
Preview: `npm run learning-artifact` → `artifact/learning.html` (or `npx vite` and open `/learning.html`).

## What it is
- **Справочник (field guide)**: 8 lessons with clips (start, dig, numbers, deduction, build, fight, trophies, Demon) + 9 sections: numbers & scanner, resources, buildings, residents & defenders, trophies, enemies, city tiles, controls, world. 59 entries. Numbers come from `src/data/design/*.json`, names from the writer's `text/ru.json`.
- **13 teaching clips** (`clips.ts`), drawn live on canvas from the game's own sprites (`src/assets/art`): start, dig, clue, deduce, cascade, build, order, nest, parts, demon, threat, caution, energy.
- **Coach cards**: one-time card with a clip when a mechanic first shows up in a match. Stored in localStorage `partshift.learning.v1`; the player can switch them off.
- Plain DOM + Canvas 2D over the Phaser canvas. No Phaser import, no new dependencies. RU + EN (`text/ru.json`, `text/en.json`, `text/en-objects.json` for writer keys the game's en.json lacks yet).

## Hookup (GameScene / menu)
```ts
import { createLearning } from '../learning';
const learning = createLearning({
  lang,                                   // from i18n
  onPause: () => scene.pauseForOverlay(), // single player: pause while open
  onResume: () => scene.resumeFromOverlay(),
  onPlayIntro: () => playComicIntro(),    // optional: "Смотреть вступление" button in World
  online: () => isOnlineMatch,            // no coach cards online (no pause there)
});

// Main menu: «Справочник» button and «Как играть»
learning.openGuide();            // home
learning.openGuide('lessons');   // straight into the 8 lessons
learning.openGuide('enemy.demon'); // any entry id or section id (see content.ts)

// HUD: a small «?» button next to pause → learning.openGuide()

// In the GameEvent loop (core/world events):
learning.onGameEvent(e.type);    // nest_open/heavy_nest_open → fight, part_attached → parts,
                                 // threat_level_up → threat, demon_warning/demon_awake → demon

// Moments the world doesn't emit as events, call once when they first happen:
learning.coach('clue');   // first revealed cell with a threat number
learning.coach('finds');  // first cyan number
learning.coach('deduce'); // first time the scanner marks a safe cell
learning.coach('build');  // first time Energy ≥ 100 (enough for a School) or Build opened

// Settings: «Сбросить подсказки» → learning.resetProgress(); language switch → learning.setLang('en')
// Anywhere: learning.playClip(hostElement, 'dig') returns a ClipPlayer (destroy() when done)
```
`learning.isOpen` is true while the guide or a card is up: ignore board input then. Esc closes.

## Notes
- Clips follow Антон's 2026-10-09 decisions: the game starts with nothing highlighted (player taps where the Command Center goes), there is **no attack mode**: defenders fight on their own, a tap on an enemy or nest sends the squad. The dock in the build clip shows only «Копать / Строить».
- The overlay is a phone-width sheet (max 480 px) centered over a dimmed game, so it reads well on desktop too.
- The First Shift tutorial (`game/Tutorial.ts`) stays; at its final screen a «Справочник» button can call `learning.openGuide('lessons')`.
- Text keys: learning strings live in `src/learning/text/*.json` (prefixed `learn.` internally). The writer may move them into `text/ru.json` later; `text.ts` merges both.
