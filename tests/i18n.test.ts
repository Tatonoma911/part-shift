import { describe, expect, it } from 'vitest';
import en from '../src/i18n/en.json';
import ru from '../src/i18n/ru.json';

describe('i18n', () => {
  it('English has exactly the same keys as Russian', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ru).sort());
  });
});
