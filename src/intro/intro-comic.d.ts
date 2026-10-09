export function introSeen(): boolean;
export function resetIntroSeen(): void;
export function playIntroComic(opts?: {
  lang?: 'ru' | 'en';
  assetBase?: string;
  assets?: Record<string, string>;
  music?: boolean;
  musicVolume?: number;
  sfxVolume?: number;
  skipGate?: boolean;
  parent?: HTMLElement;
  onDone?: (r: { skipped: boolean }) => void;
}): Promise<{ skipped: boolean }>;
