import type { AutomationStep } from './types';

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

export function getVar(vars: Record<string, unknown>, key: string): unknown {
  const parts = key.split('.');
  let cur: unknown = vars;
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

export function interpolateString(template: string, vars: Record<string, unknown>): string {
  return template.replace(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g, (_m, key) => {
    const v = getVar(vars, key);
    if (v === undefined || v === null) return '';
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
    return JSON.stringify(v);
  });
}

export function interpolateAny(value: unknown, vars: Record<string, unknown>): unknown {
  if (typeof value === 'string') return interpolateString(value, vars);
  if (Array.isArray(value)) return value.map((v) => interpolateAny(v, vars));
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = interpolateAny(v, vars);
    return out;
  }
  return value;
}

function decodePointerToken(t: string) {
  return t.replace(/~1/g, '/').replace(/~0/g, '~');
}

export function jsonPointerGet(doc: unknown, pointer: string): unknown {
  if (!pointer) return undefined;
  if (pointer === '/') return doc;
  if (!pointer.startsWith('/')) return undefined;
  const tokens = pointer.split('/').slice(1).map(decodePointerToken);
  let cur: unknown = doc;
  for (const tok of tokens) {
    if (Array.isArray(cur)) {
      const idx = Number(tok);
      if (!Number.isInteger(idx) || idx < 0 || idx >= cur.length) return undefined;
      cur = cur[idx];
      continue;
    }
    if (cur && typeof cur === 'object') {
      cur = (cur as Record<string, unknown>)[tok];
      continue;
    }
    return undefined;
  }
  return cur;
}

export function applySaveMappings(
  save: AutomationStep['save'] | undefined,
  data: unknown,
  vars: Record<string, unknown>
) {
  if (!save) return {};
  const saved: Record<string, unknown> = {};
  for (const [varName, pointers] of Object.entries(save)) {
    const list = Array.isArray(pointers) ? pointers : [pointers];
    let value: unknown = undefined;
    for (const p of list) {
      value = jsonPointerGet(data, p);
      if (value !== undefined) break;
    }
    if (value === undefined) continue;
    vars[varName] = value;
    saved[varName] = value;
  }
  return saved;
}
