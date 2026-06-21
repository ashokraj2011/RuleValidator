export type ActiveTab = 'overview' | 'test-data' | 'generated' | 'test-runs' | 'coverage';

// --- Rule Grammar Types ---

export type ComparisonOperator =
  | 'equal_to'
  | 'not_equal_to'
  | 'greater_than'
  | 'greater_than_equal'
  | 'less_than'
  | 'less_than_equal'
  | 'contains'
  | 'not_contains'
  | 'in'
  | 'not_in'
  | 'exists'
  | 'not_exists';

export type LogicalOperator = 'AND' | 'OR' | 'NOT';

// A leaf term that compares a namespace.attribute against a value
export interface ComparisonTerm {
  namespace: string;
  attribute: string;
  operator: ComparisonOperator;
  value: any;
}

// A logical grouping of terms (AND/OR/NOT)
export interface LogicalTerm {
  operator: LogicalOperator;
  terms: Term[];
}

// A reference to another rule (for chaining)
export interface RuleRefTerm {
  rule_ref: string;
}

export type Term = ComparisonTerm | LogicalTerm | RuleRefTerm;

export interface Rule {
  rule_id: string;
  name: string;
  terms: LogicalTerm;
}

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

// --- Evaluation Result Types ---

export interface EvalResult {
  expression: string;
  namespace?: string;
  attribute?: string;
  operator: string;
  expected: any;
  actual: any;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  shortCircuited?: boolean;   // true when skipped due to AND/OR short-circuit
  children?: EvalResult[];
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
