/**
 * Regression suite for the kernel. The §2b "bug table" from DESIGN.md is encoded
 * here: each describe block pins a defect of the original engine and proves the
 * kernel handles it correctly.
 */

import { Rule } from './ast';
import { Evaluator } from './evaluate';
import { Linter } from './lint';
import { computeCoverage } from './coverage';
import { Synthesizer } from './synthesize';
import { SAMPLE_SCHEMA, SchemaRegistry } from './schema';
import { compareTyped } from './compare';
import { andAll, orAll, not3 } from './logic';

function rule(terms: Rule['terms'], id = 'r', name = 'r'): Rule {
  return { rule_id: id, name, terms };
}

describe('kernel: three-valued logic', () => {
  it('AND is FALSE-dominant, then UNKNOWN-dominant', () => {
    expect(andAll(['TRUE', 'FALSE', 'UNKNOWN'])).toBe('FALSE');
    expect(andAll(['TRUE', 'UNKNOWN', 'TRUE'])).toBe('UNKNOWN');
    expect(andAll(['TRUE', 'TRUE'])).toBe('TRUE');
  });
  it('OR is TRUE-dominant, then UNKNOWN-dominant', () => {
    expect(orAll(['FALSE', 'TRUE', 'UNKNOWN'])).toBe('TRUE');
    expect(orAll(['FALSE', 'UNKNOWN', 'FALSE'])).toBe('UNKNOWN');
    expect(orAll(['FALSE', 'FALSE'])).toBe('FALSE');
  });
  it('NOT fixes TRUE/FALSE and preserves UNKNOWN', () => {
    expect(not3('TRUE')).toBe('FALSE');
    expect(not3('FALSE')).toBe('TRUE');
    expect(not3('UNKNOWN')).toBe('UNKNOWN');
  });
});

describe('bug #1: string/number coercion (no more silent === failure)', () => {
  it('matches DB string "34" against numeric rule operand via schema', () => {
    const r = rule({ operator: 'AND', terms: [{ namespace: 'customer', attribute: 'age', operator: 'greater_than_equal', value: 18 }] });
    const ev = new Evaluator({ schema: SAMPLE_SCHEMA });
    expect(ev.evaluate(r, { customer: { age: '34' } }).status).toBe('PASSED');
  });
  it('equal_to coerces too', () => {
    expect(compareTyped('34', 'equal_to', 34, { kind: 'int' })).toBe('TRUE');
  });
});

describe('bug #2: ordering on a non-number is UNKNOWN, not silent FALSE', () => {
  it('returns UNKNOWN when the value cannot be ordered', () => {
    expect(compareTyped('not-a-number', 'greater_than', 5, { kind: 'number' })).toBe('UNKNOWN');
  });
});

describe('bug #3: NOT applies to all of its terms', () => {
  it('negates the conjunction of every child', () => {
    // NOT(age >= 18 AND status == ACTIVE); both true → NOT → FALSE
    const r = rule({
      operator: 'NOT',
      terms: [
        { namespace: 'customer', attribute: 'age', operator: 'greater_than_equal', value: 18 },
        { namespace: 'customer', attribute: 'status', operator: 'equal_to', value: 'ACTIVE' },
      ],
    });
    const ev = new Evaluator({ schema: SAMPLE_SCHEMA });
    const res = ev.evaluate(r, { customer: { age: 30, status: 'ACTIVE' } });
    expect(res.status).toBe('FAILED');
    expect(res.children?.length).toBe(2); // both terms evaluated, not just the first
  });
});

describe('bug #4: cyclic rule_ref is reported, not a stack overflow', () => {
  it('detects A → B → A', () => {
    const a = rule({ operator: 'AND', terms: [{ rule_ref: 'B' }] }, 'A', 'A');
    const b = rule({ operator: 'AND', terms: [{ rule_ref: 'A' }] }, 'B', 'B');
    const ev = new Evaluator({ rules: [a, b], schema: SAMPLE_SCHEMA });
    expect(() => ev.evaluate(a, {})).not.toThrow();
    const res = ev.evaluate(a, {});
    expect(res.status).toBe('UNKNOWN');
    const lint = new Linter([a, b], SAMPLE_SCHEMA).lint(a);
    expect(lint.some((f) => f.code === 'cyclic-ref')).toBeTrue();
  });
});

describe('bug #5: missing data is UNKNOWN, distinct from a real FALSE', () => {
  it('missing attribute → UNKNOWN, present-but-failing → FAILED', () => {
    const r = rule({ operator: 'AND', terms: [{ namespace: 'customer', attribute: 'age', operator: 'greater_than_equal', value: 18 }] });
    const ev = new Evaluator({ schema: SAMPLE_SCHEMA });
    expect(ev.evaluate(r, { customer: {} }).status).toBe('UNKNOWN');
    expect(ev.evaluate(r, { customer: { age: 10 } }).status).toBe('FAILED');
  });
});

describe('bug #7: synthesizer detects unsatisfiable constraints', () => {
  it('reports a conflict instead of emitting invalid data for age>5 AND age<3', () => {
    const r = rule({
      operator: 'AND',
      terms: [
        { namespace: 'customer', attribute: 'age', operator: 'greater_than', value: 5 },
        { namespace: 'customer', attribute: 'age', operator: 'less_than', value: 3 },
      ],
    });
    const synth = new Synthesizer([], SAMPLE_SCHEMA);
    const res = synth.synthesize(r, true);
    expect(res.conflicts.length).toBeGreaterThan(0);
  });

  it('produces a single consistent value for compatible constraints', () => {
    const r = rule({
      operator: 'AND',
      terms: [
        { namespace: 'customer', attribute: 'age', operator: 'greater_than', value: 18 },
        { namespace: 'customer', attribute: 'age', operator: 'less_than', value: 65 },
      ],
    });
    const synth = new Synthesizer([], SAMPLE_SCHEMA);
    const { snapshot, conflicts } = synth.synthesize(r, true);
    expect(conflicts.length).toBe(0);
    expect(snapshot['customer']['age']).toBeGreaterThan(18);
    expect(snapshot['customer']['age']).toBeLessThan(65);
  });
});

describe('synthesized data actually drives the intended outcome', () => {
  const ev = new Evaluator({ schema: SAMPLE_SCHEMA });
  const synth = new Synthesizer([], SAMPLE_SCHEMA);
  const r = rule({
    operator: 'AND',
    terms: [
      { namespace: 'customer', attribute: 'age', operator: 'greater_than_equal', value: 18 },
      {
        operator: 'OR',
        terms: [
          { namespace: 'customer', attribute: 'country', operator: 'equal_to', value: 'US' },
          { namespace: 'customer', attribute: 'country', operator: 'equal_to', value: 'CA' },
        ],
      },
    ],
  });
  it('TRUE target → PASSED', () => {
    expect(ev.evaluate(r, synth.synthesize(r, true).snapshot).status).toBe('PASSED');
  });
  it('FALSE target → FAILED', () => {
    expect(ev.evaluate(r, synth.synthesize(r, false).snapshot).status).toBe('FAILED');
  });
});

describe('targeted branch synthesis closes OR-arm coverage gaps', () => {
  const ev = new Evaluator({ schema: SAMPLE_SCHEMA });
  const synth = new Synthesizer([], SAMPLE_SCHEMA);
  // age >= 18 AND (country == US OR country == CA)
  const r = rule({
    operator: 'AND',
    terms: [
      { namespace: 'customer', attribute: 'age', operator: 'greater_than_equal', value: 18 },
      {
        operator: 'OR',
        terms: [
          { namespace: 'customer', attribute: 'country', operator: 'equal_to', value: 'US' },
          { namespace: 'customer', attribute: 'country', operator: 'equal_to', value: 'CA' },
        ],
      },
    ],
  });

  it('drives the CA arm to TRUE (reached, not short-circuited by US)', () => {
    const { snapshot } = synth.synthesizeBranch(r, 'customer.country == "CA"', true);
    const trace = ev.evaluate(r, snapshot);
    const leaf = trace.children![1].children!.find((c) => c.expression === 'customer.country == "CA"')!;
    expect(leaf.status).toBe('PASSED');
  });

  it('drives the CA arm to FALSE while keeping it reached', () => {
    const { snapshot } = synth.synthesizeBranch(r, 'customer.country == "CA"', false);
    const trace = ev.evaluate(r, snapshot);
    const leaf = trace.children![1].children!.find((c) => c.expression === 'customer.country == "CA"')!;
    expect(leaf.status).toBe('FAILED');
  });
});

describe('linter: static checks before any data', () => {
  const schema = SAMPLE_SCHEMA;
  it('flags an undefined attribute', () => {
    const r = rule({ operator: 'AND', terms: [{ namespace: 'customer', attribute: 'nikname', operator: 'equal_to', value: 'x' }] });
    expect(new Linter([r], schema).lint(r).some((f) => f.code === 'unknown-attribute')).toBeTrue();
  });
  it('flags a type mismatch (contains on an int)', () => {
    const r = rule({ operator: 'AND', terms: [{ namespace: 'customer', attribute: 'age', operator: 'contains', value: 'VIP' }] });
    expect(new Linter([r], schema).lint(r).some((f) => f.code === 'type-mismatch')).toBeTrue();
  });
  it('flags a contradiction (always-false rule)', () => {
    const r = rule({
      operator: 'AND',
      terms: [
        { namespace: 'customer', attribute: 'age', operator: 'greater_than', value: 65 },
        { namespace: 'customer', attribute: 'age', operator: 'less_than', value: 18 },
      ],
    });
    expect(new Linter([r], schema).lint(r).some((f) => f.code === 'contradiction')).toBeTrue();
  });
  it('passes a clean rule', () => {
    const r = rule({ operator: 'AND', terms: [{ namespace: 'customer', attribute: 'age', operator: 'greater_than_equal', value: 18 }] });
    expect(new Linter([r], schema).lint(r).filter((f) => f.severity === 'error').length).toBe(0);
  });
});

describe('bug #6: coverage is computed from traces, not a literal', () => {
  it('reports a true branch covered and the false branch as a gap', () => {
    const r = rule({ operator: 'AND', terms: [{ namespace: 'customer', attribute: 'age', operator: 'greater_than_equal', value: 18 }] });
    const ev = new Evaluator({ schema: SAMPLE_SCHEMA });
    const passing = ev.evaluate(r, { customer: { age: 30 } });
    const report = computeCoverage([passing]);
    expect(report.totalConditions).toBe(1);
    expect(report.branchCoveragePct).toBe(50); // only TRUE branch seen
    const both = computeCoverage([passing, ev.evaluate(r, { customer: { age: 10 } })]);
    expect(both.branchCoveragePct).toBe(100);
  });
});

describe('schema registry distinguishes session namespaces', () => {
  it('marks session as caller-supplied', () => {
    expect(SAMPLE_SCHEMA.isSession('session')).toBeTrue();
    expect(SAMPLE_SCHEMA.isSession('customer')).toBeFalse();
  });
  it('an empty registry has no namespaces', () => {
    expect(new SchemaRegistry().hasNamespace('customer')).toBeFalse();
  });
});
