import {
  Rule,
  Term,
  LogicalTerm,
  ComparisonTerm,
  RuleRefTerm,
  TestDataSnapshot,
  EvalResult,
} from './types';

// --- Type Guards ---

export function isLogicalTerm(term: Term): term is LogicalTerm {
  return 'operator' in term && ('terms' in term) && !('namespace' in term) && !('rule_ref' in term);
}

export function isComparisonTerm(term: Term): term is ComparisonTerm {
  return 'namespace' in term && 'attribute' in term;
}

export function isRuleRefTerm(term: Term): term is RuleRefTerm {
  return 'rule_ref' in term;
}

// --- Namespace Extraction ---

export function extractNamespaces(rule: Rule, allRules?: Rule[]): string[] {
  const namespaces = new Set<string>();

  function walk(term: Term) {
    if (isComparisonTerm(term)) {
      namespaces.add(term.namespace);
    } else if (isLogicalTerm(term)) {
      term.terms.forEach(walk);
    } else if (isRuleRefTerm(term) && allRules) {
      const refRule = allRules.find(r => r.rule_id === term.rule_ref);
      if (refRule) {
        walk(refRule.terms);
      }
    }
  }

  walk(rule.terms);
  return Array.from(namespaces);
}

// --- Extract all attributes per namespace ---

export function extractNamespaceAttributes(rule: Rule, allRules?: Rule[]): Record<string, string[]> {
  const attrs: Record<string, Set<string>> = {};

  function walk(term: Term) {
    if (isComparisonTerm(term)) {
      if (!attrs[term.namespace]) attrs[term.namespace] = new Set();
      attrs[term.namespace].add(term.attribute);
    } else if (isLogicalTerm(term)) {
      term.terms.forEach(walk);
    } else if (isRuleRefTerm(term) && allRules) {
      const refRule = allRules.find(r => r.rule_id === term.rule_ref);
      if (refRule) walk(refRule.terms);
    }
  }

  walk(rule.terms);

  const result: Record<string, string[]> = {};
  for (const [ns, set] of Object.entries(attrs)) {
    result[ns] = Array.from(set);
  }
  return result;
}

// --- Operator display names ---

const OPERATOR_DISPLAY: Record<string, string> = {
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
  return OPERATOR_DISPLAY[op] || op;
}

// --- Comparison Logic ---

function compare(actual: any, operator: string, expected: any): boolean {
  switch (operator) {
    case 'equal_to':
      return actual === expected;
    case 'not_equal_to':
      return actual !== expected;
    case 'greater_than':
      return typeof actual === 'number' && actual > expected;
    case 'greater_than_equal':
      return typeof actual === 'number' && actual >= expected;
    case 'less_than':
      return typeof actual === 'number' && actual < expected;
    case 'less_than_equal':
      return typeof actual === 'number' && actual <= expected;
    case 'contains':
      if (Array.isArray(actual)) return actual.includes(expected);
      if (typeof actual === 'string') return actual.includes(expected);
      return false;
    case 'not_contains':
      if (Array.isArray(actual)) return !actual.includes(expected);
      if (typeof actual === 'string') return !actual.includes(expected);
      return true;
    case 'in':
      return Array.isArray(expected) && expected.includes(actual);
    case 'not_in':
      return Array.isArray(expected) && !expected.includes(actual);
    case 'exists':
      return actual !== null && actual !== undefined;
    case 'not_exists':
      return actual === null || actual === undefined;
    default:
      return false;
  }
}

// --- Rule Evaluation ---

export function evaluateRule(
  rule: Rule,
  data: TestDataSnapshot,
  allRules?: Rule[]
): EvalResult {
  return evaluateTerm(rule.terms, data, allRules);
}

function evaluateTerm(
  term: Term,
  data: TestDataSnapshot,
  allRules?: Rule[]
): EvalResult {
  if (isComparisonTerm(term)) {
    return evaluateComparison(term, data);
  } else if (isLogicalTerm(term)) {
    return evaluateLogical(term, data, allRules);
  } else if (isRuleRefTerm(term) && allRules) {
    const refRule = allRules.find(r => r.rule_id === term.rule_ref);
    if (refRule) {
      const result = evaluateTerm(refRule.terms, data, allRules);
      return {
        ...result,
        expression: `[Rule: ${refRule.name}] ${result.expression}`,
      };
    }
    return {
      expression: `[Rule Ref: ${term.rule_ref}] NOT FOUND`,
      operator: 'ref',
      expected: term.rule_ref,
      actual: 'undefined',
      status: 'FAILED',
    };
  }

  return {
    expression: 'Unknown term',
    operator: 'unknown',
    expected: '',
    actual: '',
    status: 'FAILED',
  };
}

function evaluateComparison(
  term: ComparisonTerm,
  data: TestDataSnapshot
): EvalResult {
  const nsData = data[term.namespace];
  const actual = nsData ? nsData[term.attribute] : undefined;
  const passed = compare(actual, term.operator, term.value);
  const expression = `${term.namespace}.${term.attribute} ${operatorDisplay(term.operator)} ${JSON.stringify(term.value)}`;

  return {
    expression,
    namespace: term.namespace,
    attribute: term.attribute,
    operator: term.operator,
    expected: term.value,
    actual: actual !== undefined ? actual : 'undefined',
    status: passed ? 'PASSED' : 'FAILED',
  };
}

function evaluateLogical(
  term: LogicalTerm,
  data: TestDataSnapshot,
  allRules?: Rule[]
): EvalResult {
  const children = term.terms.map(t => evaluateTerm(t, data, allRules));
  let status: 'PASSED' | 'FAILED' | 'SKIPPED';

  if (term.operator === 'AND') {
    status = children.every(c => c.status === 'PASSED') ? 'PASSED' : 'FAILED';
  } else if (term.operator === 'OR') {
    status = children.some(c => c.status === 'PASSED') ? 'PASSED' : 'FAILED';
  } else {
    // NOT — single child, invert
    status = children[0]?.status === 'PASSED' ? 'FAILED' : 'PASSED';
  }

  return {
    expression: `${term.operator} Group`,
    operator: term.operator,
    expected: term.operator,
    actual: status,
    status,
    children,
  };
}
