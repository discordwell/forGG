import { useEffect, useRef, useCallback } from 'react';
import { nanoid } from 'nanoid';
import type { AutomationStep, AuditLogEntry, Severity } from '../types/automation';
import { useAutomation, useAutomationDispatch } from '../context/AutomationContext';

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function useAutomationEngine() {
  const { steps, execution } = useAutomation();
  const dispatch = useAutomationDispatch();
  const abortRef = useRef(false);
  const pauseRef = useRef(false);
  const speedRef = useRef(execution.speed);
  const runningRef = useRef(false);
  const stepsRef = useRef(steps);

  // Keep refs in sync
  stepsRef.current = steps;
  speedRef.current = execution.speed;
  pauseRef.current = execution.status === 'paused';

  const scaledDelay = useCallback(
    (ms: number) => sleep(ms / speedRef.current),
    []
  );

  const waitForUnpause = useCallback(async () => {
    while (pauseRef.current && !abortRef.current) {
      await sleep(100);
    }
  }, []);

  const executeStep = useCallback(
    async (step: AutomationStep, index: number) => {
      if (abortRef.current) return;
      await waitForUnpause();

      dispatch({ type: 'SET_STEP_INDEX', index });
      dispatch({ type: 'SET_STEP_STATUS', index, status: 'running' });

      // Navigate to the right page
      if (step.page) {
        dispatch({ type: 'SET_CURRENT_PAGE', page: step.page });
        await scaledDelay(400);
      }

      // Move cursor to target
      if (step.targetCoords) {
        dispatch({ type: 'SET_CURSOR_POSITION', position: step.targetCoords });
        await scaledDelay(600);
      }

      let auditMessage = '';
      let severity: Severity = 'info';
      let extras: Partial<AuditLogEntry> = {};

      switch (step.type) {
        case 'navigate':
          auditMessage = `Navigated to ${step.value}`;
          severity = 'info';
          await scaledDelay(500);
          break;

        case 'click':
          if (step.targetCoords) {
            dispatch({ type: 'SET_RIPPLE', position: step.targetCoords });
            dispatch({
              type: 'SET_HIGHLIGHT',
              highlight: {
                x: step.targetCoords.x - 60,
                y: step.targetCoords.y - 15,
                w: 120,
                h: 30,
              },
            });
          }
          auditMessage = `Clicked element: ${step.target || step.label}`;
          severity = 'info';
          await scaledDelay(400);
          dispatch({ type: 'SET_RIPPLE', position: null });
          dispatch({ type: 'SET_HIGHLIGHT', highlight: null });
          break;

        case 'type': {
          const text = step.value || '';
          if (step.targetCoords) {
            dispatch({
              type: 'SET_HIGHLIGHT',
              highlight: {
                x: step.targetCoords.x - 120,
                y: step.targetCoords.y - 15,
                w: 240,
                h: 30,
              },
            });
          }
          for (let i = 0; i <= text.length; i++) {
            if (abortRef.current) return;
            await waitForUnpause();
            dispatch({
              type: 'SET_TYPING',
              text: text.slice(0, i),
              target: step.target || '',
            });
            await scaledDelay(40 + Math.random() * 40);
          }
          auditMessage = `Typed "${text}" into ${step.target}`;
          severity = 'info';
          await scaledDelay(200);
          dispatch({ type: 'SET_TYPING', text: '', target: '' });
          dispatch({ type: 'SET_HIGHLIGHT', highlight: null });
          break;
        }

        case 'extract':
          dispatch({ type: 'SET_SCANLINE', show: true });
          if (step.targetCoords) {
            dispatch({
              type: 'SET_HIGHLIGHT',
              highlight: {
                x: step.targetCoords.x - 100,
                y: step.targetCoords.y - 60,
                w: 200,
                h: 120,
              },
            });
          }
          auditMessage = `Extracted data from ${step.target}`;
          severity = 'success';
          extras = { extractedData: step.extractedData };
          await scaledDelay(1200);
          dispatch({ type: 'SET_SCANLINE', show: false });
          dispatch({ type: 'SET_HIGHLIGHT', highlight: null });
          break;

        case 'screenshot':
          dispatch({ type: 'SET_FLASH', show: true });
          auditMessage = 'Screenshot captured';
          severity = 'info';
          extras = { screenshotUrl: `screenshot_step_${index + 1}.png` };
          await scaledDelay(400);
          dispatch({ type: 'SET_FLASH', show: false });
          break;

        case 'assert':
          if (step.targetCoords) {
            dispatch({
              type: 'SET_HIGHLIGHT',
              highlight: {
                x: step.targetCoords.x - 80,
                y: step.targetCoords.y - 15,
                w: 160,
                h: 30,
              },
            });
          }
          auditMessage = `Assertion passed: ${step.target} ${step.assertion || 'equals'} "${step.value}"`;
          severity = 'success';
          await scaledDelay(600);
          dispatch({ type: 'SET_HIGHLIGHT', highlight: null });
          break;

        case 'wait':
          auditMessage = `Waited ${step.value || '1000'}ms`;
          severity = 'info';
          await scaledDelay(parseInt(step.value || '1000', 10));
          break;

        case 'scroll':
          auditMessage = `Scrolled to ${step.target}`;
          severity = 'info';
          if (step.targetCoords) {
            dispatch({
              type: 'SET_CURSOR_POSITION',
              position: step.targetCoords,
            });
          }
          await scaledDelay(500);
          break;

        case 'select':
          if (step.targetCoords) {
            dispatch({
              type: 'SET_HIGHLIGHT',
              highlight: {
                x: step.targetCoords.x - 120,
                y: step.targetCoords.y - 15,
                w: 240,
                h: 30,
              },
            });
          }
          dispatch({
            type: 'SET_TYPING',
            text: step.value || '',
            target: step.target || '',
          });
          auditMessage = `Selected "${step.value}" from ${step.target}`;
          severity = 'info';
          await scaledDelay(800);
          dispatch({ type: 'SET_TYPING', text: '', target: '' });
          dispatch({ type: 'SET_HIGHLIGHT', highlight: null });
          break;
      }

      dispatch({ type: 'SET_STEP_STATUS', index, status: 'passed' });

      const entry: AuditLogEntry = {
        id: nanoid(),
        stepId: step.id,
        stepIndex: index,
        timestamp: new Date(),
        type: step.type,
        label: step.label,
        severity,
        message: auditMessage,
        status: 'passed',
        duration: Math.round(100 + Math.random() * 400),
        ...extras,
      };
      dispatch({ type: 'ADD_AUDIT_ENTRY', entry });
    },
    [dispatch, scaledDelay, waitForUnpause]
  );

  // Main execution loop — triggered when START_EXECUTION sets status to 'running' and index to 0
  useEffect(() => {
    if (execution.status !== 'running' || execution.currentStepIndex !== 0 || runningRef.current) {
      return;
    }

    runningRef.current = true;
    abortRef.current = false;

    async function runAllSteps() {
      const allSteps = stepsRef.current;
      for (let i = 0; i < allSteps.length; i++) {
        if (abortRef.current) break;
        await waitForUnpause();
        if (abortRef.current) break;

        await executeStep(allSteps[i], i);

        if (abortRef.current) break;

        await scaledDelay(300);
      }

      runningRef.current = false;
      if (!abortRef.current) {
        dispatch({ type: 'COMPLETE_EXECUTION' });
      }
    }

    runAllSteps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execution.status, execution.currentStepIndex]);

  // Handle stop / reset
  useEffect(() => {
    if (execution.status === 'idle' || execution.status === 'completed') {
      abortRef.current = true;
      runningRef.current = false;
    }
  }, [execution.status]);
}
