import { describe, expect, it } from 'vitest';
import ruWriter from '../src/data/text/ru.json';
import en from '../src/i18n/en.json';
import ruExtra from '../src/i18n/ru-extra.json';

describe('i18n', () => {
  it('every English line has a Russian original', () => {
    const ru = { ...ruWriter, ...ruExtra };
    for (const k of Object.keys(en)) expect(ru, k).toHaveProperty([k]);
  });
});
