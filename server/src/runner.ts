import fs from 'node:fs';
import path from 'node:path';
import { nanoid } from 'nanoid';
import { chromium, type Browser, type Page } from 'playwright';
import type { Db } from './db';
import type { AutomationStep, AuditLogEntry, RunEvent, Severity, StepStatus } from './types';
import type { RunSseHub } from './sse';
import { GhlClient, GhlHttpError } from './ghl/client';
import { getGhlIntegration, setGhlIntegration } from './ghl/integration';

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

function sandboxPathForPageKey(pageKey: string | undefined): string {
  if (!pageKey) return '/sandbox/google-search.html';
  return `/sandbox/${pageKey}.html`;
}

async function waitForUnpause(ctrl: RunControl) {
  while (ctrl.paused && !ctrl.aborted) {
    await sleep(100);
  }
}

function now() {
  return Date.now();
}

function addEvent(db: Db, hub: RunSseHub, runId: string, event: RunEvent) {
  db.addEvent({ runId, ts: event.ts, type: event.type, payloadJson: JSON.stringify(event) });
  hub.broadcast(runId, event);
}

function setStepStatus(db: Db, hub: RunSseHub, runId: string, index: number, status: StepStatus) {
  addEvent(db, hub, runId, { type: 'step_status', runId, ts: now(), index, status });
}

function addAudit(db: Db, hub: RunSseHub, runId: string, entry: AuditLogEntry) {
  addEvent(db, hub, runId, { type: 'audit_entry', runId, ts: now(), entry });
}

function severityForStep(stepType: string): Severity {
  switch (stepType) {
    case 'extract':
    case 'assert':
    case 'api':
      return 'success';
    default:
      return 'info';
  }
}

async function maybeScrollToTarget(page: Page, step: AutomationStep) {
  if (!step.target) return;
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return;
    el.scrollIntoView({ behavior: 'instant', block: 'center' as ScrollLogicalPosition });
  }, step.target);
}

async function extractForStep(page: Page, step: AutomationStep): Promise<Record<string, unknown>> {
  // Structured extraction for our sandbox pages. If a step contains extractedData,
  // we still prefer live extraction to keep the backend "real".
  const key = step.page ?? '';
  if (key === 'wix-guesthouse') {
    return await page.evaluate(() => {
      const txt = (sel: string) => document.querySelector(sel)?.textContent?.trim() ?? '';
      return {
        propertyName: txt('[data-field="propertyName"]'),
        oceanViewRoom: txt('[data-room="ocean"] [data-field="price"]'),
        gardenRoom: txt('[data-room="garden"] [data-field="price"]'),
        dormBed: txt('[data-room="dorm"] [data-field="price"]'),
        checkInTime: txt('[data-field="checkIn"]'),
        checkOutTime: txt('[data-field="checkOut"]'),
        languages: Array.from(document.querySelectorAll('[data-field="lang"]')).map((n) => n.textContent?.trim()).filter(Boolean),
      };
    });
  }

  if (key === 'booking-listing') {
    return await page.evaluate(() => {
      const txt = (sel: string) => document.querySelector(sel)?.textContent?.trim() ?? '';
      const num = (sel: string) => {
        const t = txt(sel).replace(/[^0-9.]/g, '');
        const n = Number(t);
        return Number.isFinite(n) ? n : null;
      };
      const int = (sel: string) => {
        const t = txt(sel).replace(/[^0-9]/g, '');
        const n = Number(t);
        return Number.isFinite(n) ? n : null;
      };
      return {
        propertyName: txt('[data-field="propertyName"]'),
        rating: num('[data-field="rating"]'),
        reviewCount: int('[data-field="reviewCount"]'),
        pricePerNight: txt('[data-field="pricePerNight"]'),
        location: txt('[data-field="location"]'),
        freeCancel: txt('[data-field="freeCancel"]') === 'true',
        breakfastIncluded: txt('[data-field="breakfastIncluded"]') === 'true',
        lastBooked: txt('[data-field="lastBooked"]'),
      };
    });
  }

  if (key === 'agoda-listing') {
    return await page.evaluate(() => {
      const txt = (sel: string) => document.querySelector(sel)?.textContent?.trim() ?? '';
      const num = (sel: string) => {
        const t = txt(sel).replace(/[^0-9.]/g, '');
        const n = Number(t);
        return Number.isFinite(n) ? n : null;
      };
      const int = (sel: string) => {
        const t = txt(sel).replace(/[^0-9]/g, '');
        const n = Number(t);
        return Number.isFinite(n) ? n : null;
      };
      return {
        propertyName: txt('[data-field="propertyName"]'),
        agodaRating: num('[data-field="agodaRating"]'),
        agodaPrice: txt('[data-field="agodaPrice"]'),
        discountPercent: txt('[data-field="discountPercent"]'),
        memberDeal: txt('[data-field="memberDeal"]') === 'true',
        roomsLeft: int('[data-field="roomsLeft"]'),
        includesTax: txt('[data-field="includesTax"]') === 'true',
      };
    });
  }

  // Fallback: dump text for target selector.
  if (step.target) {
    const text = await page.locator(step.target).first().textContent().catch(() => null);
    return { target: step.target, text: (text ?? '').trim() };
  }
  return {};
}

function getVar(vars: Record<string, unknown>, key: string): unknown {
  const parts = key.split('.');
  let cur: unknown = vars;
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function interpolateString(template: string, vars: Record<string, unknown>): string {
  return template.replace(/{{\\s*([a-zA-Z0-9_.-]+)\\s*}}/g, (_m, key) => {
    const v = getVar(vars, key);
    if (v === undefined || v === null) return '';
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
    return JSON.stringify(v);
  });
}

function interpolateAny(value: unknown, vars: Record<string, unknown>): unknown {
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

function jsonPointerGet(doc: unknown, pointer: string): unknown {
  if (!pointer) return undefined;
  if (pointer === '/' || pointer === '') return doc;
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

function applySaveMappings(
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

function firstLocationFromSearchResponse(data: unknown): { id: string; name?: string } | null {
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

async function assertForStep(page: Page, step: AutomationStep) {
  if (!step.target) throw new Error('assert step missing target');
  const assertion = step.assertion ?? 'equals';
  const expected = step.value ?? '';
  const actualRaw = await page.locator(step.target).first().textContent().catch(() => null);
  const actual = (actualRaw ?? '').trim();

  if (assertion === 'contains') {
    if (!actual.includes(expected)) throw new Error(`Assertion failed: expected "${actual}" to contain "${expected}"`);
    return;
  }

  if (assertion === 'equals') {
    if (actual !== expected) throw new Error(`Assertion failed: expected "${actual}" to equal "${expected}"`);
    return;
  }

  if (assertion === 'greaterThan') {
    // expected value like "> 50" (from existing scenario)
    const thresholdStr = expected.replace(/[^0-9]/g, '');
    const threshold = Number(thresholdStr);
    const actualNum = Number(actual.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(threshold) || !Number.isFinite(actualNum)) {
      throw new Error(`Assertion failed: unable to compare "${actual}" > "${expected}"`);
    }
    if (!(actualNum > threshold)) throw new Error(`Assertion failed: expected ${actualNum} > ${threshold}`);
    return;
  }

  throw new Error(`Unsupported assertion: ${assertion}`);
}

export interface RunControl {
  aborted: boolean;
  paused: boolean;
  speed: number;
}

export class Runner {
  private running = false;
  private readonly queue: Array<{ runId: string; steps: AutomationStep[] }> = [];
  private readonly controls = new Map<string, RunControl>();

  constructor(
    private readonly db: Db,
    private readonly hub: RunSseHub,
    private readonly opts: { artifactsDir: string; origin: string }
  ) {
    fs.mkdirSync(opts.artifactsDir, { recursive: true });
  }

  enqueue(runId: string, steps: AutomationStep[], speed: number) {
    this.controls.set(runId, { aborted: false, paused: false, speed: Math.max(0.1, speed || 1) });
    this.queue.push({ runId, steps });
    this.process().catch(() => {});
  }

  pause(runId: string) {
    const ctrl = this.controls.get(runId);
    if (!ctrl) return;
    ctrl.paused = true;
    addEvent(this.db, this.hub, runId, { type: 'run_paused', runId, ts: now() });
    this.db.updateRun({ id: runId, status: 'paused' });
  }

  resume(runId: string) {
    const ctrl = this.controls.get(runId);
    if (!ctrl) return;
    ctrl.paused = false;
    addEvent(this.db, this.hub, runId, { type: 'run_resumed', runId, ts: now() });
    this.db.updateRun({ id: runId, status: 'running' });
  }

  abort(runId: string) {
    const ctrl = this.controls.get(runId);
    if (!ctrl) return;
    ctrl.aborted = true;
    addEvent(this.db, this.hub, runId, { type: 'run_aborted', runId, ts: now() });
    this.db.updateRun({ id: runId, status: 'aborted', endedAt: now() });
  }

  private async process() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length > 0) {
        const next = this.queue.shift();
        if (!next) break;
        await this.runOne(next.runId, next.steps);
      }
    } finally {
      this.running = false;
    }
  }

  private async runOne(runId: string, steps: AutomationStep[]) {
    const ctrl = this.controls.get(runId);
    if (!ctrl) return;

    const startedAt = now();
    this.db.updateRun({ id: runId, status: 'running', startedAt });
    addEvent(this.db, this.hub, runId, { type: 'run_started', runId, ts: startedAt });

    const vars: Record<string, unknown> = {
      runId,
      runKey: nanoid(10),
      startedAt,
      startedAtIso: new Date(startedAt).toISOString(),
    };

    // Seed vars with whatever we have from the integration store (if connected).
    const initialIntegration = getGhlIntegration(this.db);
    if (initialIntegration?.companyId) vars.companyId = initialIntegration.companyId;
    if (initialIntegration?.userId) vars.userId = initialIntegration.userId;
    if (initialIntegration?.locationId) vars.locationId = initialIntegration.locationId;

    let browser: Browser | null = null;
    let page: Page | null = null;

    const ensurePage = async () => {
      if (page) return page;
      browser = await chromium.launch();
      page = await browser.newPage({ viewport: { width: 980, height: 640 } });
      return page;
    };
    try {
      for (let i = 0; i < steps.length; i++) {
        if (ctrl.aborted) break;
        await waitForUnpause(ctrl);
        if (ctrl.aborted) break;

        const step = steps[i];
        addEvent(this.db, this.hub, runId, { type: 'step_started', runId, ts: now(), index: i, step });
        setStepStatus(this.db, this.hub, runId, i, 'running');

        // UI hints (cursor, page, typing) so the existing frontend stays lively.
        if (step.page) {
          addEvent(this.db, this.hub, runId, { type: 'ui', runId, ts: now(), action: { kind: 'page', page: step.page } });
        }
        if (step.targetCoords) {
          addEvent(this.db, this.hub, runId, { type: 'ui', runId, ts: now(), action: { kind: 'cursor', position: step.targetCoords } });
        }

        const t0 = now();
        let message = '';
        let severity: Severity = severityForStep(step.type);
        let extras: Partial<AuditLogEntry> = {};

        try {
          const delay = async (ms: number) => sleep(ms / ctrl.speed);

          switch (step.type) {
            case 'navigate': {
              const p = await ensurePage();
              const url = new URL(sandboxPathForPageKey(step.page), this.opts.origin).toString();
              await p.goto(url, { waitUntil: 'domcontentloaded' });
              await delay(250);
              message = `Navigated to ${step.value ?? url}`;
              break;
            }
            case 'click': {
              if (!step.target) throw new Error('click step missing target');
              const p = await ensurePage();
              await maybeScrollToTarget(p, step);
              await p.click(step.target);
              await delay(200);
              message = `Clicked element: ${step.target || step.label}`;
              break;
            }
            case 'type': {
              if (!step.target) throw new Error('type step missing target');
              const p = await ensurePage();
              const text = step.value ?? '';
              await maybeScrollToTarget(p, step);
              await p.click(step.target);
              await p.fill(step.target, '');
              addEvent(this.db, this.hub, runId, { type: 'ui', runId, ts: now(), action: { kind: 'typing', target: step.target, text: '' } });
              for (let c = 0; c <= text.length; c++) {
                if (ctrl.aborted) break;
                await waitForUnpause(ctrl);
                if (ctrl.aborted) break;
                const partial = text.slice(0, c);
                addEvent(this.db, this.hub, runId, { type: 'ui', runId, ts: now(), action: { kind: 'typing', target: step.target, text: partial } });
                await delay(15 + Math.random() * 20);
              }
              await p.fill(step.target, text);
              addEvent(this.db, this.hub, runId, { type: 'ui', runId, ts: now(), action: { kind: 'typing', target: step.target, text: '' } });
              message = `Typed "${text}" into ${step.target}`;
              break;
            }
            case 'wait': {
              const waitMs = parseInt(step.value || String(step.duration ?? '1000'), 10) || 1000;
              await delay(waitMs);
              message = `Waited ${waitMs}ms`;
              break;
            }
            case 'scroll': {
              const p = await ensurePage();
              await maybeScrollToTarget(p, step);
              await delay(200);
              message = `Scrolled to ${step.target ?? 'target'}`;
              break;
            }
            case 'select': {
              if (!step.target) throw new Error('select step missing target');
              const p = await ensurePage();
              const value = step.value ?? '';
              await maybeScrollToTarget(p, step);
              await p.selectOption(step.target, { label: value }).catch(async () => {
                await p.selectOption(step.target, { value });
              });
              await delay(250);
              message = `Selected "${value}" from ${step.target}`;
              break;
            }
            case 'assert': {
              const p = await ensurePage();
              await maybeScrollToTarget(p, step);
              await assertForStep(p, step);
              await delay(120);
              message = `Assertion passed: ${step.target} ${step.assertion || 'equals'} "${step.value}"`;
              severity = 'success';
              break;
            }
            case 'extract': {
              addEvent(this.db, this.hub, runId, { type: 'ui', runId, ts: now(), action: { kind: 'scanline', show: true } });
              const p = await ensurePage();
              await maybeScrollToTarget(p, step);
              const extracted = await extractForStep(p, step);
              await delay(400);
              addEvent(this.db, this.hub, runId, { type: 'ui', runId, ts: now(), action: { kind: 'scanline', show: false } });
              message = `Extracted data from ${step.target ?? step.page ?? 'page'}`;
              severity = 'success';
              extras = { extractedData: extracted };
              break;
            }
            case 'screenshot': {
              const p = await ensurePage();
              const runDir = path.join(this.opts.artifactsDir, runId);
              fs.mkdirSync(runDir, { recursive: true });
              const filename = `screenshot_step_${i + 1}.png`;
              const filePath = path.join(runDir, filename);
              addEvent(this.db, this.hub, runId, { type: 'ui', runId, ts: now(), action: { kind: 'flash', show: true } });
              await p.screenshot({ path: filePath, fullPage: true });
              addEvent(this.db, this.hub, runId, { type: 'ui', runId, ts: now(), action: { kind: 'flash', show: false } });
              await delay(180);
              message = 'Screenshot captured';
              extras = { screenshotUrl: `/artifacts/${runId}/${filename}` };
              break;
            }
            case 'api': {
              if (!step.api) throw new Error('api step missing api config');
              if (step.api.service !== 'ghl') throw new Error(`Unsupported api service: ${step.api.service}`);

              let integration = getGhlIntegration(this.db);
              if (!integration) {
                throw new Error('GHL not connected. Open /api/integrations/ghl/bridge and capture a token first.');
              }

              // Keep vars in sync with integration (and vice versa).
              if (integration.companyId) vars.companyId = integration.companyId;
              if (integration.userId) vars.userId = integration.userId;
              if (integration.locationId) vars.locationId = integration.locationId;

              let autoSelectedLocation: { id: string; name?: string } | null = null;
              if (!integration.locationId && integration.companyId) {
                const ghl = new GhlClient(integration);
                const locs = await ghl.request({ method: 'GET', path: '/locations/search', query: { companyId: integration.companyId }, timeoutMs: 20_000 });
                const first = firstLocationFromSearchResponse(locs.data);
                if (first) {
                  integration = { ...integration, locationId: first.id };
                  setGhlIntegration(this.db, integration);
                  vars.locationId = first.id;
                  autoSelectedLocation = first;
                }
              }

              const apiPath = interpolateString(step.api.path, vars);
              const query = (interpolateAny(step.api.query ?? {}, vars) || {}) as Record<string, unknown>;
              const body = interpolateAny(step.api.body, vars);

              const injectLocationId = step.api.injectLocationId !== false;
              if (injectLocationId && integration.locationId) {
                if (query.locationId === undefined) query.locationId = integration.locationId;
                if (isPlainObject(body) && body.locationId === undefined) body.locationId = integration.locationId;
              }

              addEvent(this.db, this.hub, runId, { type: 'ui', runId, ts: now(), action: { kind: 'scanline', show: true } });

              const ghl = new GhlClient(integration);
              const res = await (async () => {
                try {
                  return await ghl.request({
                    method: step.api.method,
                    path: apiPath,
                    query: query as Record<string, string | number | boolean | null | undefined>,
                    body,
                    timeoutMs: step.api.timeoutMs,
                  });
                } finally {
                  addEvent(this.db, this.hub, runId, { type: 'ui', runId, ts: now(), action: { kind: 'scanline', show: false } });
                }
              })();

              const saved = applySaveMappings(step.save, res.data, vars);
              await delay(250);

              message = `[GHL] ${step.api.method} ${apiPath} -> ${res.status}`;
              severity = 'success';
              extras = {
                extractedData: {
                  service: 'ghl',
                  request: { method: step.api.method, path: apiPath, query, body },
                  response: { status: res.status, url: res.url, data: res.data },
                  saved,
                  autoSelectedLocation,
                },
              };
              break;
            }
          }

          const durationMs = Math.max(0, now() - t0);
          setStepStatus(this.db, this.hub, runId, i, 'passed');

          const entry: AuditLogEntry = {
            id: nanoid(),
            stepId: step.id,
            stepIndex: i,
            timestamp: new Date().toISOString(),
            type: step.type,
            label: step.label,
            severity,
            message,
            status: 'passed',
            duration: durationMs,
            ...extras,
          };
          addAudit(this.db, this.hub, runId, entry);
        } catch (err) {
          setStepStatus(this.db, this.hub, runId, i, 'failed');
          let msg = err instanceof Error ? err.message : String(err);
          if (err instanceof GhlHttpError && (err.status === 401 || err.status === 403)) {
            msg = `GHL auth expired/unauthorized (${err.status}). Reconnect via /api/integrations/ghl/bridge and try again.`;
          }
          const entry: AuditLogEntry = {
            id: nanoid(),
            stepId: step.id,
            stepIndex: i,
            timestamp: new Date().toISOString(),
            type: step.type,
            label: step.label,
            severity: 'error',
            message: msg,
            status: 'failed',
          };
          addAudit(this.db, this.hub, runId, entry);
          throw err;
        } finally {
          await sleep(80 / ctrl.speed);
        }
      }

      if (ctrl.aborted) return;
      this.db.updateRun({ id: runId, status: 'completed', endedAt: now() });
      addEvent(this.db, this.hub, runId, { type: 'run_completed', runId, ts: now() });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.db.updateRun({ id: runId, status: 'failed', endedAt: now(), error: msg });
      addEvent(this.db, this.hub, runId, { type: 'run_failed', runId, ts: now(), error: msg });
    } finally {
      if (page) await page.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
      this.controls.delete(runId);
    }
  }
}
