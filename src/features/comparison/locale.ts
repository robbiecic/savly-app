// Some native engines implement NumberFormat but not formatToParts.
// Use the same separator for restoring preferences and parsing user input.
export function decimalSeparator(locale: string): string {
  const formatter = new Intl.NumberFormat(locale, { useGrouping: false });
  if (typeof formatter.formatToParts === 'function') {
    const separator = formatter.formatToParts(1.1).find((part) => part.type === 'decimal')?.value;
    if (separator) return separator;
  }
  // Removing both formatted ones also works with non-Latin numbering systems.
  return formatter.format(1.1).split(formatter.format(1)).join('') || '.';
}
