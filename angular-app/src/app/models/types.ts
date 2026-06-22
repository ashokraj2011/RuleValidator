export type ActiveTab = 'overview' | 'test-data' | 'generated' | 'test-runs' | 'coverage' | 'validate' | 'library';

// --- Rule grammar + evaluation types ---
// The kernel (src/app/kernel) is the single source of truth; the app re-exports
// the shapes so existing imports from '../models/types' keep working.
import type {
  ComparisonOperator,
  LogicalOperator,
  ComparisonTerm,
  LogicalTerm,
  RuleRefTerm,
  Term,
  Rule,
  EvalResult,
  EvalStatus,
} from '../kernel';

export type {
  ComparisonOperator,
  LogicalOperator,
  ComparisonTerm,
  LogicalTerm,
  RuleRefTerm,
  Term,
  Rule,
  EvalResult,
  EvalStatus,
};

// --- Namespace Data (test data per namespace) ---

export interface NamespaceData {
  [key: string]: any;
}

// All test data keyed by namespace
export interface TestDataSnapshot {
  [namespace: string]: NamespaceData;
}

// Track DB key + fetched data per namespace
export interface NamespaceConfig {
  namespace: string;
  dbKey: string;
  data: NamespaceData;
  isFetched: boolean;
  isEdited: boolean;
}

// --- Fixtures (reusable, named test data) ---

/**
 * A named, reusable data snapshot. One fixture ("Adult US VIP") can be composed
 * into many test cases instead of re-typing the data inline each time.
 */
export interface Fixture {
  id: string;
  name: string;
  description?: string;
  /** typed data per namespace */
  data: TestDataSnapshot;
  createdAt: string;
}

// --- Suites (grouping of cases) ---

/** A named grouping of test cases for a rule — run-all / tag / report as a unit. */
export interface Suite {
  id: string;
  name: string;
  description?: string;
  ruleId: string;
  caseIds: string[];
  createdAt: string;
}

// --- Named Test Cases ---

export interface RequestParam {
  key: string;
  value: string;
}

export interface InvocationContext {
  personaType: 'MID' | 'WID';
  personaId: string;
  /** Arbitrary request parameters passed by the calling application */
  requestParams: RequestParam[];
}

export interface TestCase {
  id: string;
  name: string;
  description: string;
  ruleId: string;
  /** Origin of the case: 'system' = auto-generated PASS/FAIL pair, 'user' = hand-authored */
  source?: 'system' | 'user';
  /** Optional free-form tags for filtering / grouping. */
  tags?: string[];
  /** Optional fixture this case's data was sourced from (Arrange step). */
  fixtureId?: string;
  /** DB keys per namespace */
  dbKeys: Record<string, string>;
  /** Data snapshot per namespace */
  snapshot: TestDataSnapshot;
  /** Call context used to invoke the rule (persona + request params) */
  invocation?: InvocationContext;
  createdAt: string;
  lastRunAt?: string;
  lastResult?: 'PASSED' | 'FAILED';
  /** Asserted expected outcome; undefined = no assertion */
  expectedResult?: 'PASSED' | 'FAILED';
  /** Data snapshot the expectation was pinned against (for drift detection) */
  expectedSnapshot?: TestDataSnapshot;
  /** Result of the latest assertion check */
  lastAssertion?: 'match' | 'mismatch' | 'none';
  /**
   * Refined latest assertion classification:
   * - 'match'  actual outcome equals the expected outcome
   * - 'bug'    mismatch on UNCHANGED data → likely rule/engine bug
   * - 'drift'  mismatch but the data changed since the expectation was pinned
   * - 'none'   no expectation set
   */
  lastAssertionClass?: 'match' | 'bug' | 'drift' | 'none';
}

export interface TestCaseRunResult {
  id: string;
  testCaseId: string;
  ruleId: string;
  runAt: string;
  evalResult: EvalResult;
  snapshot: TestDataSnapshot;
  /** Expected outcome asserted at run time (if any) */
  expectedResult?: 'PASSED' | 'FAILED';
  /** Whether actual matched the expected outcome */
  assertion?: 'match' | 'mismatch' | 'none';
  /** Refined classification of a mismatch (bug vs data drift) */
  assertionClass?: 'match' | 'bug' | 'drift' | 'none';
  /** True when the run data differs from the data the expectation was pinned against */
  dataChanged?: boolean;
}

export interface ConditionStats {
  expression: string;
  namespace?: string;
  attribute?: string;
  operator: string;
  evaluated: number;
  passed: number;
  failed: number;
  shortCircuited: number;
}

// --- Existing types (kept for compatibility) ---

export interface TestCaseRun {
  id: string;
  name: string;
  description: string;
  version: string;
  status: 'passed' | 'failed' | 'pending';
  timestamp: string;
}

export interface LogicPathNode {
  id: string;
  expression: string;
  hits?: number;
  misses?: number;
  isRegression?: boolean;
}

export interface UncoveredScenario {
  id: string;
  risk: 'HIGH RISK' | 'MEDIUM';
  title: string;
  description: string;
}

export interface PendingCase {
  id: string;
  name: string;
  description: string;
  focus: string;
  bgClass?: string;
  textClass?: string;
}

export interface CoverageItem {
  id: string;
  namespace: string;
  rulesCount: number;
  pathsExecuted: string;
  percent: number;
  statusClass: string;
}

export interface Dataset {
  [key: string]: any;
}

export interface EvaluationNode {
  id: string;
  expression: string;
  actual?: string | number;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
}
