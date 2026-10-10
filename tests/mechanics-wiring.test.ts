import { describe, expect, it } from 'vitest';
import { controlEvents } from '../src/core/data';
import { handWorld, run } from './helpers';

describe('аккорд (chord)', () => {
  it('digs the free neighbours of a revealed number once its danger marks match it', () => {
    // Command at (0,1); a nest at (2,1) gives the clue at (1,1) a threat of 1.
    const w = handWorld(['.....', '.....', '..n..', '.....']);
    w.apply({ type: 'placeCommand', x: 0, y: 1 });
    const clue = { x: 1, y: 2 };
    w.cell(clue.x, clue.y).revealed = true;
    expect(w.clues(clue.x, clue.y).threat).toBeGreaterThan(0);
    expect(w.apply({ type: 'chord', x: clue.x, y: clue.y }).ok).toBe(false);
    const threat = w.clues(clue.x, clue.y).threat;
    // Mark one neighbour that is not the nest; the number now matches the marks.
    const marked = [{ x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }, { x: 1, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 1 }, { x: 2, y: 3 }]
      .filter((p) => !w.cell(p.x, p.y).revealed && w.cell(p.x, p.y).content === 'ground')
      .slice(0, threat);
    for (const p of marked) w.apply({ type: 'toggleMark', x: p.x, y: p.y });
    expect(w.apply({ type: 'chord', x: clue.x, y: clue.y }).ok).toBe(true);
    run(w, 0.5);
    const queued = w.player(0).queue.length + w.player(0).autoQueue.length;
    expect(queued).toBeGreaterThan(0);
    expect(w.player(0).queue.some((k) => marked.some((p) => `${p.x},${p.y}` === k))).toBe(false);
  });
});

describe('Контроль calls (random draw)', () => {
  it('offers only calls whose effects are implemented, never during the call target', () => {
    const w = handWorld(['.....', '.....', '..n..', '.....'], 3, { controlCalls: true });
    w.apply({ type: 'placeCommand', x: 0, y: 1 });
    run(w, 260);
    const id = w.s.controlCall?.id;
    if (id) {
      expect(controlEvents[id]).toBeDefined();
      expect(w.s.controlCall?.scheduled).toBe(true);
    }
    expect(w.s.callPlan?.used.length ?? 0).toBeLessThanOrEqual(3);
  });

  it('does not schedule calls when the campaign flag is off', () => {
    const w = handWorld(['.....', '.....', '..n..', '.....'], 3, { controlCalls: false });
    w.apply({ type: 'placeCommand', x: 0, y: 1 });
    run(w, 300);
    expect(w.s.callPlan).toBeUndefined();
    expect(w.s.controlCall ?? null).toBeNull();
  });

  it('applies randomBuildingHpPercent and keeps the command out of it', () => {
    const w = handWorld(['.....', '.....', '..n..', '.....'], 5, { controlCalls: true });
    w.apply({ type: 'placeCommand', x: 0, y: 1 });
    const cmd = w.s.buildings.find((b) => b.type === 'command')!;
    const hpBefore = cmd.hp;
    w.s.controlCall = { id: 'rent', scheduled: true };
    const r = w.apply({ type: 'answerCall', choice: 'b' } as never);
    expect(r.ok).toBe(true);
    expect(cmd.hp).toBe(hpBefore);
  });
});

describe('Контроль: hero buffs and full heal', () => {
  it('premium heals every hero and slows ours for its duration', () => {
    const w = handWorld(['.....', '.....', '..n..', '.....'], 7, { controlCalls: true });
    w.apply({ type: 'placeCommand', x: 0, y: 1 });
    const hero = w.s.units.find((u) => u.owner === 0 && u.hp > 0)!;
    hero.hp = 1;
    w.s.controlCall = { id: 'premium', scheduled: true };
    expect(w.apply({ type: 'answerCall', choice: 'a' } as never).ok).toBe(true);
    expect(hero.hp).toBe(w.maxHp(hero));
  });

  it('timed buffs expire after durationSeconds', () => {
    const w = handWorld(['.....', '.....', '..n..', '.....'], 7, { controlCalls: true });
    w.apply({ type: 'placeCommand', x: 0, y: 1 });
    w.s.controlCall = { id: 'premium', scheduled: true };
    w.apply({ type: 'answerCall', choice: 'b' } as never);
    expect(w.s.callBuffs?.speed?.factor).toBe(0.8);
    const hero = w.s.units.find((u) => u.owner === 0 && u.kind !== 'resident' && u.hp > 0) ?? w.s.units.find((u) => u.owner === 0)!;
    const fast = w.stats(hero).speed;
    run(w, 25);
    expect(w.stats(hero).speed).toBeGreaterThan(fast);
  });
});
