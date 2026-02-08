import { z } from 'zod';

export const AutomationStepSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    'navigate',
    'click',
    'type',
    'extract',
    'screenshot',
    'assert',
    'wait',
    'scroll',
    'select',
  ]),
  label: z.string().min(1),
  target: z.string().optional(),
  value: z.string().optional(),
  assertion: z.string().optional(),
  targetCoords: z
    .object({ x: z.number(), y: z.number() })
    .optional(),
  page: z.string().optional(),
  duration: z.number().int().positive().optional(),
  extractedData: z.record(z.unknown()).optional(),
});

export const CreateRunSchema = z.object({
  steps: z.array(AutomationStepSchema).min(1),
  speed: z.number().positive().optional(),
});

