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
import {
  Evaluator,
  Finding,
  Linter,
  SAMPLE_SCHEMA,
  SchemaRegistry,
  Synthesizer,
  comparisonLabel,
  flattenConditions,
  isComparisonTerm,
  isLogicalTerm,
  isRuleRefTerm,
  operatorDisplay,
} from '../kernel';

/**
 * Thin Angular facade over the framework-agnostic kernel. Keeps the public API
 * the components already depend on, but the actual logic — evaluation, synthesis,
 * linting — now lives in the sound, unit-tested kernel.
 */
@Injectable({ providedIn: 'root' })
export class RuleEngineService {
  /** Legacy session-namespace names, used as a fallback when a namespace is not in the schema. */
  static readonly SESSION_NAMESPACES = ['session', 'context', 'request'];

  /** The schema the kernel uses for typed coercion and linting. */
  readonly schema: SchemaRegistry = SAMPLE_SCHEMA;

  isSessionNamespace(namespace: string): boolean {
    if (this.schema.hasNamespace(namespace)) return this.schema.isSession(namespace);
    return RuleEngineService.SESSION_NAMESPACES.includes(namespace.toLowerCase());
  }

  isLogicalTerm(term: Term): term is LogicalTerm {
    return isLogicalTerm(term);
  }
  isComparisonTerm(term: Term): term is ComparisonTerm {
    return isComparisonTerm(term);
  }
  isRuleRefTerm(term: Term): term is RuleRefTerm {
    return isRuleRefTerm(term);
  }

  operatorDisplay(op: string): string {
    return operatorDisplay(op);
  }

  /** All namespaces referenced by a rule (following rule_refs). */
  extractNamespaces(rule: Rule, allRules: Rule[] = []): string[] {
    return Object.keys(this.extractNamespaceAttributes(rule, allRules));
  }

  /** Namespace → attributes referenced by a rule (following rule_refs, cycle-safe). */
  extractNamespaceAttributes(rule: Rule, allRules: Rule[] = []): Record<string, string[]> {
    const index = new Map(allRules.map((r) => [r.rule_id, r]));
    const attrs: Record<string, Set<string>> = {};

    const walk = (term: Term, stack: Set<string>) => {
      if (isComparisonTerm(term)) {
        (attrs[term.namespace] ??= new Set<string>()).add(term.attribute);
      } else if (isLogicalTerm(term)) {
        term.terms.forEach((t) => walk(t, stack));
      } else if (isRuleRefTerm(term)) {
        const ref = index.get(term.rule_ref);
        if (ref && !stack.has(term.rule_ref)) walk(ref.terms, new Set(stack).add(term.rule_ref));
      }
    };

    walk(rule.terms, new Set([rule.rule_id]));
    return Object.fromEntries(Object.entries(attrs).map(([ns, set]) => [ns, Array.from(set)]));
  }

  /** Evaluate a rule against a data snapshot, producing a decision-trace tree. */
  evaluateRule(rule: Rule, data: TestDataSnapshot, allRules: Rule[] = []): EvalResult {
    return new Evaluator({ rules: allRules, schema: this.schema }).evaluate(rule, data);
  }

  /** Flatten all leaf conditions from an EvalResult tree (for coverage analysis). */
  flattenConditions(result: EvalResult): EvalResult[] {
    return flattenConditions(result);
  }

  /** Static analysis: type errors, undefined attributes, cyclic refs, contradictions. */
  lint(rule: Rule, allRules: Rule[] = []): Finding[] {
    return new Linter(allRules.length ? allRules : [rule], this.schema).lint(rule);
  }

  /**
   * Synthesize a data snapshot that drives the rule to `target` (true = PASS,
   * false = FAIL), via the constraint solver. Conflicts (unsatisfiable branches)
   * are surfaced through `lint`; here we return the best-effort snapshot.
   */
  synthesizeSnapshot(rule: Rule, target: boolean, allRules: Rule[] = []): TestDataSnapshot {
    return new Synthesizer(allRules, this.schema).synthesize(rule, target).snapshot;
  }

  /**
   * Synthesize a snapshot that drives one leaf condition (by its label) to a
   * specific truth and keeps it reachable — used to close a coverage gap on a
   * branch that whole-rule synthesis would short-circuit past.
   */
  synthesizeBranch(rule: Rule, targetLabel: string, want: boolean, allRules: Rule[] = []): TestDataSnapshot {
    return new Synthesizer(allRules, this.schema).synthesizeBranch(rule, targetLabel, want).snapshot;
  }

  /** Human-readable label for a comparison term. */
  comparisonLabel(term: ComparisonTerm): string {
    return comparisonLabel(term);
  }
}
