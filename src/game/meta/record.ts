import metaJson from '../../data/design/meta.json';
import type { GameEvent, World } from '../../core/world';
import { t } from '../../i18n';
import { runScore } from '../../social/score';
import { tutorialDone } from '../Tutorial';
import type { ResultsView } from './ResultsScreen';
import { closestHero, heroProgress, HEROES, loadMeta, saveMeta, stat } from './store';

/**
 * Write side of the meta progress (design/META.md §1, meta.json lifetimeStats):
 * counts this run's events, then at the end folds them into `partshift.meta.v1`,
 * returns heroes whose unlock condition is now met and builds the "Итоги смены" view.
 * Losses and quits count too, so progress always moves.
 */
const S = metaJson.runScore;

/** Engine events → lifetime counters (one per event of this player). */
const COUNT: Record<string, string> = {
  dig_done: 'tiles_dug',
  cache_open: 'caches_opened',
  nest_destroyed: 'nests_destroyed',
  enemy_die: 'enemies_defeated',
  frozen: 'enemies_frozen',
  build_done: 'buildings_built',
  part_recycled: 'parts_recycled',
  resident_die: 'residents_lost',
};

export class RunTally {
  private counts: Record<string, number> = {};
  private seen = new Set<string>();
  private defeats: Record<string, number> = {};

  constructor(private me: number) {}

  onEvent(e: GameEvent): void {
    if (e.owner !== undefined && e.owner >= 0 && e.owner !== this.me) return;
    const key = COUNT[e.type];
    if (key) this.add(key);
    switch (e.type) {
      case 'nest_open':
      case 'heavy_nest_open':
        // amount 1 = dug after the «Да, вскрыть» confirm; only the others break the clean-run challenge.
        if (!e.amount) this.add('accidental_opens');
        break;
      case 'reaction':
        this.add('reactions_total');
        if (e.text) this.add(`reaction_${e.text}`);
        break;
      case 'hero_spawn':
      case 'boss_awake':
        if (e.text) this.seen.add(e.text);
        break;
      case 'hero_defeated':
        this.add('heroes_defeated');
        if (e.text) this.defeats[e.text] = (this.defeats[e.text] ?? 0) + 1;
        break;
    }
  }

  private add(key: string, n = 1): void {
    this.counts[key] = (this.counts[key] ?? 0) + n;
  }

  /** Folds the run into the save. Returns the results view and the heroes that came back. */
  commit(w: World, outcome: ResultsView['outcome'], mode: 'call' | 'quick' = 'call'): { view: ResultsView; unlocked: string[] } {
    const m = loadMeta();
    const p = w.player(this.me);
    const win = outcome === 'win';
    const diff = w.s.difficulty ?? 'shift';
    const before = HEROES.map((h) => ({ h, ...heroProgress(m, h) }));
    const scoreBefore = stat(m, 'total_score');

    const run = { victory: win, seconds: w.s.time, nests: p.stats.nests, energy: p.stats.energy, heroes: p.stats.heroes.length, callTarget: w.s.boss.dead, difficulty: diff, mode };
    const total = runScore(run);
    const inc = (k: string, n: number) => {
      if (n) m.stats[k] = stat(m, k) + Math.floor(n);
    };
    inc('runs_played', 1);
    if (win) {
      inc('runs_won', 1);
      inc(`runs_won.${mode === 'quick' ? 'quick' : diff}`, 1);
    }
    inc('play_seconds', w.s.time);
    inc('total_score', total);
    inc('energy_earned', p.stats.energy);
    inc('parts_taken', p.stats.parts);
    inc('blueprints_found', p.stats.blueprints);
    inc('lore_records_found', p.stats.loreRecords);
    // Blueprint fragments persist across runs (meta.json §5.1).
    if (p.stats.blueprints > 0) {
      m.blueprintFragments ??= {};
      m.blueprintFragments['total'] = (m.blueprintFragments['total'] ?? 0) + p.stats.blueprints;
    }
    if (p.stats.loreRecords > 0) {
      m.loreRecords ??= [];
      // Record a count-based key per run since records don't have unique ids yet.
      const key = `run_${stat(m, 'runs_played')}`;
      if (!m.loreRecords.includes(key)) m.loreRecords.push(key);
    }
    for (const [k, n] of Object.entries(this.counts)) inc(k, n);
    for (const [id, n] of Object.entries(this.defeats)) inc(`hero_defeats.${id}`, n);
    m.stats.best_run_energy = Math.max(stat(m, 'best_run_energy'), Math.floor(p.stats.energy));
    for (const id of this.seen) {
      m.stats[`hero_seen.${id}`] = 1;
      if (!m.seenHeroes.includes(id)) m.seenHeroes.push(id);
    }
    // Run challenges (meta.json runChallenges).
    const lost = this.counts.residents_lost ?? 0;
    if (win && !this.counts.accidental_opens) m.stats['challenge.win_without_accidental_open'] = 1;
    if (win && lost === 0) m.stats['challenge.win_no_resident_lost'] = 1;
    if (w.s.units.some((u) => u.owner === this.me && u.kind === 'resident' && Object.values(u.parts).filter(Boolean).length >= 6)) m.stats['challenge.resident_full_slots'] = 1;
    m.tutorialDone ||= tutorialDone();

    // Records per difficulty / mode.
    const recKey = mode === 'quick' ? 'quick' : `call.${diff}`;
    const rec = (m.records[recKey] ??= {});
    let newRecord = false;
    if (win && (rec.bestSeconds === undefined || w.s.time < rec.bestSeconds)) [rec.bestSeconds, newRecord] = [Math.floor(w.s.time), true];
    // The badge only celebrates a win; a loss still keeps its best score quietly (QA-042).
    if (rec.bestScore === undefined || total > rec.bestScore) [rec.bestScore, newRecord] = [total, newRecord || (win && total > 0)];
    rec.bestEnergy = Math.max(rec.bestEnergy ?? 0, Math.floor(p.stats.energy));

    // Heroes whose condition is now met come back; "unlock_all" may follow from the others.
    const unlocked: string[] = [];
    for (let pass = 0; pass < 2; pass++)
      for (const h of HEROES) {
        if (m.unlocked.includes(h.id)) continue;
        const pr = heroProgress(m, h);
        if (pr.have >= pr.need) {
          m.unlocked.push(h.id);
          unlocked.push(h.id);
        }
      }
    saveMeta(m);

    const name = (id: string) => t(`enemy.${id}.name`);
    const progress = before
      .filter((b) => !unlocked.includes(b.h.id) && !m.unlocked.includes(b.h.id))
      .map((b) => ({ b, now: heroProgress(m, b.h) }))
      .filter(({ b, now }) => now.have > b.have)
      .sort((a, b) => b.now.frac - a.now.frac)
      .slice(0, 3)
      .map(({ b, now }) => ({ heroId: b.h.id, label: name(b.h.id), from: b.have, to: now.have, need: now.need }));
    const near = closestHero(m);

    const lines: ResultsView['lines'] = [
      { key: 'results.score.energy', value: Math.floor(p.stats.energy) * S.energyEarned },
      { key: 'results.score.nests', value: p.stats.nests * S.nestDestroyed },
      { key: 'results.score.heroes', value: p.stats.heroes.length * S.heroDefeated },
    ];
    if (run.callTarget) lines.push({ key: 'results.score.call_target', value: S.callTargetDefeatedExtra });
    if (win) {
      lines.push({ key: 'results.score.win', value: S.winBonus });
      const step = S.timeBonusByMode[mode].underSeconds.find(([sec]) => w.s.time < sec);
      if (step) lines.push({ key: 'results.score.speed', value: step[1] });
    }
    const dm = (S.multiplierByDifficulty as Record<string, number>)[diff] ?? 1;
    const mm = (S.multiplierByMode as Record<string, number>)[mode] ?? 1;
    const mults: ResultsView['mults'] = [];
    if (dm !== 1) mults.push({ key: 'results.score.mult_difficulty', params: { name: t(`difficulty.${diff}.name`), value: dm } });
    if (mm !== 1) mults.push({ key: 'results.score.mult_mode', params: { mode: t(`mode.${mode}.name`), value: mm } });

    const view: ResultsView = {
      outcome,
      seconds: w.s.time,
      difficulty: diff,
      newRecord,
      lines: lines.filter((l) => l.value > 0),
      mults,
      total,
      scoreBefore,
      progress,
      closest: near && !progress.length ? { heroId: near.hero.id, text: t('results.progress.closest', { name: name(near.hero.id), progress: `${near.have}/${near.need}` }) } : undefined,
      unlocked: unlocked[0],
    };
    return { view, unlocked };
  }
}
