import Phaser from 'phaser';
import { allySelect } from './AllySelect';
import { shiftBrief } from './ShiftBrief';
import { pickBoon } from './BoonPick';
import { starsView } from './record';
import { heroReturned, showResults } from './ResultsScreen';
import { bestStars, difficultyIcon, draftStamp, levelChevron, MedalToasts, modeIcon, nickLine, roleIcon, syncBadge, type ModeId } from './Awards';
import { hasText, t } from '../../i18n';
import { shade } from './kit';
import { C, HUD, INK, VIEW } from '../layout';
import { plate, TXT } from '../ui';
import { emptyMeta, rollDistrict, type MetaSave } from './store';

/**
 * Sample data so the meta screens can be checked before the engine counts
 * anything: `?meta=results|lose|boon|dossier|allies|squad|unlock` over the menu.
 * Used by the preview build and by the tester; harmless in production.
 */
export function demoMeta(): MetaSave {
  const m = emptyMeta();
  m.tutorialDone = true;
  m.unlocked = ['patch', 'current', 'frostline', 'canopy'];
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
    tiles_dug: 3420,
    tiles_wave: 610,
    chords: 41,
    mines_defused: 12,
    enemies_defeated: 1260,
    super_strikes: 64,
    parts_taken: 18,
    civilians_rescued: 96,
    capsules_opened: 7,
    control_calls_answered: 11,
    daily_streak_best: 4,
    'runs_won.quick': 2,
  };
  m.medals = {
    shifts: { tier: 1, at: '2026-10-08' },
    wins: { tier: 1, at: '2026-10-08' },
    dig: { tier: 2, at: '2026-10-10' },
    no_losses: { tier: 1, at: '2026-10-09' },
    fire_tempo: { tier: 1, at: '2026-10-10' },
  };
  m.showcase = ['dig', 'no_losses'];
  m.records = { 'call.shift': { bestSeconds: 11 * 60 + 42, bestScore: 2840, bestStars: 2 }, 'call.intern': { bestSeconds: 9 * 60 + 5, bestScore: 1650, bestStars: 3 }, quick: { bestSeconds: 4 * 60 + 18, bestScore: 1210, bestStars: 1 } };
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
  if (which === 'dossier' || which === 'awards' || which === 'records') {
    scene.scene.start('dossier', { meta, tab: which === 'dossier' ? undefined : which });
    return true;
  }
  if (which === 'medal_toast') {
    // The in-run plate as the HUD shows it (GameScene drains world.s.medalEvents into it).
    const toasts = new MedalToasts(scene, HUD.x + HUD.w / 2, HUD.y + HUD.h + 6, 60);
    toasts.push('dig', 2);
    toasts.push('fast_win', 4);
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
      stats: { ...meta.stats, 'sync.patch': 18, 'sync.current': 6, 'sync.frostline': 52, 'sync.kiln': 2 },
    };
    root = shiftBrief(scene, m, rollDistrict(m), again, again);
    return true;
  }
  if (which === 'nick') {
    // Rank cup + showcase next to the nick (leaderboard, co-op lobby), plus the small badges of art 172/174.
    const W = Math.min(720, VIEW.width - 40);
    const x = (VIEW.width - W) / 2;
    root = scene.add.container(0, 0).setDepth(50);
    root.add(shade(scene, VIEW.width, VIEW.height, 0.62, again));
    const g = scene.add.graphics();
    plate(g, x, 60, W, 1040, 26);
    root.add(g);
    root.add(scene.add.text(x + 32, 92, 'МИРОВОЙ РЕЙТИНГ', TXT.caps()));
    const rows: [string, number, { id: string; tier: 0 | 1 | 2 | 3 | 4 }[], string][] = [
      ['enton', 6, [{ id: 'dig', tier: 3 }, { id: 'no_losses', tier: 4 }, { id: 'nests', tier: 3 }], '48 210'],
      ['Мария_К', 4, [{ id: 'wins', tier: 2 }, { id: 'fire_tempo', tier: 4 }], '31 900'],
      ['dome_runner', 2, [{ id: 'shifts', tier: 1 }], '8 440'],
      ['Вы', 2, [{ id: 'dig', tier: 2 }, { id: 'no_losses', tier: 4 }], '7 340'],
    ];
    rows.forEach(([nick, r, sc, pts], k) => {
      const y = 140 + k * 76;
      root!.add(scene.add.text(x + 32, y + 22, `${k + 1}`, TXT.num(24, INK.dim)).setOrigin(0, 0.5));
      root!.add(nickLine(scene, x + 70, y, { nick, rankIndex: r, showcase: sc, size: 48, maxW: W - 220, color: nick === 'Вы' ? INK.teal : INK.graphite }));
      root!.add(scene.add.text(x + W - 32, y + 24, pts, TXT.num(24, INK.graphite)).setOrigin(1, 0.5));
    });
    root.add(scene.add.text(x + 32, 470, 'ЛОББИ «ОБЩЕГО ВЫЗОВА»', TXT.caps()));
    const lobby: [string, number, 'scout' | 'support' | 'engineer'][] = [['Вы', 2, 'scout'], ['Мария_К', 4, 'engineer'], ['dome_runner', 2, 'support'], ['Ждём игрока', 0, 'scout']];
    lobby.forEach(([nick, r, role], k) => {
      const y = 510 + k * 84;
      const lg = scene.add.graphics();
      lg.fillStyle(k === 3 ? C.paper2 : C.white, 1).fillRoundedRect(x + 28, y, W - 56, 72, 12);
      root!.add(lg);
      root!.add(roleIcon(scene, x + 70, y + 36, 56, role).setAlpha(k === 3 ? 0.4 : 1));
      if (k < 3) root!.add(nickLine(scene, x + 112, y + 12, { nick, rankIndex: r, showcase: k === 1 ? [{ id: 'wins', tier: 2 }, { id: 'fire_tempo', tier: 4 }] : [{ id: 'dig', tier: 2 }], size: 48, maxW: W - 180 }));
      else root!.add(scene.add.text(x + 112, y + 36, nick, TXT.body(22, INK.dim, '600')).setOrigin(0, 0.5));
    });
    root.add(scene.add.text(x + 32, 870, 'КАРТОЧКА БЭКАПА: ЧЕРНОВОЙ · СИНХРОНИЗАЦИЯ · УРОВЕНЬ', TXT.caps()));
    root.add(draftStamp(scene, x + 140, 980, 200));
    for (let k = 0; k <= 5; k++) root.add(syncBadge(scene, x + 290 + k * 62, 950, 54, k));
    for (let k = 1; k <= 4; k++) root.add(levelChevron(scene, x + 300 + (k - 1) * 70, 1030, 60, k));
    return true;
  }
  if (which === 'modes') {
    // Mock of the mode picker: art 173 icons, best stars next to each mode, difficulty podiums.
    const W = Math.min(720, VIEW.width - 40);
    const x = (VIEW.width - W) / 2;
    root = scene.add.container(0, 0).setDepth(50);
    root.add(shade(scene, VIEW.width, VIEW.height, 0.62, again));
    const g = scene.add.graphics();
    plate(g, x, 60, W, 900, 26);
    root.add(g);
    root.add(scene.add.text(x + 32, 92, 'ВЫБОР ВЫЗОВА', TXT.caps()));
    const modes: [ModeId, string, number][] = [
      ['call', t('mode.call.name'), 2],
      ['quick', t('mode.quick.name'), 1],
      ['daily', hasText('mode.daily.name') ? t('mode.daily.name') : 'Вызов дня', 3],
      ['coop', t('mode.coop_call.name'), 0],
      ['tutorial', t('menu.tutorial'), -1],
    ];
    modes.forEach(([id, name, stars], k) => {
      const y = 130 + k * 104;
      const bg = scene.add.graphics();
      bg.fillStyle(k === 0 ? C.teal : C.white, 1).fillRoundedRect(x + 28, y, W - 56, 92, 14);
      root!.add(bg);
      root!.add(modeIcon(scene, x + 84, y + 46, 70, id));
      root!.add(scene.add.text(x + 136, y + 46, name, TXT.num(26, k === 0 ? INK.white : INK.graphite)).setOrigin(0, 0.5));
      if (stars >= 0) bestStars(scene, root!, x + W - 150, y + 46, 34, stars);
    });
    root.add(scene.add.text(x + 32, 680, t('difficulty.title').toUpperCase(), TXT.caps()));
    (['intern', 'shift', 'rush'] as const).forEach((d, k) => {
      const cw = (W - 56 - 24) / 3;
      const cx = x + 28 + k * (cw + 12);
      const bg = scene.add.graphics();
      bg.fillStyle(k === 1 ? C.graphite : C.white, 1).fillRoundedRect(cx, 716, cw, 200, 14);
      root!.add(bg);
      root!.add(difficultyIcon(scene, cx + cw / 2, 776, 96, (k + 1) as 1 | 2 | 3));
      root!.add(scene.add.text(cx + cw / 2, 846, t(`difficulty.${d}.name`), TXT.num(24, k === 1 ? INK.white : INK.graphite)).setOrigin(0.5));
      bestStars(scene, root!, cx + cw / 2 - 46, 888, 28, [3, 2, 0][k]);
    });
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
            { key: 'results.score.stars', value: 150 },
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
      medals: win ? [{ id: 'dig', tier: 2 }, { id: 'nests', tier: 1 }, { id: 'no_losses', tier: 4 }] : [],
      medalClosest: { id: 'nests', cur: 132, max: 150 },
      medalPoints: win ? 3300 : 0,
      stars: starsView(win ? { met: [true, true, false], stars: 2, bonus: 150, coop: false, limit: 720 } : { met: [false, false, true], stars: 0, bonus: 0, coop: false, limit: 720 }),
      unlocked: win ? 'frostline' : undefined,
    },
    { again, dossier: () => (scene.scene.key === 'dossier' ? again() : scene.scene.start('dossier', { meta })), menu: again, takeNext: () => undefined },
  );
  return true;
}
