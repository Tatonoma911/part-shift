import manifest from '../assets/audio/sounds.json';

/**
 * Sound effects and music from audio/sounds.json (owner: sound designer).
 * Sound id = core event name. Plays through Web Audio with the manifest's
 * cooldowns, per-sound instance limits and a 12-voice cap by priority.
 * Only the MP3 copies ship (every browser plays them); the music loop uses
 * loopEnd = loopSeconds so the MP3 padding doesn't leave a gap.
 */
const urls = import.meta.glob(['../assets/audio/**/*.mp3', '!../assets/audio/music/theme_lumen.mp3'], { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

interface SfxDef {
  files: string[];
  volume: number;
  cooldownMs: number;
  maxInstances: number;
  priority: number;
  group: string;
}
interface MusicDef {
  files: string[];
  volume: number;
  loop: boolean;
  loopSeconds: number;
  /** 92 bpm stage track: switches on a bar line of the running 92 bpm music (MUSIC.md). */
  barSync?: boolean;
}

interface MusicTrack {
  id: string;
  src: AudioBufferSourceNode;
  gain: GainNode;
  volume: number;
}

const RUN_LAYERS = ['run_calm', 'run_heroes', 'run_danger'];
/** One bar at 92 bpm, 4/4 (MUSIC.md). */
const BAR = 2.6087;
const SFX = (manifest as unknown as { sfx: Record<string, SfxDef> }).sfx;
const MUSIC = (manifest as unknown as { music: Record<string, MusicDef> }).music;
const PREFS_KEY = 'partshift.sound.v1';
const MAX_VOICES = 12;
/** Energy orb combo: major pentatonic steps in cents (sounds.json note). */
const COMBO = [0, 200, 400, 700, 900, 1200];

function urlOf(file: string): string | undefined {
  const hit = Object.entries(urls).find(([path]) => path.endsWith(`/audio/${file}.mp3`));
  return hit?.[1];
}

async function bytesOf(url: string): Promise<ArrayBuffer> {
  // The artifact build inlines files as data: URLs; decode those without fetch().
  if (url.startsWith('data:')) {
    const bin = atob(url.slice(url.indexOf(',') + 1));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }
  return (await fetch(url)).arrayBuffer();
}

/** Volume per channel, 0..1. Effects = world, combat and alerts; ui = taps and menus; voice = character barks. */
export interface SoundPrefs {
  master: number;
  music: number;
  effects: number;
  ui: number;
  voice: number;
}
export type VolumeChannel = keyof SoundPrefs;
export const CHANNELS: VolumeChannel[] = ['master', 'music', 'effects', 'ui', 'voice'];
const DEFAULT_PREFS: SoundPrefs = { master: 0.8, music: 0.6, effects: 0.8, ui: 0.7, voice: 0.8 };

/** True once the sound designer's manifest has sounds in the "voice" group. */
export const HAS_VOICE = Object.values(SFX).some((d) => d.group === 'voice');

/** The pre-slider prefs were {sfx: boolean, music: boolean}. */
function readPrefs(raw: Record<string, unknown>): SoundPrefs {
  const out = { ...DEFAULT_PREFS };
  if (typeof raw.sfx === 'boolean' && !raw.sfx) out.effects = out.ui = out.voice = 0;
  if (typeof raw.music === 'boolean' && !raw.music) out.music = 0;
  for (const k of CHANNELS) if (typeof raw[k] === 'number') out[k] = Math.min(1, Math.max(0, raw[k] as number));
  return out;
}

class SoundBoard {
  private ctx: AudioContext | null = null;
  private masterBus!: GainNode;
  private musicBus!: GainNode;
  private buses!: Record<'effects' | 'ui' | 'voice', GainNode>;
  private buffers = new Map<string, AudioBuffer>();
  private loading = new Map<string, Promise<AudioBuffer | null>>();
  private last = new Map<string, number>();
  private voices: { id: string; priority: number; src: AudioBufferSourceNode }[] = [];
  private tracks: MusicTrack[] = [];
  private wantMusic: string | null = null;
  private musicToken = 0;
  /** AudioContext time the bar grid of the running 92 bpm music started (run layers and barSync stages). */
  private runStart: number | null = null;
  private layerTarget: Record<string, number> = { run_calm: 1, run_heroes: 0, run_danger: 0 };
  private afterBoss = false;
  private afterEnd = false;
  private ducked = false;
  /** The guide's theme is playing; `back` is the track to return to. */
  private lore: { back: string | null } | null = null;
  private combo = { step: 0, at: -1e9 };
  prefs: SoundPrefs = { ...DEFAULT_PREFS };

  constructor() {
    try {
      this.prefs = readPrefs(JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}'));
    } catch {
      /* defaults */
    }
  }

  /** Music is heard at all (the intro comic asks before starting its own track). */
  get musicOn(): boolean {
    return this.prefs.master > 0 && this.prefs.music > 0;
  }

  /** Browsers start audio only after a user gesture: call from the first pointerdown. */
  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      try {
        this.ctx = new Ctx({ sampleRate: 44100 });
      } catch {
        this.ctx = new Ctx();
      }
      const ctx = this.ctx;
      this.masterBus = ctx.createGain();
      this.masterBus.connect(ctx.destination);
      const bus = () => {
        const g = ctx.createGain();
        g.connect(this.masterBus);
        return g;
      };
      this.musicBus = bus();
      this.buses = { effects: bus(), ui: bus(), voice: bus() };
      this.applyPrefs();
      // Warm up the common sounds so the first dig isn't silent.
      for (const id of ['ui_tap', 'dig_done', 'energy_orb_arrive', 'build_place']) SFX[id]?.files.forEach((f) => void this.load(f));
      if (this.wantMusic) this.playMusic(this.wantMusic);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setPrefs(p: Partial<SoundPrefs>): void {
    Object.assign(this.prefs, p);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs));
    } catch {
      /* ignore */
    }
    this.applyPrefs();
  }

  private applyPrefs(): void {
    if (!this.ctx) return;
    // Squared so the slider feels even to the ear.
    const v = (x: number) => x * x;
    this.masterBus.gain.value = v(this.prefs.master);
    this.musicBus.gain.value = this.musicLevel();
    for (const k of ['effects', 'ui', 'voice'] as const) this.buses[k].gain.value = v(this.prefs[k]);
  }

  private channelOf(def: SfxDef): 'effects' | 'ui' | 'voice' {
    return def.group === 'ui' ? 'ui' : def.group === 'voice' ? 'voice' : 'effects';
  }

  private load(file: string): Promise<AudioBuffer | null> {
    const ready = this.buffers.get(file);
    if (ready) return Promise.resolve(ready);
    let p = this.loading.get(file);
    if (!p) {
      const url = urlOf(file);
      const ctx = this.ctx;
      p =
        url && ctx
          ? bytesOf(url)
              .then((b) => ctx.decodeAudioData(b))
              .then((buf) => {
                this.buffers.set(file, buf);
                return buf;
              })
              .catch(() => null)
          : Promise.resolve(null);
      this.loading.set(file, p);
    }
    return p;
  }

  /** The manifest has this sound (per-building variants fall back to a generic one). */
  has(id: string): boolean {
    return id in SFX;
  }

  play(id: string): void {
    const def = SFX[id];
    if (!def || !this.ctx || this.prefs.master <= 0 || this.prefs[this.channelOf(def)] <= 0) return;
    const now = performance.now();
    if (now - (this.last.get(id) ?? -1e9) < def.cooldownMs) return;
    if (this.voices.filter((v) => v.id === id).length >= def.maxInstances) return;
    if (this.voices.length >= MAX_VOICES) {
      const weakest = [...this.voices].sort((a, b) => a.priority - b.priority)[0];
      if (weakest.priority > def.priority) return;
      weakest.src.stop();
    }
    this.last.set(id, now);
    let file = def.files[Math.floor(Math.random() * def.files.length)];
    let detune = 0;
    if (id === 'energy_orb_arrive') {
      if (now - this.combo.at < 1500) {
        this.combo.step = Math.min(COMBO.length - 1, this.combo.step + 1);
        file = def.files[0];
        detune = COMBO[this.combo.step];
      } else this.combo.step = 0;
      this.combo.at = now;
    }
    void this.load(file).then((buf) => {
      if (!buf || !this.ctx) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.detune.value = detune;
      const gain = this.ctx.createGain();
      gain.gain.value = def.volume;
      src.connect(gain).connect(this.buses[this.channelOf(def)]);
      const voice = { id, priority: def.priority, src };
      this.voices.push(voice);
      src.onended = () => (this.voices = this.voices.filter((v) => v !== voice));
      src.start();
    });
  }

  /**
   * Music per audio/MUSIC.md. 'run' starts the three run_* layers in sync
   * (gains follow setLayers); a barSync stage (demon, raid, hero_hunt,
   * last_stand) crossfades in on the next bar of the running 92 bpm music;
   * the slow ambients crossfade over 3 s; one-shot tracks (victory, defeat)
   * hand over to 'menu' when they end.
   */
  playMusic(id: string): void {
    // While the guide is open its theme plays; the game's choice waits for it to close.
    if (this.lore) {
      this.lore.back = id;
      return;
    }
    this.switchMusic(id);
  }

  /** The guide (справочник) opened over the menu or a run: its theme crossfades in, undimmed by pause. */
  openLore(): void {
    if (this.lore) return;
    this.lore = { back: this.wantMusic };
    this.switchMusic('lore');
    this.duck(this.ducked);
  }

  /** The guide closed: crossfade back to what was playing (or what the game asked for meanwhile). */
  closeLore(): void {
    const l = this.lore;
    if (!l) return;
    this.lore = null;
    this.duck(this.ducked);
    if (l.back) this.switchMusic(l.back);
    else this.stopMusic(3);
  }

  private switchMusic(id: string): void {
    if (this.wantMusic === id && this.tracks.length) return;
    this.wantMusic = id;
    if (!this.ctx) return;
    const ctx = this.ctx;
    const ids = id === 'run' ? RUN_LAYERS : [id];
    const defs = ids.map((m) => MUSIC[m]).filter(Boolean);
    if (!defs.length) return;
    const token = ++this.musicToken;
    void Promise.all(defs.map((d) => this.load(d.files[0]))).then((bufs) => {
      if (token !== this.musicToken || this.wantMusic !== id || bufs.some((b) => !b)) return;
      const old = this.tracks;
      const now = ctx.currentTime;
      // 92 bpm tracks enter on a bar line of the running 92 bpm music (MUSIC.md).
      const synced = id === 'run' || !!defs[0].barSync;
      const fromSynced = this.runStart !== null && old.length > 0;
      let at = now + 0.1;
      if (synced && fromSynced) at = this.runStart! + Math.ceil((now + 0.1 - this.runStart!) / BAR) * BAR;
      // Every change is a crossfade (Антон: no track ever cuts off). A victory/defeat sting keeps its
      // attack while the old music fades under it; 92 bpm stages swap on the bar; the rest take 3 s.
      const oneShot = !defs[0].loop;
      const quick = synced && fromSynced;
      const fadeIn = oneShot ? 0.25 : quick ? 1.5 : old.length || this.afterBoss || this.afterEnd ? 3 : 2;
      const fadeOld = oneShot ? 2.5 : at + fadeIn - now;
      this.afterBoss = this.afterEnd = false;
      this.tracks = ids.map((m, i) => {
        const def = defs[i];
        const src = ctx.createBufferSource();
        src.buffer = bufs[i]!;
        src.loop = def.loop;
        if (def.loop) src.loopEnd = Math.min(def.loopSeconds, bufs[i]!.duration);
        const gain = ctx.createGain();
        const target = id === 'run' ? (this.layerTarget[m] ?? 0) : 1;
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(target * def.volume, at + fadeIn);
        src.connect(gain).connect(this.musicBus);
        src.start(at);
        if (!def.loop)
          src.onended = () => {
            if (this.wantMusic !== id) return;
            this.afterEnd = true;
            this.tracks = [];
            this.playMusic('menu');
          };
        return { id: m, src, gain, volume: def.volume };
      });
      if (!synced) this.runStart = null;
      else if (!fromSynced) this.runStart = at;
      this.fadeOut(old, fadeOld);
      this.evictMusic(ids);
    });
  }

  /**
   * Stage tracks are about a minute of decoded stereo each (~20 MB): keep the
   * run layers and what is playing, let the rest be decoded again when needed.
   */
  private evictMusic(keep: string[]): void {
    const files = new Set([...RUN_LAYERS, ...keep].flatMap((m) => MUSIC[m]?.files ?? []));
    for (const def of Object.values(MUSIC))
      for (const f of def.files)
        if (!files.has(f)) {
          this.buffers.delete(f);
          this.loading.delete(f);
        }
  }

  /** run_heroes / run_danger targets (0..1); ramps up in 1.5 s, down in 4 s. */
  setLayers(heroes: number, danger: number): void {
    this.layerTarget = { run_calm: 1, run_heroes: heroes, run_danger: danger };
    if (!this.ctx || this.wantMusic !== 'run') return;
    const t = this.ctx.currentTime;
    for (const tr of this.tracks) {
      const want = (this.layerTarget[tr.id] ?? 0) * tr.volume;
      const cur = tr.gain.gain.value;
      if (Math.abs(want - cur) < 0.01) continue;
      tr.gain.gain.cancelScheduledValues(t);
      tr.gain.gain.setValueAtTime(cur, t);
      tr.gain.gain.linearRampToValueAtTime(want, t + (want > cur ? 1.5 : 4));
    }
  }

  /** The call target fell: the demon fades out over 3 s into the calm "after the storm" track. */
  bossDown(): void {
    if (this.wantMusic !== 'demon') return;
    this.afterBoss = true;
    this.playMusic('aftermath');
  }

  /** Pause ducks the music bus to 35 % instead of silencing it. */
  duck(on: boolean): void {
    this.ducked = on;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const g = this.musicBus.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(this.musicLevel(), t + 0.3);
  }

  private musicLevel(): number {
    // Music bus default 0.5 at full slider (contracts.md, "Звук"), squared like the others.
    return 0.5 * this.prefs.music * this.prefs.music * (this.ducked && !this.lore ? 0.35 : 1);
  }

  private fadeOut(tracks: MusicTrack[], seconds: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const tr of tracks) {
      tr.src.onended = null;
      tr.gain.gain.cancelScheduledValues(t);
      tr.gain.gain.setValueAtTime(tr.gain.gain.value, t);
      tr.gain.gain.linearRampToValueAtTime(0, t + seconds);
      try {
        tr.src.stop(t + seconds + 0.05);
      } catch {
        /* never started */
      }
    }
  }

  /** Victory and defeat duck the music to zero and stop it (sounds.json note). */
  stopMusic(fadeSeconds = 1.5): void {
    this.lore = null;
    this.wantMusic = null;
    this.musicToken++;
    this.fadeOut(this.tracks, fadeSeconds);
    this.tracks = [];
    this.runStart = null;
    if (this.ducked) this.duck(false);
  }

  /** Victory / defeat sting over the fading run music; 'menu' follows when it ends. */
  playEnd(victory: boolean): void {
    this.playMusic(victory ? 'victory' : 'defeat');
  }
}

export const sound = new SoundBoard();

// Any tap or key anywhere (menu, a ?seed challenge link straight to the board) unlocks audio.
if (typeof window !== 'undefined') {
  const unlock = () => sound.unlock();
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });
}
