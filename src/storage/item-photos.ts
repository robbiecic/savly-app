import { Directory, File, Paths } from 'expo-file-system';
import type { PhotoStorage } from './saved-comparisons';

const folder = () => new Directory(Paths.document, 'saved-item-photos');
export function photoSource(uri: string): string {
  return uri.startsWith('savly-photo:') ? new File(folder(), uri.slice('savly-photo:'.length)).uri : uri;
}
export const itemPhotos: PhotoStorage = {
  async persist(uri) {
    if (uri.startsWith('savly-photo:')) return uri;
    const directory = folder();
    directory.create({ intermediates: true, idempotent: true });
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const file = new File(directory, name);
    try { file.write(uri.slice('data:image/jpeg;base64,'.length), { encoding: 'base64' }); }
    catch (error) { if (file.exists) file.delete(); throw error; }
    return `savly-photo:${name}`;
  },
  async remove(uri) {
    if (!uri.startsWith('savly-photo:')) return;
    const file = new File(photoSource(uri));
    if (file.exists) file.delete();
  },
  async clear() { const directory = folder(); if (directory.exists) directory.delete(); },
};
