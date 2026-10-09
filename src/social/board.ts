import type { FirebaseApp } from 'firebase/app';
import { FIREBASE_CONFIG } from '../account/config';
import { boardId, type BoardKind } from './score';

/**
 * World leaderboard and feedback on Firestore (same Firebase project as accounts and analytics).
 * Players don't sign in: a separate Firebase app "social" signs in anonymously, so the leaderboard
 * never touches the Google account session. One document per player per board:
 * boards/{boardId}/scores/{uid} = { name, score, seconds, victory, rank, at }.
 * Rules (firestore.rules) only let a player write their own row and only raise its score.
 */
export interface Entry {
  uid: string;
  name: string;
  score: number;
  seconds: number;
  victory: boolean;
  rank: number;
  at: number;
}

export const boardEnabled = (): boolean => FIREBASE_CONFIG !== null;

type Lite = typeof import('firebase/firestore/lite');
interface Conn {
  uid: string;
  db: import('firebase/firestore/lite').Firestore;
  m: Lite;
}

let conn: Promise<Conn> | null = null;

function connect(): Promise<Conn> {
  if (!FIREBASE_CONFIG) return Promise.reject(new Error('social/disabled'));
  conn ??= (async () => {
    const [appMod, authMod, m] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore/lite')]);
    const app: FirebaseApp = appMod.getApps().find((a) => a.name === 'social') ?? appMod.initializeApp(FIREBASE_CONFIG!, 'social');
    const auth = authMod.getAuth(app);
    await authMod.setPersistence(auth, authMod.browserLocalPersistence).catch(() => undefined);
    const user = auth.currentUser ?? (await new Promise<import('firebase/auth').User | null>((res) => { const off = authMod.onAuthStateChanged(auth, (u) => { off(); res(u); }); })) ?? (await authMod.signInAnonymously(auth)).user;
    return { uid: user.uid, db: m.getFirestore(app), m };
  })();
  conn.catch(() => (conn = null));
  return conn;
}

const scores = (c: Conn, board: string) => c.m.collection(c.db, 'boards', board, 'scores');

/** Sends a result to a board if it beats the player's row there. Returns the stored best. */
export async function submit(board: string, e: Omit<Entry, 'uid' | 'at'>): Promise<number> {
  const c = await connect();
  const ref = c.m.doc(scores(c, board), c.uid);
  const old = await c.m.getDoc(ref);
  const prev = old.exists() ? Number(old.data().score) || 0 : -1;
  if (e.score <= prev) {
    // Same score, maybe a new nickname.
    if (old.exists() && old.data().name !== e.name) await c.m.updateDoc(ref, { name: e.name });
    return prev;
  }
  await c.m.setDoc(ref, { ...e, at: Date.now() });
  return e.score;
}

/** Renames the player's rows on the given boards (keeps scores). */
export async function rename(boards: string[], name: string): Promise<void> {
  const c = await connect();
  await Promise.all(
    boards.map(async (b) => {
      const ref = c.m.doc(scores(c, b), c.uid);
      if ((await c.m.getDoc(ref)).exists()) await c.m.updateDoc(ref, { name });
    }),
  );
}

export async function top(kind: BoardKind, n = 50): Promise<{ rows: Entry[]; me: string }> {
  const c = await connect();
  const q = c.m.query(scores(c, boardId(kind)), c.m.orderBy('score', 'desc'), c.m.limit(n));
  const snap = await c.m.getDocs(q);
  return { rows: snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<Entry, 'uid'>) })), me: c.uid };
}

/** 1-based place of a score on a board. */
export async function placeOf(board: string, score: number): Promise<number> {
  const c = await connect();
  const snap = await c.m.getCount(c.m.query(scores(c, board), c.m.where('score', '>', score)));
  return snap.data().count + 1;
}

/** Feedback goes to feedback/{auto id}; only the author reads it in the Firebase console. */
export async function sendFeedback(f: { kind: string; text: string; contact: string; lang: string; build: string }): Promise<void> {
  const c = await connect();
  await c.m.addDoc(c.m.collection(c.db, 'feedback'), { ...f, uid: c.uid, at: Date.now(), ua: navigator.userAgent.slice(0, 200) });
}
