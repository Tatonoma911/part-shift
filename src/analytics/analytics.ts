/**
 * Product analytics without the provider: consent, a small pre-consent queue, where the player is,
 * and GA4-safe parameters. Nothing leaves the device until the player says yes (docs/ANALYTICS.md).
 */
export type Consent = 'unknown' | 'granted' | 'denied';
export type Params = Record<string, string | number | boolean | undefined>;
type Clean = Record<string, string | number>;

/** Where events go once allowed (Firebase Analytics in the game, a fake in tests). */
export interface Sink {
  send(name: string, params: Clean): void;
}

export interface Storage {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export const CONSENT_KEY = 'partshift-analytics.consent';
const FIRST_KEY = 'partshift-analytics.first';
const LAUNCHES_KEY = 'partshift-analytics.launches';
/** Events before the player answers are held in memory only, and dropped on "no". */
const QUEUE_MAX = 60;
const DAY_MS = 86_400_000;

/** GA4 limits: names up to 40 chars of [a-z0-9_], 25 parameters, text values up to 100 chars. */
export function clean(params: Params): Clean {
  const out: Clean = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || Object.keys(out).length >= 25) continue;
    const key = k.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 40);
    out[key] = typeof v === 'boolean' ? (v ? 1 : 0) : typeof v === 'number' ? (Number.isFinite(v) ? Math.round(v * 100) / 100 : 0) : v.slice(0, 100);
  }
  return out;
}

export function eventName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 40);
}

export class Analytics {
  private state: Consent;
  private queue: { name: string; params: Clean }[] = [];
  private sink: Sink | null = null;
  private loading: Promise<Sink | null> | null = null;
  private screen = 'boot';
  private details: (() => Params) | null = null;
  private listeners = new Set<(c: Consent) => void>();

  constructor(
    private readonly store: Storage,
    /** Loads the provider; resolves null when there is none (no config, blocked, unsupported). */
    private readonly load: () => Promise<Sink | null>,
    /** Do Not Track / Global Privacy Control: treated as a standing "no", no question asked. */
    private readonly optedOut = false,
    private readonly debug: ((name: string, params: Clean) => void) | null = null,
  ) {
    const saved = store.get(CONSENT_KEY);
    this.state = optedOut ? 'denied' : saved === 'granted' || saved === 'denied' ? saved : 'unknown';
    if (this.state === 'granted') void this.connect();
  }

  get consent(): Consent {
    return this.state;
  }

  /** Should the game ask? Only once per device, and never under Do Not Track. */
  get shouldAsk(): boolean {
    return this.state === 'unknown';
  }

  onConsent(fn: (c: Consent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  setConsent(granted: boolean): void {
    if (this.optedOut && granted) return;
    this.state = granted ? 'granted' : 'denied';
    this.store.set(CONSENT_KEY, this.state);
    if (granted) void this.connect();
    else this.queue = [];
    for (const fn of this.listeners) fn(this.state);
  }

  /** Counts this launch; returns what the boot event reports (first launch, days since the first one). */
  launch(now = Date.now()): { first_launch: boolean; launch_count: number; days_since_first: number } {
    const first = Number(this.store.get(FIRST_KEY)) || 0;
    const count = (Number(this.store.get(LAUNCHES_KEY)) || 0) + 1;
    if (!first) this.store.set(FIRST_KEY, String(now));
    this.store.set(LAUNCHES_KEY, String(count));
    return { first_launch: !first, launch_count: count, days_since_first: first ? Math.floor((now - first) / DAY_MS) : 0 };
  }

  /** Where the player is now; `details` is read when they leave (match time, tutorial step). */
  where(screen: string, details: (() => Params) | null = null): void {
    this.screen = screen;
    this.details = details;
  }

  get currentScreen(): string {
    return this.screen;
  }

  track(name: string, params: Params = {}): void {
    const n = eventName(name);
    const p = clean(params);
    this.debug?.(n, p);
    if (this.state === 'denied') return;
    if (this.state === 'unknown' || !this.sink) {
      if (this.queue.length < QUEUE_MAX) this.queue.push({ name: n, params: p });
      return;
    }
    this.sink.send(n, p);
  }

  /** The tab or app went to the background: the last screen is where a player who never returns quit. */
  left(): void {
    let extra: Params = {};
    try {
      extra = this.details?.() ?? {};
    } catch {
      /* a scene that is gone */
    }
    this.track('app_hide', { screen: this.screen, ...extra });
  }

  private connect(): Promise<Sink | null> {
    this.loading ??= this.load()
      .catch(() => null)
      .then((sink) => {
        this.sink = sink;
        if (sink && this.state === 'granted') for (const e of this.queue.splice(0)) sink.send(e.name, e.params);
        // No provider: nothing will ever be sent, so don't keep the queue.
        if (!sink) this.queue = [];
        return sink;
      });
    return this.loading;
  }
}
