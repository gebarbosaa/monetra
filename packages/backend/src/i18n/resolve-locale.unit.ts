import { resolveLocale } from '@bt/shared/i18n/locales';
import { describe, expect, it } from '@jest/globals';

describe('resolveLocale', () => {
  it.each([
    ['uk', 'uk'],
    ['UK', 'uk'],
    ['en-US', 'en'],
    ['de-AT', 'de'],
    ['fr-CA,fr;q=0.9,en;q=0.8', 'fr'],
    ['xx-YY, de;q=0.5', 'de'],
    ['', 'pt-BR'],
    [undefined, 'pt-BR'],
    [null, 'pt-BR'],
    ['pt-BR', 'pt-BR'],
    ['pt-br', 'pt-BR'],
    ['pt-PT', 'pt-BR'],
    ['pt', 'pt-BR'],
    ['pt-PT,pt-BR;q=0.5', 'pt-BR'],
  ])('resolves %p to %p', (tag, expected) => {
    expect(resolveLocale({ tag })).toBe(expected);
  });
});
