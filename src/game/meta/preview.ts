import Phaser from 'phaser';
import { allySelect } from './AllySelect';
import { shiftBrief } from './ShiftBrief';
import { pickBoon } from './BoonPick';
import { heroReturned, showResults } from './ResultsScreen';
import { emptyMeta, rollDistrict, type MetaSave } from './store';

/**
 * Sample data so the meta screens can be checked before the engine counts
 * anything: `?meta=results|lose|boon|dossier|allies|squad|unlock` over the menu.
 * Used by the preview build and by the tester; harmless in production.
 */
export function demoMeta(): MetaSave {
  const m = emptyMeta();
  m.tutorialDone = true;
  m.unlocked = ['standard', 'patch', 'current', 'frostline'];
  m.seenHeroes = ['canopy', 'lineman', 'mason', 'sweep', 'kiln', 'demon', 'hive'];
  m.allyChoice = ['patch'];
  m.stats = {
    runs_played: 23,
    runs_won: 9,
    play_seconds: 4 * 3600 + 12 * 60,
    energy_earned: 18450,
    nests_destroyed: 96,
    heroes_defeated: 31,
    caches_opened: 26,
    reactions_total: 214,
    residents_lost: 187,
    total_score: 7340,
    best_run_energy: 640,
    enemies_frozen: 200,
    reaction_conductive_chain: 18,
    buildings_built: 71,
    parts_recycled: 12,
    'hero_defeats.kiln': 13,
    'hero_defeats.demon': 4,
    'hero_defeats.current': 15,
    'hero_defeats.hive': 6,
  };
  m.records = { 'call.shift': { bestSeconds: 11 * 60 + 42, bestScore: 2840 }, 'call.intern': { bestSeconds: 9 * 60 + 5, bestScore: 1650 }, quick: { bestSeconds: 4 * 60 + 18, bestScore: 1210 } };
  return m;
}

export function metaPreview(scene: Phaser.Scene): boolean {
  const which = new URLSearchParams(location.search).get('meta');
  if (!which || scene.registry.get('metaPreviewShown')) return false;
  scene.registry.set('metaPreviewShown', true);
  return metaDemo(scene, which, demoMeta());
}

/** Opens one meta screen with sample data over `scene`; buttons just close it. */
export function metaDemo(scene: Phaser.Scene, which: string, meta: MetaSave): boolean {
  let root: Phaser.GameObjects.Container | undefined;
  const again = () => root?.destroy();
  if (which === 'dossier') {
    scene.scene.start('dossier', { meta });
    return true;
  }
  if (which === 'boon') {
    root = pickBoon(scene, [{ id: 'sharp_shovels', rare: false }, { id: 'first_aid', rare: true }, { id: 'reinforcements', rare: false, stacks: 1 }], () => undefined);
    return true;
  }
  if (which === 'allies') {
    root = allySelect(scene, meta, again, again);
    return true;
  }
  if (which === 'squad') {
    // A mid-game save: 8 heroes returned, so 4 squad slots.
    const m = {
      ...meta,
      unlocked: [...meta.unlocked, 'lineman', 'mason', 'kiln', 'hive'],
      stats: { ...meta.stats, 'sync.standard': 34, 'sync.patch': 18, 'sync.current': 6, 'sync.frostline': 52, 'sync.kiln': 2 },
    };
    root = shiftBrief(scene, m, rollDistrict(m), again, again);
    return true;
  }
  if (which === 'unlock') {
    root = heroReturned(scene, 'frostline', {});
    return true;
  }
  const win = which !== 'lose';
  root = showResults(
    scene,
    {
      outcome: win ? 'win' : 'lose',
      seconds: win ? 11 * 60 + 42 : 8 * 60 + 3,
      difficulty: 'shift',
      newRecord: win,
      lines: win
        ? [
            { key: 'results.score.energy', value: 980 },
            { key: 'results.score.nests', value: 250 },
            { key: 'results.score.heroes', value: 400 },
            { key: 'results.score.call_target', value: 300 },
            { key: 'results.score.win', value: 300 },
            { key: 'results.score.speed', value: 100 },
          ]
        : [
            { key: 'results.score.energy', value: 640 },
            { key: 'results.score.nests', value: 150 },
            { key: 'results.score.heroes', value: 200 },
          ],
      mults: [{ key: 'results.score.mult_difficulty', params: { name: 'Смена', value: '1' } }],
      total: win ? 2330 : 990,
      scoreBefore: win ? 5200 : 7340,
      progress: win
        ? [
            { heroId: 'kiln', label: 'Килн', from: 12, to: 13, need: 50 },
            { heroId: 'patch', label: 'Тайники', from: 24, to: 26, need: 30 },
            { heroId: 'canopy', label: 'Энергия за смену', from: 640, to: 980, need: 1000 },
          ]
        : [],
      closest: { heroId: 'patch', text: 'Ближе всех: Патч, тайников 26/30' },
      unlocked: win ? 'frostline' : undefined,
    },
    { again, dossier: () => (scene.scene.key === 'dossier' ? again() : scene.scene.start('dossier', { meta })), menu: again, takeNext: () => undefined },
  );
  return true;
}
