import englishNames from './country-names.en.json';

// ISO 3166-1 residency choices are independent of shopping-country API support.
// Bundled English CLDR labels keep selectors usable on engines without DisplayNames.
const fallbackNames: Readonly<Record<string, string>> = englishNames;

function regionNames(locale: string): Intl.DisplayNames | null {
  if (typeof Intl === 'undefined' || typeof Intl.DisplayNames !== 'function') return null;
  try { return new Intl.DisplayNames([locale], { type: 'region' }); }
  catch { return null; }
}

function nameOf(code: string, names: Intl.DisplayNames | null): string {
  try { return names?.of(code) ?? fallbackNames[code] ?? code; }
  catch { return fallbackNames[code] ?? code; }
}

export function countryName(code: string, locale: string): string {
  return nameOf(code, regionNames(locale));
}

export function countryFlag(code: string): string {
  const region = code.toUpperCase();
  if (!Object.hasOwn(fallbackNames, region)) return '';
  return String.fromCodePoint(...Array.from(region, (letter) => 0x1F1E6 + letter.charCodeAt(0) - 65));
}

export function residenceOptions(locale: string) {
  const names = regionNames(locale);
  return Object.keys(fallbackNames).map((value) => ({ value, label: nameOf(value, names), flag: countryFlag(value) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
