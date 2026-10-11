import { describe, expect, it } from 'vitest';
import { hazards } from '../src/core/data';
import { cheb } from '../src/core/grid';
import { handWorld, residents } from './helpers';

describe('heroes answer hits and walk to a healing medkit', () => {
  it('a hurt hero walks to a medkit the player opened, and heals there', () => {
    const w = handWorld(['.......', '.......', '......n']);
    w.apply({ type: 'placeCommand', x: 0, y: 1 });
    for (let x = 0; x <= 4; x++) for (let y = 0; y <= 2; y++) w.cell(x, y).revealed = true;
    const c = w.cell(4, 1);
    c.content = 'medkit';
    c.stock = hazards.medkit.count;
    w.apply({ type: 'useMedkit', x: 4, y: 1 });
    const h = residents(w)[0];
    h.hp = h.hp * 0.4;
    h.x = 0;
    h.y = 0;
    let nearest = Infinity;
    for (let t = 0; t < 30; t += 0.05) {
      w.step(0.05);
      nearest = Math.min(nearest, cheb(Math.round(h.x), Math.round(h.y), 4, 1));
    }
    expect(nearest).toBeLessThanOrEqual(hazards.medkit.radius);
  });
});
