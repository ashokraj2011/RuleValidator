/**
 * Condition / branch coverage (MC/DC-flavoured). For boolean rules the question
 * a tester actually has is: "which conditions have I exercised both ways?" Each
 * leaf condition has two branches — evaluated TRUE and evaluated FALSE — and full
 * coverage means every branch has been taken by some run in the suite.
 *
 * Coverage is COMPUTED from recorded decision traces, never stored as a literal.
 */

import { EvalResult, flattenConditions } from './evaluate';

export interface ConditionCoverage {
  expression: string;
  namespace?: string;
  attribute?: string;
  operator: string;
  trueSeen: number;
  falseSeen: number;
  unknownSeen: number;
  shortCircuited: number;
  /** both TRUE and FALSE branches have been taken at least once */
  fullyCovered: boolean;
}

export interface CoverageReport {
  conditions: ConditionCoverage[];
  totalConditions: number;
  /** branches = 2 per condition (true + false) */
  totalBranches: number;
  coveredBranches: number;
  branchCoveragePct: number;
  /** conditions with both branches taken */
  fullyCovered: number;
  /** conditions never evaluated at all (only ever short-circuited / absent) */
  uncovered: number;
}

/** Build a coverage report from a set of evaluation traces (one per run). */
export function computeCoverage(traces: EvalResult[]): CoverageReport {
  const map = new Map<string, ConditionCoverage>();

  for (const trace of traces) {
    for (const leaf of flattenConditions(trace)) {
      if (leaf.operator === 'ref' || leaf.operator === 'unknown') continue;
      const key = leaf.expression;
      let c = map.get(key);
      if (!c) {
        c = {
          expression: leaf.expression,
          namespace: leaf.namespace,
          attribute: leaf.attribute,
          operator: leaf.operator,
          trueSeen: 0,
          falseSeen: 0,
          unknownSeen: 0,
          shortCircuited: 0,
          fullyCovered: false,
        };
        map.set(key, c);
      }
      if (leaf.shortCircuited || leaf.status === 'SKIPPED') c.shortCircuited++;
      else if (leaf.status === 'PASSED') c.trueSeen++;
      else if (leaf.status === 'FAILED') c.falseSeen++;
      else if (leaf.status === 'UNKNOWN') c.unknownSeen++;
    }
  }

  const conditions = Array.from(map.values());
  for (const c of conditions) c.fullyCovered = c.trueSeen > 0 && c.falseSeen > 0;

  const totalConditions = conditions.length;
  const totalBranches = totalConditions * 2;
  const coveredBranches = conditions.reduce(
    (n, c) => n + (c.trueSeen > 0 ? 1 : 0) + (c.falseSeen > 0 ? 1 : 0),
    0,
  );
  const fullyCovered = conditions.filter((c) => c.fullyCovered).length;
  const uncovered = conditions.filter((c) => c.trueSeen === 0 && c.falseSeen === 0 && c.unknownSeen === 0).length;

  return {
    conditions,
    totalConditions,
    totalBranches,
    coveredBranches,
    branchCoveragePct: totalBranches === 0 ? 0 : Math.round((coveredBranches / totalBranches) * 1000) / 10,
    fullyCovered,
    uncovered,
  };
}

/** Which branches still need a test case, for the synthesizer to target. */
export interface CoverageGap {
  expression: string;
  needsTrue: boolean;
  needsFalse: boolean;
}

export function coverageGaps(report: CoverageReport): CoverageGap[] {
  return report.conditions
    .filter((c) => !c.fullyCovered)
    .map((c) => ({ expression: c.expression, needsTrue: c.trueSeen === 0, needsFalse: c.falseSeen === 0 }));
}
