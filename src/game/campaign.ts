import CAMPAIGN from '../data/design/campaign.json';
import { t } from '../i18n';

export interface CampaignProgress {
  cleared: number[];
  stars: Record<number, number>;
}

const SAVE_KEY = 'partshift.meta.v1.campaign';

export function loadCampaignProgress(): CampaignProgress {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return JSON.parse(raw) as CampaignProgress;
  } catch { /* ignore */ }
  return { cleared: [], stars: {} };
}

function saveCampaignProgress(p: CampaignProgress): void {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

export function markShiftCleared(n: number, stars: number): void {
  const p = loadCampaignProgress();
  if (!p.cleared.includes(n)) p.cleared.push(n);
  p.stars[n] = Math.max(p.stars[n] ?? 0, stars);
  saveCampaignProgress(p);
}

export function getFirstUncleared(): number {
  const p = loadCampaignProgress();
  for (const sh of CAMPAIGN.shifts) {
    if (!p.cleared.includes(sh.n)) return sh.n;
  }
  return 1;
}

export const CAMPAIGN_TOTAL = CAMPAIGN.shifts.length;

export interface ShiftWorldOptions {
  width: number;
  height: number;
  difficulty: string;
  nestCount: number;
}

export function getCampaignWorld(n: number): ShiftWorldOptions {
  const shift = CAMPAIGN.shifts.find((s) => s.n === n);
  if (!shift) return { width: 9, height: 11, difficulty: 'intern', nestCount: 2 };
  const ovr = shift.overrides as Record<string, unknown>;
  const nestFromKey = ovr['mapgen.counts.nest'] as number | undefined;
  const nestFromBlock = (ovr['mapgen.counts'] as Record<string, number> | undefined)?.nest;
  const nestCount = nestFromKey ?? nestFromBlock ?? 2;
  return {
    width: shift.board[0],
    height: shift.board[1],
    difficulty: shift.difficulty,
    nestCount,
  };
}

/** Debrief after a won shift (CAMPAIGN.md §6): the writer's text for the first, a middle or the final shift. */
export function districtText(n: number): string {
  if (n === 1) return t('campaign.debrief.first');
  if (n === CAMPAIGN_TOTAL) return t('campaign.debrief.final');
  return t('campaign.debrief.mid');
}

/** The reward line for shift n from campaign.json (shifts[].reward), or '' when none. */
export function shiftReward(n: number): string {
  return CAMPAIGN.shifts.find((s) => s.n === n)?.reward ?? '';
}
