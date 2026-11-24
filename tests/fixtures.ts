import type { PhotoItem } from '../src/shared/types';

export function photo(id: string, overrides: Partial<PhotoItem> = {}): PhotoItem {
  return {
    id,
    url: `https://photos.google.com/photo/${id}`,
    thumbUrl: `https://lh3.googleusercontent.com/${id}=w224-h224`,
    takenAt: '2021-03-03',
    aspect: 9 / 19.5,
    kind: 'photo',
    label: '',
    ...overrides,
  };
}
