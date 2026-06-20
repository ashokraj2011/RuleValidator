import { Injectable } from '@angular/core';
import {
  ComparisonTerm,
  EvalResult,
  LogicalTerm,
  Rule,
  RuleRefTerm,
  Term,
  TestDataSnapshot,
} from '../models/types';

@Injectable({ providedIn: 'root' })
export class RuleEngineService {
  isLogicalTerm(term: Term): term is LogicalTerm {
    return 'operator' in term && 'terms' in term && !('namespace' in term) && !('rule_ref' in term);
  }

  isComparisonTerm(term: Term): term is ComparisonTerm {
    return 'namespace' in term && 'attribute' in term;
  }

  isRuleRefTerm(term: Term): term is RuleRefTerm {
    return 'rule_ref' in term;
  }

  extractNamespaces(rule: Rule, allRules?: Rule[]): string[] {
    const namespaces = new Set<string>();

    const walk = (term: Term) => {
      if (this.isComparisonTerm(term)) {
        namespaces.add(term.namespace);
      } else if (this.isLogicalTerm(term)) {
        term.terms.forEach(walk);
      } else if (this.isRuleRefTerm(term) && allRules) {
        const refRule = allRules.find((candidate) => candidate.rule_id === term.rule_ref);
        if (refRule) {
          walk(refRule.terms);
        }
      }
    };

    walk(rule.terms);
    return Array.from(namespaces);
  }

  extractNamespaceAttributes(rule: Rule, allRules?: Rule[]): Record<string, string[]> {
    const attrs: Record<string, Set<string>> = {};

    const walk = (term: Term) => {
      if (this.isComparisonTerm(term)) {
        attrs[term.namespace] ??= new Set<string>();
        attrs[term.namespace].add(term.attribute);
      } else if (this.isLogicalTerm(term)) {
        term.terms.forEach(walk);
      } else if (this.isRuleRefTerm(term) && allRules) {
        const refRule = allRules.find((candidate) => candidate.rule_id === term.rule_ref);
        if (refRule) {
          walk(refRule.terms);
        }
      }
    };

    walk(rule.terms);

    return Object.fromEntries(
      Object.entries(attrs).map(([namespace, set]) => [namespace, Array.from(set)]),
    );
  }

  operatorDisplay(op: string): string {
    return OPERATOR_DISPLAY[op] || op;
  }

  evaluateRule(rule: Rule, data: TestDataSnapshot, allRules?: Rule[]): EvalResult {
    return this.evaluateTerm(rule.terms, data, allRules);
  }

  private compare(actual: any, operator: string, expected: any): boolean {
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

  private evaluateTerm(term: Term, data: TestDataSnapshot, allRules?: Rule[]): EvalResult {
    if (this.isComparisonTerm(term)) {
      return this.evaluateComparison(term, data);
    }

    if (this.isLogicalTerm(term)) {
      return this.evaluateLogical(term, data, allRules);
    }

    if (this.isRuleRefTerm(term) && allRules) {
      const refRule = allRules.find((candidate) => candidate.rule_id === term.rule_ref);
      if (refRule) {
        const result = this.evaluateTerm(refRule.terms, data, allRules);
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

  private evaluateComparison(term: ComparisonTerm, data: TestDataSnapshot): EvalResult {
    const namespaceData = data[term.namespace];
    const actual = namespaceData ? namespaceData[term.attribute] : undefined;
    const passed = this.compare(actual, term.operator, term.value);
    const expression = `${term.namespace}.${term.attribute} ${this.operatorDisplay(term.operator)} ${JSON.stringify(term.value)}`;

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

  private evaluateLogical(term: LogicalTerm, data: TestDataSnapshot, allRules?: Rule[]): EvalResult {
    const children: EvalResult[] = [];

    if (term.operator === 'AND') {
      let failedEarly = false;
      for (const child of term.terms) {
        if (failedEarly) {
          children.push(this.makeSkipped(child, allRules));
        } else {
          const result = this.evaluateTerm(child, data, allRules);
          children.push(result);
          if (result.status === 'FAILED') failedEarly = true;
        }
      }
      const status = failedEarly ? 'FAILED' : 'PASSED';
      return { expression: 'AND Group', operator: 'AND', expected: 'AND', actual: status, status, children };
    }

    if (term.operator === 'OR') {
      let passedEarly = false;
      for (const child of term.terms) {
        if (passedEarly) {
          children.push(this.makeSkipped(child, allRules));
        } else {
          const result = this.evaluateTerm(child, data, allRules);
          children.push(result);
          if (result.status === 'PASSED') passedEarly = true;
        }
      }
      const status = passedEarly ? 'PASSED' : 'FAILED';
      return { expression: 'OR Group', operator: 'OR', expected: 'OR', actual: status, status, children };
    }

    // NOT — single child, invert
    const child = this.evaluateTerm(term.terms[0], data, allRules);
    const status = child.status === 'PASSED' ? 'FAILED' : 'PASSED';
    return { expression: 'NOT Group', operator: 'NOT', expected: 'NOT', actual: status, status, children: [child] };
  }

  /** Build a SKIPPED node without evaluating (for short-circuited branches). */
  private makeSkipped(term: Term, allRules?: Rule[]): EvalResult {
    if (this.isComparisonTerm(term)) {
      return {
        expression: `${term.namespace}.${term.attribute} ${this.operatorDisplay(term.operator)} ${JSON.stringify(term.value)}`,
        namespace: term.namespace,
        attribute: term.attribute,
        operator: term.operator,
        expected: term.value,
        actual: 'short-circuited',
        status: 'SKIPPED',
        shortCircuited: true,
      };
    }
    if (this.isLogicalTerm(term)) {
      return {
        expression: `${term.operator} Group`,
        operator: term.operator,
        expected: term.operator,
        actual: 'short-circuited',
        status: 'SKIPPED',
        shortCircuited: true,
        children: term.terms.map((t) => this.makeSkipped(t, allRules)),
      };
    }
    return {
      expression: `[Rule Ref skipped]`,
      operator: 'ref',
      expected: '',
      actual: 'short-circuited',
      status: 'SKIPPED',
      shortCircuited: true,
    };
  }

  /** Flatten all leaf conditions from an EvalResult tree for coverage analysis. */
  flattenConditions(result: EvalResult): EvalResult[] {
    if (!result.children?.length) return [result];
    return result.children.flatMap((child) => this.flattenConditions(child));
  }
}

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
