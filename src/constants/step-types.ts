import type { StepType } from '../types/automation';
import {
  Globe,
  MousePointer2,
  Keyboard,
  Database,
  Server,
  Camera,
  CheckCircle2,
  Clock,
  ArrowDown,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';

export interface StepTypeMeta {
  type: StepType;
  label: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  description: string;
  hasTarget: boolean;
  hasValue: boolean;
}

export const STEP_TYPE_META: Record<StepType, StepTypeMeta> = {
  navigate: {
    type: 'navigate',
    label: 'Navigate',
    icon: Globe,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    description: 'Navigate to a URL',
    hasTarget: false,
    hasValue: true,
  },
  click: {
    type: 'click',
    label: 'Click',
    icon: MousePointer2,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    description: 'Click an element',
    hasTarget: true,
    hasValue: false,
  },
  type: {
    type: 'type',
    label: 'Type',
    icon: Keyboard,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    description: 'Type text into an input',
    hasTarget: true,
    hasValue: true,
  },
  extract: {
    type: 'extract',
    label: 'Extract Data',
    icon: Database,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    description: 'Extract data from the page',
    hasTarget: true,
    hasValue: false,
  },
  screenshot: {
    type: 'screenshot',
    label: 'Screenshot',
    icon: Camera,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    description: 'Capture a screenshot',
    hasTarget: false,
    hasValue: false,
  },
  assert: {
    type: 'assert',
    label: 'Assert',
    icon: CheckCircle2,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    description: 'Verify a condition',
    hasTarget: true,
    hasValue: true,
  },
  wait: {
    type: 'wait',
    label: 'Wait',
    icon: Clock,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    description: 'Wait for a duration or condition',
    hasTarget: false,
    hasValue: true,
  },
  scroll: {
    type: 'scroll',
    label: 'Scroll',
    icon: ArrowDown,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    description: 'Scroll the page',
    hasTarget: true,
    hasValue: false,
  },
  select: {
    type: 'select',
    label: 'Select',
    icon: ChevronDown,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    description: 'Select a dropdown option',
    hasTarget: true,
    hasValue: true,
  },
  api: {
    type: 'api',
    label: 'API Call',
    icon: Server,
    color: 'text-teal-700',
    bgColor: 'bg-teal-50',
    description: 'Call an external API (ex: GoHighLevel)',
    hasTarget: false,
    hasValue: false,
  },
};

// The step builder UI can add basic browser steps; API steps are typically authored as part of
// prebuilt workflows (until we add a proper request editor).
export const STEP_TYPES_LIST = Object.values(STEP_TYPE_META).filter((m) => m.type !== 'api');
