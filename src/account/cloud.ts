import type { FirebaseApp } from 'firebase/app';
import type { Auth, User } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore/lite';
import { FIREBASE_CONFIG } from './config';
import { ACCOUNT_PREFIX, fingerprint, isRunKey, merge, readLocal, runsOf, writeLocal, type MergeResult, type Snapshot } from './snapshot';

/**
 * Guest-first accounts: everyone plays at once with saves in localStorage.
 * Signing in with Google (optional) copies those saves to Firestore (users/{uid}) and keeps devices in step.
 * Firebase is only downloaded after the first sign-in, so guests never touch the network.
 */
export type AccountStatus = 'disabled' | 'guest' | 'connecting' | 'signed';

export interface AccountView {
  status: AccountStatus;
  name: string;
  email: string;
  photo: string;
  /** Last successful cloud write or read, ms since epoch. */
  syncedAt: number;
  error: string;
  /** A newer run from another device waits for the player's choice. */
  conflict: { changedAt: number } | null;
}

interface Meta {
  uid?: string;
  /** When the synced keys on this device last changed. */
  changedAt: number;
  /** Hash of the synced keys as last seen / as last uploaded. */
  seen: string;
  uploaded: string;
}

const META_KEY = `${ACCOUNT_PREFIX}meta`;
const PREV_RUNS_KEY = `${ACCOUNT_PREFIX}replacedRuns`;
const WATCH_MS = 5_000;
/** Upload at most this often while playing (Firestore free tier: 20k writes a day); always on leaving the page. */
const UPLOAD_EVERY_MS = 60_000;
const BOOT_WAIT_MS = 2_500;

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return `${(h >>> 0).toString(36)}:${s.length}`;
}

interface Fb {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  authMod: typeof import('firebase/auth');
  dbMod: typeof import('firebase/firestore/lite');
}

class Account {
  view: AccountView = { status: 'disabled', name: '', email: '', photo: '', syncedAt: 0, error: '', conflict: null };
  private meta: Meta = { changedAt: 0, seen: '', uploaded: '' };
  private fb: Fb | null = null;
  private user: User | null = null;
  private live = false;
  private lastUpload = 0;
  private pending: MergeResult | null = null;
  private listeners = new Set<() => void>();
  private firstPull: Promise<void> | null = null;

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Call before the game reads its saves. Waits briefly for the cloud if this device was signed in. */
  async boot(): Promise<void> {
    this.loadMeta();
    this.watchLocal();
    if (!FIREBASE_CONFIG) return this.set({ status: 'disabled' });
    this.set({ status: 'guest' });
    setInterval(() => this.tick(), WATCH_MS);
    const flush = () => void this.push(true);
    // Leaving: upload. Coming back: another device may have played meanwhile.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') setTimeout(flush, 0);
      else if (this.view.status === 'signed') void this.pull();
    });
    window.addEventListener('pagehide', flush);
    if (this.meta.uid) {
      this.set({ status: 'connecting' });
      void this.connect();
      await Promise.race([new Promise<void>((r) => setTimeout(r, BOOT_WAIT_MS)), this.waitFirstPull()]);
    }
  }

  /** The game has read its saves: from now on a newer cloud run needs the player's OK (it reloads the page). */
  markLive(): void {
    this.live = true;
  }

  async signIn(): Promise<void> {
    if (!FIREBASE_CONFIG) return;
    this.set({ status: 'connecting', error: '' });
    try {
      const fb = await this.connect();
      const provider = new fb.authMod.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try {
        await fb.authMod.signInWithPopup(fb.auth, provider);
      } catch (e) {
        const code = (e as { code?: string }).code ?? '';
        if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') await fb.authMod.signInWithRedirect(fb.auth, provider);
        else throw e;
      }
    } catch (e) {
      this.fail(e);
    }
  }

  async signOut(): Promise<void> {
    await this.push(true);
    if (this.fb) await this.fb.authMod.signOut(this.fb.auth);
  }

  /** Save to the cloud now (button in the panel). */
  syncNow(): Promise<void> {
    return this.push(true);
  }

  /** Conflict answer: take the other device's run (the page reloads to start it). */
  acceptCloud(): void {
    const p = this.pending;
    if (!p) return;
    this.keepReplacedRun(p.data);
    this.applyLocal(p.data, p.changedAt);
    location.reload();
  }

  /** Conflict answer: this device's run wins and overwrites the cloud. */
  keepLocal(): void {
    this.pending = null;
    this.meta.changedAt = Date.now();
    this.saveMeta();
    this.set({ conflict: null });
    void this.push(true);
  }

  // ------------------------------------------------------------------ internals

  private connect(): Promise<Fb> {
    if (this.fb) return Promise.resolve(this.fb);
    return (async () => {
      const [appMod, authMod, dbMod] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore/lite')]);
      const app = appMod.initializeApp(FIREBASE_CONFIG!);
      const auth = authMod.getAuth(app);
      const db = dbMod.getFirestore(app);
      this.fb = { app, auth, db, authMod, dbMod };
      authMod.getRedirectResult(auth).catch((e) => this.fail(e));
      authMod.onAuthStateChanged(auth, (u) => void this.onUser(u));
      return this.fb;
    })().catch((e) => {
      this.fail(e);
      throw e;
    });
  }

  private waitFirstPull(): Promise<void> {
    return new Promise((resolve) => {
      const off = this.onChange(() => {
        if (this.firstPull || this.view.status === 'guest') {
          off();
          void (this.firstPull ?? Promise.resolve()).then(resolve);
        }
      });
    });
  }

  private async onUser(u: User | null): Promise<void> {
    this.user = u;
    if (!u) {
      this.meta.uid = undefined;
      this.saveMeta();
      return this.set({ status: 'guest', name: '', email: '', photo: '', conflict: null });
    }
    if (this.meta.uid && this.meta.uid !== u.uid) this.meta.uploaded = '';
    this.meta.uid = u.uid;
    this.saveMeta();
    this.set({ status: 'signed', name: u.displayName ?? '', email: u.email ?? '', photo: u.photoURL ?? '', error: '' });
    this.firstPull = this.pull();
    this.emit();
    await this.firstPull;
  }

  private async pull(): Promise<void> {
    const fb = this.fb;
    const u = this.user;
    if (!fb || !u) return;
    try {
      const snap = await fb.dbMod.getDoc(fb.dbMod.doc(fb.db, 'users', u.uid));
      const raw = snap.exists() ? (snap.data() as { blob?: string; changedAt?: number }) : null;
      const cloud = raw?.blob ? { data: JSON.parse(raw.blob) as Snapshot, changedAt: raw.changedAt ?? 0 } : null;
      this.watchLocal();
      const local = { data: readLocal(localStorage), changedAt: this.meta.changedAt };
      // First sign-in on this device with a different run on each side: never pick silently.
      const firstLink = !this.meta.uploaded;
      const hasRuns = (d: Snapshot) => Object.keys(d).some(isRunKey);
      const twoRuns = !!cloud && hasRuns(cloud.data) && hasRuns(local.data) && runsOf(cloud.data) !== runsOf(local.data);
      const r = firstLink && twoRuns ? merge({ ...local, changedAt: 0 }, cloud) : merge(local, cloud);
      this.set({ syncedAt: Date.now() });
      if (r.runFromCloud && (this.live || (firstLink && twoRuns))) {
        this.pending = r;
        return this.set({ conflict: { changedAt: cloud!.changedAt } });
      }
      if (r.localChanged) {
        if (r.runFromCloud) this.keepReplacedRun(r.data);
        this.applyLocal(r.data, r.changedAt);
      }
      if (cloud) this.meta.uploaded = hash(fingerprint(cloud.data));
      this.saveMeta();
      if (r.upload) await this.push(true);
    } catch (e) {
      this.fail(e);
    }
  }

  private async push(force = false): Promise<void> {
    const fb = this.fb;
    const u = this.user;
    if (!fb || !u || this.pending || this.view.status !== 'signed') return;
    this.watchLocal();
    if (this.meta.seen === this.meta.uploaded) return;
    if (!force && Date.now() - this.lastUpload < UPLOAD_EVERY_MS) return;
    const data = readLocal(localStorage);
    const fp = fingerprint(data);
    this.lastUpload = Date.now();
    try {
      await fb.dbMod.setDoc(fb.dbMod.doc(fb.db, 'users', u.uid), {
        v: 1,
        blob: JSON.stringify(data),
        changedAt: this.meta.changedAt,
        name: u.displayName ?? '',
        updatedAt: fb.dbMod.serverTimestamp(),
      });
      this.meta.uploaded = hash(fp);
      this.saveMeta();
      this.set({ syncedAt: Date.now(), error: '' });
    } catch (e) {
      this.fail(e);
    }
  }

  private tick(): void {
    this.watchLocal();
    void this.push();
  }

  /** Notices the game writing its saves and stamps when that happened. */
  private watchLocal(): void {
    try {
      const h = hash(fingerprint(readLocal(localStorage)));
      if (h !== this.meta.seen) {
        // The first look on a device that never synced keeps changedAt 0 when there's nothing saved yet.
        if (this.meta.seen || Object.keys(readLocal(localStorage)).length) this.meta.changedAt = Date.now();
        this.meta.seen = h;
        this.saveMeta();
      }
    } catch {
      /* storage blocked: nothing to sync */
    }
  }

  private applyLocal(data: Snapshot, changedAt: number): void {
    try {
      writeLocal(localStorage, data);
      this.meta.changedAt = changedAt;
      this.meta.seen = hash(fingerprint(data));
      this.saveMeta();
    } catch (e) {
      this.fail(e);
    }
  }

  /** Keeps the runs that cloud runs replaced, just in case (never synced). */
  private keepReplacedRun(next: Snapshot): void {
    try {
      const cur = readLocal(localStorage);
      if (runsOf(cur) !== runsOf(next)) localStorage.setItem(PREV_RUNS_KEY, JSON.stringify(Object.fromEntries(Object.entries(cur).filter(([k]) => isRunKey(k)))));
    } catch {
      /* ignore */
    }
  }

  private loadMeta(): void {
    try {
      Object.assign(this.meta, JSON.parse(localStorage.getItem(META_KEY) ?? '{}'));
    } catch {
      /* defaults */
    }
  }

  private saveMeta(): void {
    try {
      localStorage.setItem(META_KEY, JSON.stringify(this.meta));
    } catch {
      /* ignore */
    }
  }

  private fail(e: unknown): void {
    const code = (e as { code?: string }).code ?? '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return this.set({ status: this.user ? 'signed' : 'guest' });
    }
    console.warn('[account]', e);
    this.set({ status: this.user ? 'signed' : 'guest', error: code || 'unknown' });
  }

  private set(p: Partial<AccountView>): void {
    Object.assign(this.view, p);
    this.emit();
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }
}

export const account = new Account();
