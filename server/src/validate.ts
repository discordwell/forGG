import { z } from 'zod';

const ApiStepSchema = z.object({
  service: z.enum(['ghl']),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  path: z.string().min(1),
  query: z
    .record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional(),
  body: z.unknown().optional(),
  timeoutMs: z.number().int().positive().optional(),
  injectLocationId: z.boolean().optional(),
});

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
    'api',
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
  api: ApiStepSchema.optional(),
  save: z.record(z.union([z.string(), z.array(z.string())])).optional(),
}).superRefine((step, ctx) => {
  if (step.type === 'api' && !step.api) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['api'],
      message: 'api step requires api config',
    });
  }
});

export const CreateRunSchema = z.object({
  steps: z.array(AutomationStepSchema).min(1),
  speed: z.number().positive().optional(),
});
