/**
 * Client-side parsing of a GoHighLevel `/locations/search` response (proxied
 * through `GET /api/integrations/ghl/locations`, which returns the raw GHL
 * body).
 *
 * Tolerance here mirrors the server's `firstLocationFromSearchResponse`
 * (`server/src/ghl/locations.ts`): a location's id may arrive as `_id` (the
 * captured internal `backend.leadconnectorhq.com` shape) or `id` (the public
 * v2 shape), and the list may be a bare array or wrapped in a
 * `{ locations: [...] }` envelope. Each location is normalized to a single
 * `id` field so the rest of the UI never has to care which key was present.
 *
 * (The header previously accepted only `_id`, so an `id`-only location that
 * the server happily auto-selected was silently dropped from the dropdown,
 * leaving the user unable to switch locations.)
 */
export interface GhlLocation {
  id: string;
  name?: string;
  timezone?: string;
}

function normalizeLocation(value: unknown): GhlLocation | null {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  const id =
    (typeof obj._id === 'string' && obj._id) ||
    (typeof obj.id === 'string' && obj.id) ||
    '';
  if (!id) return null;
  const name = typeof obj.name === 'string' ? obj.name : undefined;
  const timezone = typeof obj.timezone === 'string' ? obj.timezone : undefined;
  return { id, name, timezone };
}

/** Pull a normalized location list out of whatever GHL returned. */
export function parseGhlLocations(data: unknown): GhlLocation[] {
  const list: unknown[] = Array.isArray(data)
    ? data
    : isLocationsEnvelope(data)
      ? data.locations
      : [];

  const out: GhlLocation[] = [];
  for (const item of list) {
    const loc = normalizeLocation(item);
    if (loc) out.push(loc);
  }
  return out;
}

function isLocationsEnvelope(data: unknown): data is { locations: unknown[] } {
  return (
    Boolean(data) &&
    typeof data === 'object' &&
    Array.isArray((data as { locations?: unknown }).locations)
  );
}
