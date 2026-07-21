import { LocalizedString } from '@jazz-portfolio/shared';

export function getTranslation(
  localized: LocalizedString | Record<string, string> | any,
  locale: string,
): string {
  if (!localized) return '';
  if (typeof localized === 'string') return localized;
  return localized[locale] || localized['en'] || '';
}
