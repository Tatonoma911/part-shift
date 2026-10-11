import { describe, expect, it } from 'vitest';
import { handWorld, residents } from './helpers';

describe('hero experience and perks', () => {
  it('a hero that reaches a new level is offered perks, and the pick sticks to that hero', () => {
    const w = handWorld(['.......', '.......', '......n']);
    w.apply({ type: 'placeCommand', x: 0, y: 1 });
    const hero = residents(w).find((u) => u.kind === 'ally') ?? residents(w)[0];
    hero.kind = 'ally';
    const engine = w as unknown as { heroXp(u: unknown, n: number): void };
    engine.heroXp(hero, 2);
    expect(w.s.players[0].heroPick).toBeUndefined();
    engine.heroXp(hero, 1);
    const offer = w.s.players[0].heroPick!;
    expect(offer.unit).toBe(hero.id);
    expect(offer.ids.length).toBeGreaterThan(0);
    const hpBefore = hero.base.hp;
    expect(w.apply({ type: 'pickHeroPerk', id: offer.ids[0] }).ok).toBe(true);
    expect(hero.perks).toContain(offer.ids[0]);
    expect(w.s.players[0].heroPick).toBeUndefined();
    if (offer.ids[0] === 'hero_vigor') expect(hero.base.hp).toBeGreaterThan(hpBefore);
  });
});
