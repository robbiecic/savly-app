import type { PhotoStorage } from './saved-comparisons';
export function photoSource(uri: string): string { return uri; }
// Web previews keep the bounded JPEG in browser storage; no temporary blob URLs.
export const itemPhotos: PhotoStorage = {
  async persist(uri) { return uri; }, async remove() {}, async clear() {},
};
