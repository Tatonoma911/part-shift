# Learning layer: field guide, teaching clips, "new mechanic" cards

Owner: the Learning thread («Обучение и справочник»). For the Programmer.
Preview: `npm run learning-artifact` → `artifact/learning.html` (or `npx vite` and open `/learning.html`).

## What it is
- **Справочник (field guide)**, rules v0.4: 9 lessons with clips (start, dig, numbers, deduction, build, residents fight, trophies, elements, emergency call) + 11 sections: numbers & scanner, resources, buildings, residents, trophies, **elements** (cycle, 5 elements, multipliers, reactions), **heroes** (call, lairs, allies + all 15 heroes with ability, stats, weak/resist, drops, ally effect, unlock), enemies (adaptants, nests, hero lair, call target's lair), city tiles, controls, world. Numbers come from `src/data/design/*.json` (incl. new `heroes.json`, `elements.json`), names from the writer's `text/ru.json`. A stat whose field the current table lacks is just hidden, so the guide works on the old v0.1 tables and fills in when you sync v0.4.
- **15 teaching clips** (`clips.ts`), drawn live on canvas from the game's own sprites (`src/assets/art`): start, dig, clue, deduce, cascade, build, order, nest, parts, elements, heroes, call, threat, caution, energy. Residents dig and fight (no defenders), damage popups show element multipliers.
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
learning.openGuide('hero.demon');  // any entry id or section id (see content.ts)

// HUD: a small «?» button next to pause → learning.openGuide()

// In the GameEvent loop (core/world events):
learning.onGameEvent(e.type);    // nest_open / heavy_nest_open / enemy_engaged → fight
                                 // part_attached → parts, reaction → elements
                                 // threat_level_up → threat
                                 // hero_lair_open / hero_spawn → hero (a hero is out)
                                 // boss_warning / boss_awake → call (old demon_warning/demon_awake still map here)
// If your v0.4 events are named differently, add them to EVENT_TOPIC in content.ts.

// Moments the world doesn't emit as events, call once when they first happen:
learning.coach('clue');   // first revealed cell with a threat number
learning.coach('finds');  // first cyan number
learning.coach('deduce'); // first time the scanner marks a safe cell
learning.coach('build');  // first time Energy ≥ 50 (enough for a Microreactor) or Build opened
learning.coach('elements'); // first time a resident carries arms of two elements (if no 'reaction' event yet)

// Settings: «Сбросить подсказки» → learning.resetProgress(); language switch → learning.setLang('en')
// Anywhere: learning.playClip(hostElement, 'dig') returns a ClipPlayer (destroy() when done)
```
`learning.isOpen` is true while the guide or a card is up: ignore board input then. Esc closes.

## Notes
- Clips follow Антон's 2026-10-09 decisions: the game starts with nothing highlighted (player taps where the Command Center goes), there is **no attack mode**: every resident digs and fights, drops work when an enemy is within 3 tiles and goes back after; a tap on an enemy or nest sends them. Residents swing their tools (`build` anim) to fight since `resident` has no `attack` row. The dock in the build clip shows only «Копать / Строить».
- New art in `src/assets/art/anim/`: the 15 hero sheets + `adaptant_toxin` and the updated `anim.json` from the animator's x2 set.

## Rules v0.7 (our heroes instead of residents)
The guide and clips now follow MVP_RULES §4 v0.7: buildings print our heroes (`ally_<id>` sheets, drawn at 0.8 scale), no Dig/Build toggle (tap open ground → build menu, tap a building → hero picker), knockout + torn limb, rally, caches give +20 and a boost. Birth tiers/costs come from `heroes.json → ourSide` and fall back to the v0.7 numbers while the repo table predates it. New lessons/clips: `birth`, `knockout`. New coach topics: `birth` (EVENT_TOPIC `build_done`: the first finished building) and `knockout` (`knockout`, `limb_torn`). The guide's object names come from `src/data/text/ru.json`; until you sync the writer's 0.17 file some of them still say «житель» (e.g. enemy descriptions, boons).

## First Shift (Tutorial.ts) for rules v0.4
`design/data/tutorial_map.json` v0.4 step 6 is `building_built:reactor` (highlight Build → reactor). `Tutorial.ts` now understands `building_built:<type>`; the repo still has the v0.1 map (`defenders_trained:2`), so nothing changes until you sync it. The matching texts are already in the writer's `/mnt/project-files/text/ru.json` (step 6 Microreactor, step 7 «Жители готовы…», step 8 «Житель победил…», final.line3). Kept the old ones in the repo copy so the current tutorial still reads right. EN for `src/i18n/en.json` when you switch:
- tutorial.step6: "Before going near a nest, stock up on Energy. Build a Microreactor: it makes Energy by itself, no worker needed."
- tutorial.step7: "Your residents are ready. Tap the red mark to open the nest. It is not a loss, it is the start of a fight: residents fight on their own."
- tutorial.step8: "The resident won and took the adaptant's arm. The more trophies, the stronger they get."
- tutorial.final.line3: "A red mark means danger. Open it when your residents are ready."
- tutorial.attack: "Tap an enemy or an open nest to send all residents there."
No coach cards during First Shift (as now).
- The overlay is a phone-width sheet (max 480 px) centered over a dimmed game, so it reads well on desktop too.
- The First Shift tutorial (`game/Tutorial.ts`) stays; at its final screen a «Справочник» button can call `learning.openGuide('lessons')`.
- Text keys: learning strings live in `src/learning/text/*.json` (prefixed `learn.` internally). The writer may move them into `text/ru.json` later; `text.ts` merges both.
