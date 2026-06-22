/**
 * The evaluation kernel. Produces a decision-trace tree (`EvalResult`) for a
 * rule against a data snapshot. Three-valued, cycle-safe, schema-aware.
 *
 * Fixes over the original engine:
 *   - NOT applies to ALL its terms (negated conjunction), not just terms[0];
 *   - rule_ref cycles are detected and reported instead of overflowing the stack;
 *   - results are TRUE/FALSE/UNKNOWN, so missing data is visible as UNKNOWN.
 */

import {
  ComparisonTerm,
  LogicalTerm,
  Rule,
  RuleRefTerm,
  Term,
  comparisonLabel,
  isComparisonTerm,
  isLogicalTerm,
  isRuleRefTerm,
} from './ast';
import { compareTyped } from './compare';
import { Truth, andAll, isAndDecisive, isOrDecisive, not3, orAll } from './logic';
import { SchemaRegistry } from './schema';

export type EvalStatus = 'PASSED' | 'FAILED' | 'SKIPPED' | 'UNKNOWN';

export interface EvalResult {
  expression: string;
  namespace?: string;
  attribute?: string;
  operator: string;
  expected: any;
  actual: any;
  status: EvalStatus;
  /** true when skipped due to AND/OR short-circuit */
  shortCircuited?: boolean;
  /** populated for UNKNOWN/error leaves to explain why */
  reason?: string;
  children?: EvalResult[];
}

export function truthToStatus(t: Truth): EvalStatus {
  return t === 'TRUE' ? 'PASSED' : t === 'FALSE' ? 'FAILED' : 'UNKNOWN';
}

export function statusToTruth(s: EvalStatus): Truth {
  return s === 'PASSED' ? 'TRUE' : s === 'FAILED' ? 'FALSE' : 'UNKNOWN';
}

export interface EvalOptions {
  rules?: Rule[];
  schema?: SchemaRegistry;
}

export class Evaluator {
  private readonly index: Map<string, Rule>;
  private readonly schema?: SchemaRegistry;

  constructor(opts: EvalOptions = {}) {
    this.index = new Map((opts.rules ?? []).map((r) => [r.rule_id, r]));
    this.schema = opts.schema;
  }

  evaluate(rule: Rule, data: Record<string, any>): EvalResult {
    return this.evalTerm(rule.terms, data, new Set([rule.rule_id]));
  }

  private evalTerm(term: Term, data: Record<string, any>, stack: Set<string>): EvalResult {
    if (isComparisonTerm(term)) return this.evalComparison(term, data);
    if (isLogicalTerm(term)) return this.evalLogical(term, data, stack);
    if (isRuleRefTerm(term)) return this.evalRuleRef(term, data, stack);
    return {
      expression: 'Unknown term',
      operator: 'unknown',
      expected: '',
      actual: '',
      status: 'UNKNOWN',
      reason: 'Unrecognized term shape',
    };
  }

  private evalComparison(term: ComparisonTerm, data: Record<string, any>): EvalResult {
    const nsData = data[term.namespace];
    const actual = nsData ? nsData[term.attribute] : undefined;
    const type = this.schema?.get(term.namespace, term.attribute)?.type;
    const truth = compareTyped(actual, term.operator, term.value, type);

    let reason: string | undefined;
    if (truth === 'UNKNOWN') {
      reason =
        actual === undefined
          ? `No value for ${term.namespace}.${term.attribute}`
          : `Cannot apply ${term.operator} to ${JSON.stringify(actual)}`;
    }

    return {
      expression: comparisonLabel(term),
      namespace: term.namespace,
      attribute: term.attribute,
      operator: term.operator,
      expected: term.value,
      actual: actual !== undefined ? actual : 'undefined',
      status: truthToStatus(truth),
      reason,
    };
  }

  private evalLogical(term: LogicalTerm, data: Record<string, any>, stack: Set<string>): EvalResult {
    if (term.operator === 'AND') return this.evalAnd(term, data, stack);
    if (term.operator === 'OR') return this.evalOr(term, data, stack);
    return this.evalNot(term, data, stack);
  }

  private evalAnd(term: LogicalTerm, data: Record<string, any>, stack: Set<string>): EvalResult {
    const children: EvalResult[] = [];
    const seen: Truth[] = [];
    let decided = false;
    for (const child of term.terms) {
      if (decided) {
        children.push(this.makeSkipped(child));
        continue;
      }
      const r = this.evalTerm(child, data, stack);
      children.push(r);
      const t = statusToTruth(r.status);
      seen.push(t);
      if (isAndDecisive(t)) decided = true; // FALSE is dominant — short-circuit
    }
    const truth = andAll(seen);
    return this.group('AND', truth, children);
  }

  private evalOr(term: LogicalTerm, data: Record<string, any>, stack: Set<string>): EvalResult {
    const children: EvalResult[] = [];
    const seen: Truth[] = [];
    let decided = false;
    for (const child of term.terms) {
      if (decided) {
        children.push(this.makeSkipped(child));
        continue;
      }
      const r = this.evalTerm(child, data, stack);
      children.push(r);
      const t = statusToTruth(r.status);
      seen.push(t);
      if (isOrDecisive(t)) decided = true; // TRUE is dominant — short-circuit
    }
    const truth = orAll(seen);
    return this.group('OR', truth, children);
  }

  /** NOT over all its terms = negation of their conjunction. */
  private evalNot(term: LogicalTerm, data: Record<string, any>, stack: Set<string>): EvalResult {
    const children = term.terms.map((t) => this.evalTerm(t, data, stack));
    const inner = andAll(children.map((c) => statusToTruth(c.status)));
    return this.group('NOT', not3(inner), children);
  }

  private evalRuleRef(term: RuleRefTerm, data: Record<string, any>, stack: Set<string>): EvalResult {
    const ref = this.index.get(term.rule_ref);
    if (!ref) {
      return {
        expression: `[Rule Ref: ${term.rule_ref}] NOT FOUND`,
        operator: 'ref',
        expected: term.rule_ref,
        actual: 'undefined',
        status: 'UNKNOWN',
        reason: `Referenced rule "${term.rule_ref}" does not exist`,
      };
    }
    if (stack.has(term.rule_ref)) {
      return {
        expression: `[Rule Ref: ${ref.name}] CYCLE`,
        operator: 'ref',
        expected: term.rule_ref,
        actual: 'cycle',
        status: 'UNKNOWN',
        reason: `Cyclic rule reference: ${[...stack, term.rule_ref].join(' → ')}`,
      };
    }
    const nextStack = new Set(stack).add(term.rule_ref);
    const result = this.evalTerm(ref.terms, data, nextStack);
    return { ...result, expression: `[Rule: ${ref.name}] ${result.expression}` };
  }

  private group(op: 'AND' | 'OR' | 'NOT', truth: Truth, children: EvalResult[]): EvalResult {
    const status = truthToStatus(truth);
    return {
      expression: `${op} Group`,
      operator: op,
      expected: op,
      actual: status,
      status,
      children,
    };
  }

  /** Build a SKIPPED subtree without evaluating it (short-circuited branch). */
  private makeSkipped(term: Term): EvalResult {
    if (isComparisonTerm(term)) {
      return {
        expression: comparisonLabel(term),
        namespace: term.namespace,
        attribute: term.attribute,
        operator: term.operator,
        expected: term.value,
        actual: 'short-circuited',
        status: 'SKIPPED',
        shortCircuited: true,
      };
    }
    if (isLogicalTerm(term)) {
      return {
        expression: `${term.operator} Group`,
        operator: term.operator,
        expected: term.operator,
        actual: 'short-circuited',
        status: 'SKIPPED',
        shortCircuited: true,
        children: term.terms.map((t) => this.makeSkipped(t)),
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
}

/** Flatten all leaf conditions from an EvalResult tree (for coverage). */
export function flattenConditions(result: EvalResult): EvalResult[] {
  if (!result.children?.length) return [result];
  return result.children.flatMap(flattenConditions);
}

/** Canonical, stable serialization of a decision trace — for diffing two runs. */
export function serializeTrace(result: EvalResult): string {
  const norm = (r: EvalResult): any => ({
    e: r.expression,
    s: r.status,
    a: r.actual,
    c: r.children?.map(norm),
  });
  return JSON.stringify(norm(result));
}
