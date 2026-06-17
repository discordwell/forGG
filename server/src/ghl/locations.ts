import { isPlainObject } from '../template';

export function firstLocationFromSearchResponse(data: unknown): { id: string; name?: string } | null {
  if (Array.isArray(data)) {
    const first = data[0];
    if (isPlainObject(first)) {
      const id = (typeof first._id === 'string' && first._id) || (typeof first.id === 'string' && first.id) || '';
      if (!id) return null;
      const name = typeof first.name === 'string' ? first.name : undefined;
      return { id, name };
    }
    return null;
  }
  if (isPlainObject(data)) {
    const locations = data.locations;
    if (Array.isArray(locations)) return firstLocationFromSearchResponse(locations);
  }
  return null;
}
