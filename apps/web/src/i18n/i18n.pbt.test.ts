// Feature: contact-form-email, Property 20: All locale files contain every contact translation key
// Validates: Requirements 7.2

import * as fc from 'fast-check';
import * as en from './messages/en.json';
import * as vi from './messages/vi.json';
import * as ja from './messages/ja.json';

describe('i18n contact namespace coverage', () => {
  const contactKeys = Object.keys(en.contact);

  it('P20: vi.json has a non-empty string for every contact key in en.json', () => {
    fc.assert(
      fc.property(fc.constantFrom(...contactKeys), (key) => {
        const value = (vi.contact as Record<string, string>)[key];
        return typeof value === 'string' && value.trim().length > 0;
      }),
      { numRuns: contactKeys.length },
    );
  });

  it('P20: ja.json has a non-empty string for every contact key in en.json', () => {
    fc.assert(
      fc.property(fc.constantFrom(...contactKeys), (key) => {
        const value = (ja.contact as Record<string, string>)[key];
        return typeof value === 'string' && value.trim().length > 0;
      }),
      { numRuns: contactKeys.length },
    );
  });
});
