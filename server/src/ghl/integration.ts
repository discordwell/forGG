import type { Db } from '../db';
import type { GhlIntegration } from './types';

const KEY = 'integration:ghl';

export function getGhlIntegration(db: Db): GhlIntegration | null {
  const raw = db.getKv(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as GhlIntegration;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!('accessToken' in parsed) || typeof parsed.accessToken !== 'string' || !parsed.accessToken) return null;
    if (!('capturedAt' in parsed) || typeof parsed.capturedAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setGhlIntegration(db: Db, integration: GhlIntegration) {
  db.setKv(KEY, JSON.stringify(integration));
}

export function clearGhlIntegration(db: Db) {
  db.deleteKv(KEY);
}

export function redactGhlIntegration(integration: GhlIntegration | null) {
  if (!integration) return { connected: false };
  return {
    connected: true,
    companyId: integration.companyId ?? null,
    userId: integration.userId ?? null,
    locationId: integration.locationId ?? null,
    hasTokenId: Boolean(integration.tokenId),
    capturedAt: integration.capturedAt,
  };
}

