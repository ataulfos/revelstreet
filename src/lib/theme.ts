export type StopState = 'pending' | 'arrived' | 'departed' | 'success' | 'failed';

export interface StateColor {
  bg: string;
  text: string;
  border: string;
  hex: string;
}

export const STATE_COLORS: Record<StopState, StateColor> = {
  pending: {
    bg: 'bg-slate-700',
    text: 'text-slate-200',
    border: 'border-slate-500',
    hex: '#64748b',
  },
  arrived: {
    bg: 'bg-blue-700',
    text: 'text-blue-50',
    border: 'border-blue-400',
    hex: '#3b82f6',
  },
  departed: {
    bg: 'bg-amber-600',
    text: 'text-amber-50',
    border: 'border-amber-400',
    hex: '#f59e0b',
  },
  success: {
    bg: 'bg-emerald-700',
    text: 'text-emerald-50',
    border: 'border-emerald-400',
    hex: '#10b981',
  },
  failed: {
    bg: 'bg-rose-700',
    text: 'text-rose-50',
    border: 'border-rose-400',
    hex: '#f43f5e',
  },
};

export const FAILURE_REASONS: readonly string[] = [
  'Customer not home',
  'Address not accessible',
  'Weather / safety',
  'Package issue',
  'Other',
] as const;

export function stateClasses(state: StopState): string {
  const c = STATE_COLORS[state];
  return `${c.bg} ${c.text} ${c.border}`;
}
