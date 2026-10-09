/** What the player has already seen: guide entries, lessons, coach cards. Stored in localStorage. */
const KEY = 'partshift.learning.v1';

interface Saved {
  viewed: string[];
  coachSeen: string[];
  coachOff: boolean;
}

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { viewed: [], coachSeen: [], coachOff: false, ...JSON.parse(raw) };
  } catch {
    /* private mode or blocked storage: start fresh */
  }
  return { viewed: [], coachSeen: [], coachOff: false };
}

const state = load();

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export const progress = {
  viewed: (id: string): boolean => state.viewed.includes(id),
  markViewed(id: string): void {
    if (state.viewed.includes(id)) return;
    state.viewed.push(id);
    save();
  },
  coachSeen: (topic: string): boolean => state.coachSeen.includes(topic),
  markCoach(topic: string): void {
    if (!state.coachSeen.includes(topic)) state.coachSeen.push(topic);
    save();
  },
  get coachOff(): boolean {
    return state.coachOff;
  },
  set coachOff(v: boolean) {
    state.coachOff = v;
    save();
  },
  reset(): void {
    state.viewed = [];
    state.coachSeen = [];
    state.coachOff = false;
    save();
  },
};
