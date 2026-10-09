/**
 * Hand-made levels from the design tables. For now: the "First Shift" tutorial
 * (design/data/tutorial_map.json, design/ONBOARDING.md §2).
 */
import tutorialJson from '../data/design/tutorial_map.json';
import type { Tech } from './data';
import type { CellContent, RuleOverrides } from './state';
import { World } from './world';

export const tutorial = tutorialJson;

export interface TutorialStep {
  id: number;
  text: string;
  until: string;
  highlight?: number[][];
  highlightBuild?: string[];
  focus?: string;
  autoAdvanceSeconds?: number;
  /** The step stays at least this long, even if its condition is already met. */
  minSeconds?: number;
}

export function createTutorialWorld(seed = 1): World {
  const t = tutorialJson;
  const o = t.overrides as Record<string, unknown>;
  const config: Record<string, number | boolean> = {};
  for (const [k, v] of Object.entries(o)) {
    if (k.startsWith('config.') && (typeof v === 'number' || typeof v === 'boolean')) config[k.slice('config.'.length)] = v;
    if (k === 'defenders.trainSeconds' && typeof v === 'number') config[k] = v;
  }
  const rules: RuleOverrides = {
    config,
    threatEnabled: o['config.threat.enabled'] !== false,
    demonEnabled: o['config.demon.enabled'] !== false,
    commandInvulnerable: o.commandInvulnerable === true,
    relativeSites: t.commandPlacement?.relativeSites as RuleOverrides['relativeSites'],
    relativeTech: (o.nestTech as Tech) ?? 'cryo',
    nest: o.nest as RuleOverrides['nest'],
    adaptant: o.adaptant as RuleOverrides['adaptant'],
  };
  const w = new World({ seed, width: t.width, height: t.height, rules, assist: (o['assist.mode'] as 'full') ?? 'full' });
  // An open field: the player picks the center anywhere, sites follow it (commandPlacement).
  const layout = t.layout as string[] | null;
  const legend = (t.legend ?? {}) as Record<string, string>;
  layout?.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const content = legend[ch] === 'command' ? 'ground' : (legend[ch] as CellContent);
      const c = w.cell(x, y);
      c.content = content;
      if (content === 'rubble') c.stock = 30;
      if (content === 'nest') c.tech = (o.nestTech as Tech) ?? 'cryo';
    }),
  );
  w.s.generated = true;
  return w;
}
