import manifest from '../assets/audio/sounds.json';

/**
 * Sound effects and music from audio/sounds.json (owner: sound designer).
 * Sound id = core event name. Plays through Web Audio with the manifest's
 * cooldowns, per-sound instance limits and a 12-voice cap by priority.
 * Only the MP3 copies ship (every browser plays them); the music loop uses
 * loopEnd = loopSeconds so the MP3 padding doesn't leave a gap.
 */
const urls = import.meta.glob('../assets/audio/**/*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

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
}

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

export interface SoundPrefs {
  sfx: boolean;
  music: boolean;
}

class SoundBoard {
  private ctx: AudioContext | null = null;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private buffers = new Map<string, AudioBuffer>();
  private loading = new Map<string, Promise<AudioBuffer | null>>();
  private last = new Map<string, number>();
  private voices: { id: string; priority: number; src: AudioBufferSourceNode }[] = [];
  private music: AudioBufferSourceNode | null = null;
  private wantMusic: string | null = null;
  private combo = { step: 0, at: -1e9 };
  prefs: SoundPrefs = { sfx: true, music: true };

  constructor() {
    try {
      Object.assign(this.prefs, JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}'));
    } catch {
      /* defaults */
    }
  }

  /** Browsers start audio only after a user gesture: call from the first pointerdown. */
  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.sfxBus = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      this.sfxBus.connect(this.ctx.destination);
      this.musicBus.connect(this.ctx.destination);
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
    this.sfxBus.gain.value = this.prefs.sfx ? 1 : 0;
    // Music bus default 0.5 (contracts.md, "Звук").
    this.musicBus.gain.value = this.prefs.music ? 0.5 : 0;
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

  play(id: string): void {
    const def = SFX[id];
    if (!def || !this.ctx || !this.prefs.sfx) return;
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
      src.connect(gain).connect(this.sfxBus);
      const voice = { id, priority: def.priority, src };
      this.voices.push(voice);
      src.onended = () => (this.voices = this.voices.filter((v) => v !== voice));
      src.start();
    });
  }

  playMusic(id: string): void {
    this.wantMusic = id;
    const def = MUSIC[id];
    if (!def || !this.ctx || this.music) return;
    void this.load(def.files[0]).then((buf) => {
      if (!buf || !this.ctx || this.music || this.wantMusic !== id) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = def.loop;
      src.loopEnd = Math.min(def.loopSeconds, buf.duration);
      const gain = this.ctx.createGain();
      gain.gain.value = def.volume;
      src.connect(gain).connect(this.musicBus);
      src.start();
      this.music = src;
    });
  }

  /** Victory and defeat duck the music to zero and stop it (sounds.json note). */
  stopMusic(fadeSeconds = 0.6): void {
    this.wantMusic = null;
    const src = this.music;
    this.music = null;
    if (!src || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setValueAtTime(this.musicBus.gain.value, t);
    this.musicBus.gain.linearRampToValueAtTime(0, t + fadeSeconds);
    src.stop(t + fadeSeconds);
    setTimeout(() => this.applyPrefs(), fadeSeconds * 1000 + 50);
  }
}

export const sound = new SoundBoard();
