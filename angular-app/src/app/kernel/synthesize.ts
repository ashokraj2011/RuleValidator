/**
 * Constraint-based data synthesizer. Builds a snapshot that drives a rule to a
 * target outcome (TRUE = should PASS, FALSE = should FAIL).
 *
 * Unlike the original last-write-wins walk, this collects every leaf constraint
 * on each `namespace.attribute`, folds in whether the leaf must be satisfied or
 * violated, then solves per attribute. When the constraints on one attribute are
 * contradictory (e.g. `age > 5 AND age < 3`) it reports a conflict instead of
 * silently emitting invalid data — and that conflict is exactly what the linter
 * surfaces as an unsatisfiable branch.
 */

import {
  ComparisonOperator,
  ComparisonTerm,
  LogicalTerm,
  Rule,
  Term,
  comparisonLabel,
  isComparisonTerm,
  isLogicalTerm,
  isRuleRefTerm,
} from './ast';
import { SchemaRegistry } from './schema';

export interface Conflict {
  namespace: string;
  attribute: string;
  message: string;
  constraints: string[];
}

export interface SynthesisResult {
  snapshot: Record<string, Record<string, any>>;
  conflicts: Conflict[];
}

interface PosConstraint {
  op: ComparisonOperator;
  value: any;
  label: string;
}

/** Negate an operator so a "must violate" leaf becomes a positive constraint. */
const NEGATE: Partial<Record<ComparisonOperator, ComparisonOperator>> = {
  equal_to: 'not_equal_to',
  not_equal_to: 'equal_to',
  greater_than: 'less_than_equal',
  greater_than_equal: 'less_than',
  less_than: 'greater_than_equal',
  less_than_equal: 'greater_than',
  contains: 'not_contains',
  not_contains: 'contains',
  in: 'not_in',
  not_in: 'in',
  exists: 'not_exists',
  not_exists: 'exists',
};

export class Synthesizer {
  private readonly index: Map<string, Rule>;
  private readonly schema?: SchemaRegistry;

  constructor(rules: Rule[] = [], schema?: SchemaRegistry) {
    this.index = new Map(rules.map((r) => [r.rule_id, r]));
    this.schema = schema;
  }

  synthesize(rule: Rule, target: boolean): SynthesisResult {
    const byAttr = new Map<string, PosConstraint[]>();
    this.collect(rule.terms, target, byAttr, new Set([rule.rule_id]));
    return this.solveAll(byAttr);
  }

  /**
   * Synthesize data that drives a SINGLE leaf condition (identified by its label,
   * e.g. `customer.country == "CA"`) to `want`, while arranging the surrounding
   * logic so that leaf is actually reached and evaluated (no short-circuit before
   * it). This is what lets coverage gap-filling close an OR-arm that whole-rule
   * PASS/FAIL synthesis would otherwise skip.
   */
  synthesizeBranch(rule: Rule, targetLabel: string, want: boolean): SynthesisResult {
    const byAttr = new Map<string, PosConstraint[]>();
    this.collectBranch(rule.terms, targetLabel, want, byAttr, new Set([rule.rule_id]));
    return this.solveAll(byAttr);
  }

  private solveAll(byAttr: Map<string, PosConstraint[]>): SynthesisResult {
    const snapshot: Record<string, Record<string, any>> = {};
    const conflicts: Conflict[] = [];

    for (const [key, constraints] of byAttr) {
      const [namespace, attribute] = key.split(' ');
      const solved = this.solveAttribute(namespace, attribute, constraints);
      if (!solved.ok) {
        conflicts.push({
          namespace,
          attribute,
          message: solved.message ?? 'Unsatisfiable constraints',
          constraints: constraints.map((c) => c.label),
        });
        continue;
      }
      if (solved.value !== undefined) {
        snapshot[namespace] ??= {};
        snapshot[namespace][attribute] = solved.value;
      }
    }

    return { snapshot, conflicts };
  }

  private addConstraint(term: ComparisonTerm, want: boolean, out: Map<string, PosConstraint[]>): void {
    const op = want ? term.operator : (NEGATE[term.operator] ?? term.operator);
    const key = `${term.namespace} ${term.attribute}`;
    const list = out.get(key) ?? [];
    list.push({ op, value: term.value, label: comparisonLabel(term) });
    out.set(key, list);
  }

  /** Walk the tree deciding, per leaf, whether it must be satisfied or violated. */
  private collect(
    term: Term,
    want: boolean,
    out: Map<string, PosConstraint[]>,
    stack: Set<string>,
  ): void {
    if (isComparisonTerm(term)) {
      this.addConstraint(term, want, out);
      return;
    }
    if (isLogicalTerm(term)) {
      this.collectLogical(term, want, out, stack);
      return;
    }
    if (isRuleRefTerm(term)) {
      const ref = this.index.get(term.rule_ref);
      if (ref && !stack.has(term.rule_ref)) {
        this.collect(ref.terms, want, out, new Set(stack).add(term.rule_ref));
      }
    }
  }

  private containsTarget(term: Term, targetLabel: string, stack: Set<string>): boolean {
    if (isComparisonTerm(term)) return comparisonLabel(term) === targetLabel;
    if (isLogicalTerm(term)) return term.terms.some((t) => this.containsTarget(t, targetLabel, stack));
    if (isRuleRefTerm(term)) {
      const ref = this.index.get(term.rule_ref);
      return !!ref && !stack.has(term.rule_ref) && this.containsTarget(ref.terms, targetLabel, new Set(stack).add(term.rule_ref));
    }
    return false;
  }

  /**
   * Collect constraints so `targetLabel` evaluates to `want` AND is reachable:
   * off-path siblings under an AND are forced TRUE (so they don't short-circuit
   * to FALSE first), and siblings under an OR are forced FALSE (so they don't
   * short-circuit to TRUE first). Returns whether the target was found.
   */
  private collectBranch(
    term: Term,
    targetLabel: string,
    want: boolean,
    out: Map<string, PosConstraint[]>,
    stack: Set<string>,
  ): boolean {
    if (isComparisonTerm(term)) {
      if (comparisonLabel(term) === targetLabel) {
        this.addConstraint(term, want, out);
        return true;
      }
      return false;
    }
    if (isLogicalTerm(term)) {
      const idx = term.terms.findIndex((t) => this.containsTarget(t, targetLabel, stack));
      if (idx < 0) return false;
      const reachFiller = term.operator === 'OR' ? false : true; // OR siblings → FALSE, AND/NOT siblings → TRUE
      term.terms.forEach((child, i) => {
        if (i === idx) this.collectBranch(child, targetLabel, want, out, stack);
        else this.collect(child, reachFiller, out, stack);
      });
      return true;
    }
    if (isRuleRefTerm(term)) {
      const ref = this.index.get(term.rule_ref);
      if (ref && !stack.has(term.rule_ref)) {
        return this.collectBranch(ref.terms, targetLabel, want, out, new Set(stack).add(term.rule_ref));
      }
    }
    return false;
  }

  private collectLogical(
    term: LogicalTerm,
    want: boolean,
    out: Map<string, PosConstraint[]>,
    stack: Set<string>,
  ): void {
    const { operator, terms } = term;
    if (operator === 'AND') {
      // want TRUE → all true; want FALSE → break the first child, keep rest true.
      if (want) terms.forEach((t) => this.collect(t, true, out, stack));
      else terms.forEach((t, i) => this.collect(t, i !== 0, out, stack));
    } else if (operator === 'OR') {
      // want TRUE → satisfy the first arm; want FALSE → violate every arm.
      if (want) {
        if (terms.length) this.collect(terms[0], true, out, stack);
      } else {
        terms.forEach((t) => this.collect(t, false, out, stack));
      }
    } else {
      // NOT = negated conjunction. want TRUE → conjunction false; want FALSE → all true.
      if (want) terms.forEach((t, i) => this.collect(t, i !== 0, out, stack));
      else terms.forEach((t) => this.collect(t, true, out, stack));
    }
  }

  private isIntAttr(namespace: string, attribute: string): boolean {
    return this.schema?.get(namespace, attribute)?.type.kind === 'int';
  }

  /** Solve one attribute's constraint set into a single value, or report conflict. */
  private solveAttribute(
    namespace: string,
    attribute: string,
    constraints: PosConstraint[],
  ): { ok: boolean; value?: any; message?: string } {
    let mustExist: boolean | undefined;
    let eq: any | undefined;
    const neq = new Set<any>();
    let lo: number | undefined;
    let loInc = true;
    let hi: number | undefined;
    let hiInc = true;
    let inSet: any[] | undefined;
    const notIn = new Set<any>();
    const containReq: any[] = [];
    const containForbid = new Set<any>();

    const num = (v: any) => (typeof v === 'number' ? v : Number(v));

    for (const c of constraints) {
      switch (c.op) {
        case 'exists':
          if (mustExist === false) return conflict('exists vs not_exists');
          mustExist = true;
          break;
        case 'not_exists':
          if (mustExist === true) return conflict('not_exists vs exists');
          mustExist = false;
          break;
        case 'equal_to':
          if (eq !== undefined && eq !== c.value) return conflict(`equal_to ${eq} vs ${c.value}`);
          eq = c.value;
          break;
        case 'not_equal_to':
          neq.add(c.value);
          break;
        case 'greater_than':
          if (lo === undefined || num(c.value) >= lo) (lo = num(c.value)), (loInc = false);
          break;
        case 'greater_than_equal':
          if (lo === undefined || num(c.value) > lo) (lo = num(c.value)), (loInc = true);
          break;
        case 'less_than':
          if (hi === undefined || num(c.value) <= hi) (hi = num(c.value)), (hiInc = false);
          break;
        case 'less_than_equal':
          if (hi === undefined || num(c.value) < hi) (hi = num(c.value)), (hiInc = true);
          break;
        case 'in':
          inSet = inSet ? inSet.filter((v) => (c.value as any[]).includes(v)) : [...(c.value ?? [])];
          break;
        case 'not_in':
          for (const v of c.value ?? []) notIn.add(v);
          break;
        case 'contains':
          containReq.push(c.value);
          break;
        case 'not_contains':
          containForbid.add(c.value);
          break;
      }
    }

    function conflict(message: string) {
      return { ok: false, message };
    }

    // Presence wins outright.
    if (mustExist === false) return { ok: true, value: undefined };

    // Array membership (contains / not_contains) → build an array.
    if (containReq.length || containForbid.size) {
      for (const r of containReq) {
        if (containForbid.has(r)) return conflict(`contains & not_contains "${r}"`);
      }
      return { ok: true, value: Array.from(new Set(containReq)) };
    }

    // Equality is the strongest scalar constraint — validate it against the rest.
    if (eq !== undefined) {
      if (neq.has(eq)) return conflict(`equal_to ${JSON.stringify(eq)} but also not_equal_to it`);
      if (notIn.has(eq)) return conflict(`equal_to ${JSON.stringify(eq)} excluded by not_in`);
      if (inSet && !inSet.includes(eq)) return conflict(`equal_to ${JSON.stringify(eq)} not in ${JSON.stringify(inSet)}`);
      if (typeof eq === 'number') {
        if (lo !== undefined && (loInc ? eq < lo : eq <= lo)) return conflict(`equal_to ${eq} below lower bound`);
        if (hi !== undefined && (hiInc ? eq > hi : eq >= hi)) return conflict(`equal_to ${eq} above upper bound`);
      }
      return { ok: true, value: eq };
    }

    // Set membership.
    if (inSet) {
      const pick = inSet.find((v) => !notIn.has(v) && !neq.has(v));
      if (pick === undefined) return conflict(`in ${JSON.stringify(inSet)} fully excluded`);
      return { ok: true, value: pick };
    }

    // Numeric range.
    if (lo !== undefined || hi !== undefined) {
      const isInt = this.isIntAttr(namespace, attribute) || Number.isInteger(lo ?? hi);
      const step = isInt ? 1 : 0.001;
      let low = lo !== undefined ? (loInc ? lo : lo + step) : undefined;
      let high = hi !== undefined ? (hiInc ? hi : hi - step) : undefined;
      if (low !== undefined && high !== undefined && low > high) {
        return conflict(`range [${low}, ${high}] is empty`);
      }
      let candidate = low ?? high ?? 0;
      let guard = 0;
      while (neq.has(candidate) && guard++ < 1000) {
        candidate += step;
        if (high !== undefined && candidate > high) return conflict('no value avoids not_equal_to in range');
      }
      return { ok: true, value: isInt ? Math.round(candidate) : candidate };
    }

    // not_in / not_equal_to only → synthesize a fresh distinct value.
    if (notIn.size || neq.size) {
      const sample = [...notIn, ...neq][0];
      return { ok: true, value: differ(sample) };
    }

    // exists-only or no constraints.
    if (mustExist === true) return { ok: true, value: 'present' };
    return { ok: true, value: undefined };
  }
}

/** Produce a value distinct from `sample`. */
function differ(sample: any): any {
  if (typeof sample === 'number') return sample + 1;
  if (typeof sample === 'boolean') return !sample;
  if (typeof sample === 'string') return `${sample}_X`;
  return 'OTHER';
}
