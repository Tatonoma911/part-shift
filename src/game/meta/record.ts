import metaJson from '../../data/design/meta.json';
import { buildings as buildingDefs } from '../../core/data';
import type { GameEvent, World } from '../../core/world';
import { t } from '../../i18n';
import { runScore } from '../../social/score';
import { tutorialDone } from '../Tutorial';
import type { ShiftStars, Tier } from './Awards';
import type { ResultsView } from './ResultsScreen';
import { applyAwards, closestMedal, evaluate, shiftStars, today, type MedalAward, type RunFacts, type StarCheck } from './medals';
import { closestHero, heroProgress, HEROES, loadMeta, saveMeta, stat, type MetaSave } from './store';

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
  // Medal counters (achievements.json newCounters).
  mine_defused: 'mines_defused',
  mine_blast: 'mines_exploded',
  // The core has no separate "super strike landed" yet: a full super charge is the strike.
  super_charged: 'super_strikes',
  building_upgraded: 'building_upgrades',
  bonus_opened: 'capsules_opened',
  // Answered or timed out: both go through answerCall, which forks the call.
  boss_call_fork: 'control_calls_answered',
  civilian_rescued: 'civilians_rescued',
  raid_siren: 'raids_called_early',
  ally_down: 'heroes_down',
};

/** Counted for this run only (special medals and stars), never added to the lifetime stats. */
const RUN_ONLY = new Set(['mines_exploded', 'raids_called_early', 'heroes_down', 'tempo_max_seconds_run']);

/** Tempo level counted as "max" for «В огне» (config tempo.levelThresholds has 4 steps: 0–3). */
const MAX_TEMPO = 3;


export class RunTally {
  private counts: Record<string, number> = {};
  private seen = new Set<string>();
  private defeats: Record<string, number> = {};
  /** Save at the start of the run: live medal checks add this run's counts to it. */
  private base: MetaSave;
  /** Medal tiers already announced during the run (toasts fire once). */
  private announced: Record<string, number> = {};
  /** Medals in the order they were earned live. */
  private order: string[] = [];
  /** Cells queued by a swipe: digging them counts as «открыто волной». */
  private waveCells = new Set<string>();
  private tempoRun = 0;
  private fullLimbs = false;
  private lastCheck = -1;
  /** Called when a medal tier is earned during the run (the scene shows a toast). */
  onMedal?: (a: MedalAward) => void;

  constructor(private me: number) {
    this.base = loadMeta();
  }

  /** A swipe queued these cells (x,y): they count as a wave when dug. 3+ cells in one swipe = one chord. */
  swipe(cells: { x: number; y: number }[]): void {
    for (const c of cells) this.waveCells.add(`${c.x},${c.y}`);
    if (cells.length >= 3) this.add('chords');
  }

  onEvent(e: GameEvent): void {
    if (e.owner !== undefined && e.owner >= 0 && e.owner !== this.me) return;
    const key = COUNT[e.type];
    if (key) this.add(key);
    switch (e.type) {
      case 'dig_done': {
        const k = `${e.x},${e.y}`;
        // A wave: the core's cascade (text 'wave') or a cell queued by a swipe.
        if (e.text === 'wave' || this.waveCells.delete(k)) this.add('tiles_wave');
        break;
      }
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

  /**
   * Called every frame with the world: times the stretch at max tempo, watches for a hero
   * with 4 trophies, and about once a second checks the medals live (lifetime + this run).
   */
  sample(w: World, dt: number): void {
    const s = w.s;
    if (s.outcome !== 'playing' || !w.started) return;
    if ((s.tempo?.level ?? 0) >= MAX_TEMPO) {
      this.tempoRun += dt;
      if (this.tempoRun > (this.counts.tempo_max_seconds_run ?? 0)) this.counts.tempo_max_seconds_run = this.tempoRun;
    } else this.tempoRun = 0;
    if (s.time - this.lastCheck < 1) return;
    this.lastCheck = s.time;
    if (!this.fullLimbs) this.fullLimbs = s.units.some((u) => u.owner === this.me && u.kind === 'ally' && u.hp > 0 && Object.values(u.parts).filter(Boolean).length >= 4);
    const awards = evaluate(this.base, this.liveCounts(w), this.facts(w, false), this.announced);
    for (const a of awards) {
      this.announced[a.id] = a.tier;
      if (!this.order.includes(a.id)) this.order.push(a.id);
      this.onMedal?.(a);
    }
  }

  /** This run's counters as lifetime stat keys (what commit() will add). */
  private liveCounts(w: World): Record<string, number> {
    const p = w.player(this.me);
    const out: Record<string, number> = { parts_taken: p.stats.parts, blueprints_found: p.stats.blueprints, lore_records_found: p.stats.loreRecords };
    for (const [k, n] of Object.entries(this.counts)) if (!RUN_ONLY.has(k)) out[k] = (out[k] ?? 0) + n;
    return out;
  }

  /** The run as the special medals and the stars see it. */
  facts(w: World, win: boolean, mode: 'call' | 'quick' = 'call'): RunFacts {
    return {
      win,
      mode,
      difficulty: w.s.difficulty ?? 'shift',
      seconds: w.s.time,
      accidentalOpens: this.counts.accidental_opens ?? 0,
      minesExploded: this.counts.mines_exploded ?? 0,
      heroesDown: this.counts.heroes_down ?? 0,
      fullLimbs: this.fullLimbs,
      tempoMaxSeconds: this.counts.tempo_max_seconds_run ?? 0,
      earlyRaids: this.counts.raids_called_early ?? 0,
    };
  }

  /** Shift stars (ACHIEVEMENTS.md §6); the scene passes them to the world board too. */
  stars(w: World, win: boolean, mode: 'call' | 'quick' = 'call', coop = false): StarCheck {
    return shiftStars(this.facts(w, win, mode), coop);
  }

  /** Folds the run into the save. Returns the results view and the heroes that came back. */
  commit(
    w: World,
    outcome: ResultsView['outcome'],
    mode: 'call' | 'quick' = 'call',
    opts: { daily?: string; coop?: boolean } = {},
  ): { view: ResultsView; unlocked: string[]; awards: MedalAward[] } {
    const m = loadMeta();
    const p = w.player(this.me);
    const win = outcome === 'win';
    const diff = w.s.difficulty ?? 'shift';
    const before = HEROES.map((h) => ({ h, ...heroProgress(m, h) }));
    const scoreBefore = stat(m, 'total_score');

    if (!this.fullLimbs) this.fullLimbs = w.s.units.some((u) => u.owner === this.me && u.kind === 'ally' && Object.values(u.parts).filter(Boolean).length >= 4);
    const facts = this.facts(w, win, mode);
    const stars = this.stars(w, win, mode, opts.coop);
    const run = { victory: win, seconds: w.s.time, nests: p.stats.nests, energy: p.stats.energy, heroes: p.stats.heroes.length, callTarget: w.s.boss.dead, difficulty: diff, mode, stars: stars.stars, civilians: p.stats.civiliansRescued ?? 0 };
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
    // The Backup archive (buildings.json backup_lab): hero unlock progress of this run counts ×1.5 if it stands at the end.
    const archive = w.s.buildings.some((b) => b.owner === this.me && b.type === 'backup_lab' && b.complete && !b.ruined);
    const unlockMul = archive ? buildingDefs.backup_lab.unlockProgressFactorThisRun ?? 1 : 1;
    for (const [k, n] of Object.entries(this.counts)) if (!RUN_ONLY.has(k)) inc(k, n * unlockMul);
    // «Вызов дня» streak: consecutive UTC days with a finished daily shift.
    if (opts.daily) {
      const d = m.daily;
      const prev = new Date(`${opts.daily}T00:00:00Z`);
      prev.setUTCDate(prev.getUTCDate() - 1);
      const yesterday = prev.toISOString().slice(0, 10);
      const streak = d?.date === opts.daily ? d.streak : d?.date === yesterday ? d.streak + 1 : 1;
      m.daily = { date: opts.daily, streak, bestScore: Math.max(d?.date === opts.daily ? d.bestScore : 0, total) };
      m.stats.daily_streak_best = Math.max(stat(m, 'daily_streak_best'), streak);
    }
    for (const [id, n] of Object.entries(this.defeats)) inc(`hero_defeats.${id}`, n * unlockMul);
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
    if (stars.stars > (rec.bestStars ?? 0)) rec.bestStars = stars.stars;

    // Medals (ACHIEVEMENTS.md §2): every tier above the save, with its rank points.
    const awards = evaluate(m, {}, facts);
    const medalPoints = applyAwards(m, awards, today());
    const earned = [...this.order.filter((id) => awards.some((a) => a.id === id)), ...awards.map((a) => a.id).filter((id) => !this.order.includes(id))];

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
    if (run.civilians) lines.push({ key: 'results.score.civilians', value: run.civilians * (S.civilianRescued ?? 0) });
    if (run.callTarget) lines.push({ key: 'results.score.call_target', value: S.callTargetDefeatedExtra });
    if (win) {
      lines.push({ key: 'results.score.win', value: S.winBonus });
      const step = S.timeBonusByMode[mode].underSeconds.find(([sec]) => w.s.time < sec);
      if (step) lines.push({ key: 'results.score.speed', value: step[1] });
      if (stars.bonus) lines.push({ key: 'results.score.stars', value: stars.bonus });
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
      // Awards.ts draws special medals as tier 4 (diamond).
      medals: earned.map((id) => {
        const a = awards.find((x) => x.id === id)!;
        return { id, tier: (a.special ? 4 : a.tier) as Tier };
      }),
      medalPoints,
      medalClosest: (() => {
        const c = closestMedal(m);
        return c && { id: c.def.id, cur: c.cur, max: c.max };
      })(),
      stars: starsView(stars),
    };
    return { view, unlocked, awards };
  }
}

/** The results screen's star block: one condition per star (§6), the time limit on the stopwatch line. */
export function starsView(st: StarCheck): ShiftStars {
  return {
    got: st.stars,
    conds: [
      { icon: 'flag', ok: st.met[0] },
      { icon: 'stopwatch', ok: st.met[1], label: st.limit ? `${t('results.stars.fast')} · ${mmss(st.limit)}` : undefined },
      { icon: st.coop ? 'team' : 'swords', ok: st.met[2] },
    ],
  };
}

/** m:ss without kit.ts, which pulls Phaser into the node tests. */
function mmss(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
}
