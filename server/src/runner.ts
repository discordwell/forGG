import fs from 'node:fs';
import path from 'node:path';
import { nanoid } from 'nanoid';
import { chromium, type Browser, type Page } from 'playwright';
import type { Db } from './db';
import type { AutomationStep, AuditLogEntry, RunEvent, Severity, StepStatus } from './types';
import type { RunSseHub } from './sse';
import { GhlClient, GhlHttpError } from './ghl/client';
import { getGhlIntegration, setGhlIntegration } from './ghl/integration';
import { firstLocationFromSearchResponse } from './ghl/locations';
import { applySaveMappings, interpolateAny, interpolateString, isPlainObject } from './template';

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function sandboxPathForPageKey(pageKey: string | undefined): string {
  if (!pageKey) return '/sandbox/blank.html';
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
  // Fallback: dump text for target selector.
  if (step.target) {
    const text = await page.locator(step.target).first().textContent().catch(() => null);
    return { target: step.target, text: (text ?? '').trim() };
  }
  return {};
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
    if (ctrl.aborted) {
      // Aborted while still queued: abort() already marked the run; don't
      // flip it back to 'running'.
      this.controls.delete(runId);
      return;
    }

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
              const parsed = parseInt(step.value || String(step.duration ?? '1000'), 10);
              // An explicit 0 is a valid wait; only NaN falls back to 1s.
              const waitMs = Number.isFinite(parsed) ? Math.max(0, parsed) : 1000;
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
              const target = step.target;
              const p = await ensurePage();
              const value = step.value ?? '';
              await maybeScrollToTarget(p, step);
              await p.selectOption(target, { label: value }).catch(async () => {
                await p.selectOption(target, { value });
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
              const api = step.api;
              if (api.service !== 'ghl') throw new Error(`Unsupported api service: ${api.service}`);

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

              const apiPath = interpolateString(api.path, vars);
              const query = (interpolateAny(api.query ?? {}, vars) || {}) as Record<string, unknown>;
              const body = interpolateAny(api.body, vars);

              const injectLocationId = api.injectLocationId !== false;
              if (injectLocationId && integration.locationId) {
                if (query.locationId === undefined) query.locationId = integration.locationId;
                if (isPlainObject(body) && body.locationId === undefined) body.locationId = integration.locationId;
              }

              addEvent(this.db, this.hub, runId, { type: 'ui', runId, ts: now(), action: { kind: 'scanline', show: true } });

              const ghl = new GhlClient(integration);
              const res = await (async () => {
                try {
                  return await ghl.request({
                    method: api.method,
                    path: apiPath,
                    query: query as Record<string, string | number | boolean | null | undefined>,
                    body,
                    timeoutMs: api.timeoutMs,
                  });
                } finally {
                  addEvent(this.db, this.hub, runId, { type: 'ui', runId, ts: now(), action: { kind: 'scanline', show: false } });
                }
              })();

              const saved = applySaveMappings(step.save, res.data, vars);
              await delay(250);

              message = `[GHL] ${api.method} ${apiPath} -> ${res.status}`;
              severity = 'success';
              extras = {
                extractedData: {
                  service: 'ghl',
                  request: { method: api.method, path: apiPath, query, body },
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
      // A step failing while the run is being aborted must not overwrite the
      // terminal 'aborted' state abort() already recorded.
      if (ctrl.aborted) return;
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
