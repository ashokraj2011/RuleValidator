/**
 * Static rule linter — the pre-flight check. Inspects a rule against the schema
 * BEFORE any data is involved and reports problems a tester would otherwise only
 * discover (or miss) at run time: undefined attributes, type mismatches, unknown
 * or cyclic references, and contradictory / tautological branches.
 */

import {
  ComparisonTerm,
  MEMBERSHIP_OPERATORS,
  ORDERING_OPERATORS,
  Rule,
  SET_OPERATORS,
  Term,
  comparisonLabel,
  isComparisonTerm,
  isLogicalTerm,
  isRuleRefTerm,
} from './ast';
import { AttrType, SchemaRegistry, typeLabel } from './schema';
import { Synthesizer } from './synthesize';

export type Severity = 'error' | 'warning' | 'info';

export interface Finding {
  ruleId: string;
  severity: Severity;
  code: string;
  message: string;
  /** dotted attribute or term path the finding refers to */
  where?: string;
}

const ORDERABLE = new Set<AttrType['kind']>(['int', 'number', 'date']);

export class Linter {
  private readonly index: Map<string, Rule>;
  private readonly schema: SchemaRegistry;

  constructor(rules: Rule[], schema: SchemaRegistry) {
    this.index = new Map(rules.map((r) => [r.rule_id, r]));
    this.schema = schema;
  }

  lint(rule: Rule): Finding[] {
    const findings: Finding[] = [];
    this.walk(rule, rule.terms, findings, new Set([rule.rule_id]));
    this.checkSatisfiability(rule, findings);
    return findings;
  }

  lintAll(): Finding[] {
    return Array.from(this.index.values()).flatMap((r) => this.lint(r));
  }

  private walk(rule: Rule, term: Term, out: Finding[], stack: Set<string>): void {
    if (isComparisonTerm(term)) {
      this.checkComparison(rule, term, out);
    } else if (isLogicalTerm(term)) {
      if (term.operator === 'NOT' && term.terms.length !== 1) {
        out.push({
          ruleId: rule.rule_id,
          severity: 'warning',
          code: 'not-arity',
          message: `NOT has ${term.terms.length} terms; it will be treated as NOT(AND(...)).`,
        });
      }
      term.terms.forEach((t) => this.walk(rule, t, out, stack));
    } else if (isRuleRefTerm(term)) {
      const ref = this.index.get(term.rule_ref);
      if (!ref) {
        out.push({
          ruleId: rule.rule_id,
          severity: 'error',
          code: 'unknown-ref',
          message: `References unknown rule "${term.rule_ref}".`,
          where: term.rule_ref,
        });
        return;
      }
      if (stack.has(term.rule_ref)) {
        out.push({
          ruleId: rule.rule_id,
          severity: 'error',
          code: 'cyclic-ref',
          message: `Cyclic reference: ${[...stack, term.rule_ref].join(' → ')}.`,
          where: term.rule_ref,
        });
        return;
      }
      this.walk(ref, ref.terms, out, new Set(stack).add(term.rule_ref));
    }
  }

  private checkComparison(rule: Rule, term: ComparisonTerm, out: Finding[]): void {
    const where = `${term.namespace}.${term.attribute}`;
    const def = this.schema.get(term.namespace, term.attribute);

    if (!this.schema.hasNamespace(term.namespace)) {
      out.push({ ruleId: rule.rule_id, severity: 'error', code: 'unknown-namespace', message: `Unknown namespace "${term.namespace}".`, where });
      return;
    }
    if (!def) {
      out.push({ ruleId: rule.rule_id, severity: 'error', code: 'unknown-attribute', message: `Attribute "${where}" is not declared in the schema (typo?).`, where });
      return;
    }

    const t = def.type;
    const op = term.operator;

    if (ORDERING_OPERATORS.has(op) && !ORDERABLE.has(t.kind)) {
      out.push({ ruleId: rule.rule_id, severity: 'error', code: 'type-mismatch', message: `Operator "${op}" needs an orderable type, but ${where} is ${typeLabel(t)}.`, where });
    }
    if (MEMBERSHIP_OPERATORS.has(op) && t.kind !== 'array' && t.kind !== 'string') {
      out.push({ ruleId: rule.rule_id, severity: 'error', code: 'type-mismatch', message: `Operator "${op}" needs an array/string, but ${where} is ${typeLabel(t)}.`, where });
    }
    if (SET_OPERATORS.has(op) && !Array.isArray(term.value)) {
      out.push({ ruleId: rule.rule_id, severity: 'error', code: 'bad-operand', message: `Operator "${op}" needs an array value, got ${JSON.stringify(term.value)}.`, where });
    }

    // Enum value validation for equality / set membership.
    if (t.kind === 'enum') {
      const candidates = op === 'in' || op === 'not_in' ? (Array.isArray(term.value) ? term.value : []) : op === 'equal_to' || op === 'not_equal_to' ? [term.value] : [];
      for (const v of candidates) {
        if (typeof v === 'string' && !t.values.includes(v)) {
          out.push({ ruleId: rule.rule_id, severity: 'warning', code: 'enum-value', message: `Value "${v}" is not a member of ${where} ${typeLabel(t)}.`, where });
        }
      }
    }

    // Numeric operand sanity.
    if ((t.kind === 'int' || t.kind === 'number') && ORDERING_OPERATORS.has(op) && typeof term.value !== 'number') {
      out.push({ ruleId: rule.rule_id, severity: 'warning', code: 'operand-type', message: `Comparing numeric ${where} against non-number ${JSON.stringify(term.value)}.`, where });
    }
  }

  /** Use the constraint solver to detect always-false / always-true rules. */
  private checkSatisfiability(rule: Rule, out: Finding[]): void {
    const synth = new Synthesizer(Array.from(this.index.values()), this.schema);

    const toPass = synth.synthesize(rule, true);
    if (toPass.conflicts.length) {
      for (const c of toPass.conflicts) {
        out.push({ ruleId: rule.rule_id, severity: 'error', code: 'contradiction', message: `Unsatisfiable: ${c.namespace}.${c.attribute} — ${c.message}. The rule can never pass.`, where: `${c.namespace}.${c.attribute}` });
      }
    }

    const toFail = synth.synthesize(rule, false);
    if (toFail.conflicts.length) {
      out.push({ ruleId: rule.rule_id, severity: 'warning', code: 'tautology', message: `The rule appears to always pass — no data makes it fail.` });
    }
  }
}
