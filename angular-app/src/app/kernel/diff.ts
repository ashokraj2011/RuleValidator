/**
 * Decision-trace diff — the basis for regression detection. Compares two runs of
 * the same rule and reports which leaf conditions changed status, plus whether
 * the overall outcome flipped. Used to answer "what changed since last time?".
 */

import { EvalResult, EvalStatus, flattenConditions } from './evaluate';

export interface ConditionDelta {
  expression: string;
  from: EvalStatus | 'absent';
  to: EvalStatus | 'absent';
}

export interface TraceDiff {
  outcomeChanged: boolean;
  fromStatus: EvalStatus;
  toStatus: EvalStatus;
  changed: ConditionDelta[];
  /** number of leaf conditions that differ */
  changedCount: number;
}

function leafMap(trace: EvalResult): Map<string, EvalStatus> {
  const m = new Map<string, EvalStatus>();
  for (const leaf of flattenConditions(trace)) {
    if (leaf.operator === 'AND' || leaf.operator === 'OR' || leaf.operator === 'NOT') continue;
    m.set(leaf.expression, leaf.status);
  }
  return m;
}

/** Diff `before` → `after` for the same rule. */
export function diffTraces(before: EvalResult, after: EvalResult): TraceDiff {
  const a = leafMap(before);
  const b = leafMap(after);
  const keys = new Set([...a.keys(), ...b.keys()]);
  const changed: ConditionDelta[] = [];

  for (const key of keys) {
    const from = a.get(key) ?? 'absent';
    const to = b.get(key) ?? 'absent';
    if (from !== to) changed.push({ expression: key, from, to });
  }

  return {
    outcomeChanged: before.status !== after.status,
    fromStatus: before.status,
    toStatus: after.status,
    changed,
    changedCount: changed.length,
  };
}
