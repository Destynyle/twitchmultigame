/**
 * Normalizes a string for fuzzy comparison:
 * - converts to lowercase
 * - strips accents / diacritics
 * - removes non-alphanumeric characters (keeps spaces)
 * - collapses consecutive whitespace
 */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // keep only alphanumeric + spaces
    .replace(/\s+/g, ' ')
    .trim()
}
