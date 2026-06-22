/**
 * Rule grammar (AST). Pure data — no Angular, no evaluation logic.
 * This is the single source of truth for the rule shape; the rest of the app
 * re-exports these types from `models/types.ts`.
 */

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

/** A leaf term comparing `namespace.attribute` against a value. */
export interface ComparisonTerm {
  namespace: string;
  attribute: string;
  operator: ComparisonOperator;
  value: any;
}

/** A logical grouping of terms (AND/OR/NOT). */
export interface LogicalTerm {
  operator: LogicalOperator;
  terms: Term[];
}

/** A reference to another rule, for chaining. */
export interface RuleRefTerm {
  rule_ref: string;
}

export type Term = ComparisonTerm | LogicalTerm | RuleRefTerm;

export interface Rule {
  rule_id: string;
  name: string;
  terms: LogicalTerm;
}

// --- Type guards ---

export function isComparisonTerm(term: Term): term is ComparisonTerm {
  return 'namespace' in term && 'attribute' in term;
}

export function isLogicalTerm(term: Term): term is LogicalTerm {
  return 'operator' in term && 'terms' in term && !('namespace' in term) && !('rule_ref' in term);
}

export function isRuleRefTerm(term: Term): term is RuleRefTerm {
  return 'rule_ref' in term;
}

/** Operators that do not read a value (presence checks). */
export const NULLARY_OPERATORS: ReadonlySet<ComparisonOperator> = new Set([
  'exists',
  'not_exists',
]);

/** Operators that require a numeric/orderable operand. */
export const ORDERING_OPERATORS: ReadonlySet<ComparisonOperator> = new Set([
  'greater_than',
  'greater_than_equal',
  'less_than',
  'less_than_equal',
]);

/** Operators that require an array operand on the rule side. */
export const SET_OPERATORS: ReadonlySet<ComparisonOperator> = new Set(['in', 'not_in']);

/** Operators that test membership within the actual (string/array) value. */
export const MEMBERSHIP_OPERATORS: ReadonlySet<ComparisonOperator> = new Set([
  'contains',
  'not_contains',
]);

export const OPERATOR_DISPLAY: Record<string, string> = {
  equal_to: '==',
  not_equal_to: '!=',
  greater_than: '>',
  greater_than_equal: '>=',
  less_than: '<',
  less_than_equal: '<=',
  contains: 'contains',
  not_contains: 'not contains',
  in: 'in',
  not_in: 'not in',
  exists: 'exists',
  not_exists: 'not exists',
};

export function operatorDisplay(op: string): string {
  return OPERATOR_DISPLAY[op] ?? op;
}

/** Build a label for a comparison leaf, e.g. `customer.age >= 18`. */
export function comparisonLabel(term: ComparisonTerm): string {
  if (NULLARY_OPERATORS.has(term.operator)) {
    return `${term.namespace}.${term.attribute} ${operatorDisplay(term.operator)}`;
  }
  return `${term.namespace}.${term.attribute} ${operatorDisplay(term.operator)} ${JSON.stringify(term.value)}`;
}
