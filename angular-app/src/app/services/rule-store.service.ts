import { Injectable, computed, inject, signal } from '@angular/core';
import {
  ActiveTab,
  EvalResult,
  Fixture,
  InvocationContext,
  Rule,
  Suite,
  TestCase,
  TestCaseRunResult,
  TestDataSnapshot,
} from '../models/types';
import { CoverageReport, TraceDiff, computeCoverage, diffTraces } from '../kernel';
import { SAMPLE_RULES } from '../data/sample-rules';
import { buildSampleData, generateSystemCases } from '../data/sample-test-cases';
import { RuleEngineService } from './rule-engine.service';
import { LocalStoragePort, PersistencePort, STORE_KEYS, migrate } from './persistence';

function defaultInvocation(): InvocationContext {
  return { personaType: 'MID', personaId: '', requestParams: [] };
}

/** Deterministic JSON with sorted object keys, so value-equal snapshots stringify identically. */
function stableStringify(value: any): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

/** Value equality for two test-data snapshots, independent of key ordering. */
function snapshotsEqual(a: TestDataSnapshot, b: TestDataSnapshot): boolean {
  return stableStringify(a) === stableStringify(b);
}

@Injectable({ providedIn: 'root' })
export class RuleStoreService {
  private readonly persist: PersistencePort = new LocalStoragePort();
  private readonly engine = inject(RuleEngineService);

  readonly allRules = signal<Rule[]>(SAMPLE_RULES);
  readonly selectedRuleId = signal<string>(SAMPLE_RULES[0].rule_id);
  readonly testData = signal<TestDataSnapshot>({});
  readonly invocation = signal<InvocationContext>(defaultInvocation());
  readonly activeTab = signal<ActiveTab>('overview');
  readonly toastMessage = signal<string | null>(null);
  readonly ruleStatus = signal('Active');
  readonly selectedTestCaseId = signal<string | null>(null);

  readonly testCases = signal<TestCase[]>([]);
  readonly runHistory = signal<TestCaseRunResult[]>([]);
  readonly fixtures = signal<Fixture[]>([]);
  readonly suites = signal<Suite[]>([]);

  constructor() {
    migrate(this.persist);
    this.testCases.set(this.persist.read<TestCase[]>(STORE_KEYS.cases, []));
    this.runHistory.set(this.persist.read<TestCaseRunResult[]>(STORE_KEYS.runs, []));
    this.fixtures.set(this.persist.read<Fixture[]>(STORE_KEYS.fixtures, []));
    this.suites.set(this.persist.read<Suite[]>(STORE_KEYS.suites, []));
    this.seedSampleDataIfEmpty();
    this.seedLibraryIfEmpty();
  }

  /** Seed a couple of synthesized fixtures and a suite so the Library is explorable. */
  private seedLibraryIfEmpty() {
    if (this.fixtures().length === 0) {
      const seeded: Fixture[] = [];
      for (const rule of this.allRules().slice(0, 2)) {
        for (const target of [true, false]) {
          const data = this.engine.synthesizeSnapshot(rule, target, this.allRules());
          if (Object.keys(data).length) {
            seeded.push({
              id: `fx_seed_${rule.rule_id}_${target ? 'pass' : 'fail'}`,
              name: `${rule.name} — ${target ? 'PASS' : 'FAIL'} data`,
              description: `Synthesized to make "${rule.name}" ${target ? 'pass' : 'fail'}.`,
              data,
              createdAt: new Date().toISOString(),
            });
          }
        }
      }
      if (seeded.length) {
        this.fixtures.set(seeded);
        this.persist.write(STORE_KEYS.fixtures, seeded);
      }
    }

    if (this.suites().length === 0) {
      const rule = this.allRules()[0];
      const caseIds = this.testCases().filter((c) => c.ruleId === rule.rule_id).map((c) => c.id);
      if (caseIds.length) {
        const suite: Suite[] = [
          {
            id: `st_seed_${rule.rule_id}`,
            name: `${rule.name} — full suite`,
            ruleId: rule.rule_id,
            caseIds,
            createdAt: new Date().toISOString(),
          },
        ];
        this.suites.set(suite);
        this.persist.write(STORE_KEYS.suites, suite);
      }
    }
  }

  /** Populate demo test cases + run history the first time the app is opened. */
  private seedSampleDataIfEmpty() {
    // Bumped to 5: demo data is regenerated through the new (tri-valued, typed) kernel.
    const SEED_VERSION = '5';
    const storedVersion = this.persist.read<string | null>(STORE_KEYS.seed, null);
    const cases = this.testCases();
    const isEmpty = cases.length === 0 && this.runHistory().length === 0;
    const isPureSeed = cases.length > 0 && cases.every((c) => c.id.startsWith('tc_seed_') || c.id.startsWith('tc_sys_'));

    if (!isEmpty && !(storedVersion !== SEED_VERSION && isPureSeed)) {
      return;
    }
    const { testCases, runHistory } = buildSampleData(this.engine, this.allRules());
    this.testCases.set(testCases);
    this.runHistory.set(runHistory);
    this.persist.write(STORE_KEYS.cases, testCases);
    this.persist.write(STORE_KEYS.runs, runHistory);
    this.persist.write(STORE_KEYS.seed, SEED_VERSION);
  }

  readonly selectedRule = computed(() =>
    this.allRules().find((rule) => rule.rule_id === this.selectedRuleId()) ?? this.allRules()[0],
  );

  readonly casesForSelectedRule = computed(() =>
    this.testCases().filter((tc) => tc.ruleId === this.selectedRuleId()),
  );

  readonly runsForSelectedRule = computed(() =>
    this.runHistory().filter((r) => r.ruleId === this.selectedRuleId()),
  );

  // --- Real coverage (computed from recorded decision traces; never a literal) ---

  /** MC/DC branch-coverage report for the selected rule. */
  readonly coverageReport = computed<CoverageReport>(() =>
    computeCoverage(this.runsForSelectedRule().map((r) => r.evalResult)),
  );

  /** Branch coverage for one rule (0–100). */
  branchCoverageFor(ruleId: string): number {
    const traces = this.runHistory().filter((r) => r.ruleId === ruleId).map((r) => r.evalResult);
    return computeCoverage(traces).branchCoveragePct;
  }

  /** Aggregate branch coverage across every rule that has runs. */
  readonly aggregateCoverage = computed(() => {
    const rules = this.allRules().filter((rule) => this.runHistory().some((r) => r.ruleId === rule.rule_id));
    if (!rules.length) return 0;
    const total = rules.reduce((sum, rule) => sum + this.branchCoverageFor(rule.rule_id), 0);
    return Math.round((total / rules.length) * 10) / 10;
  });

  showToast(message: string) {
    this.toastMessage.set(message);
    setTimeout(() => this.toastMessage.set(null), 3000);
  }

  addRule(rule: Rule) {
    this.allRules.update((rules) => [...rules, rule]);
    this.selectedRuleId.set(rule.rule_id);
    this.testData.set({});
    this.invocation.set(defaultInvocation());
  }

  selectRule(ruleId: string) {
    this.selectedRuleId.set(ruleId);
    this.testData.set({});
    this.invocation.set(defaultInvocation());
  }

  // --- Test Case CRUD ---

  saveTestCase(tc: TestCase) {
    this.testCases.update((list) => {
      const idx = list.findIndex((c) => c.id === tc.id);
      const next = idx >= 0 ? list.map((c, i) => (i === idx ? tc : c)) : [...list, tc];
      this.persist.write(STORE_KEYS.cases, next);
      return next;
    });
  }

  deleteTestCase(id: string) {
    this.testCases.update((list) => {
      const next = list.filter((c) => c.id !== id);
      this.persist.write(STORE_KEYS.cases, next);
      return next;
    });
    this.runHistory.update((list) => {
      const next = list.filter((r) => r.testCaseId !== id);
      this.persist.write(STORE_KEYS.runs, next);
      return next;
    });
    // Detach from any suite that referenced it.
    this.suites.update((list) => {
      const next = list.map((s) => ({ ...s, caseIds: s.caseIds.filter((cid) => cid !== id) }));
      this.persist.write(STORE_KEYS.suites, next);
      return next;
    });
  }

  /**
   * Auto-generate (or refresh) the system PASS/FAIL test-case pair for a rule.
   * Replaces any existing system cases + their runs for that rule.
   */
  regenerateSystemCases(ruleId: string): number {
    const rule = this.allRules().find((r) => r.rule_id === ruleId);
    if (!rule) return 0;
    const { cases, runs } = generateSystemCases(this.engine, rule, this.allRules());

    this.testCases.update((list) => {
      const kept = list.filter((c) => !(c.ruleId === ruleId && c.source === 'system'));
      const next = [...kept, ...cases];
      this.persist.write(STORE_KEYS.cases, next);
      return next;
    });
    this.runHistory.update((list) => {
      const kept = list.filter((r) => !(r.ruleId === ruleId && r.testCaseId.startsWith('tc_sys_')));
      const next = [...kept, ...runs];
      this.persist.write(STORE_KEYS.runs, next);
      return next;
    });
    return cases.length;
  }

  addRunResult(result: TestCaseRunResult) {
    this.runHistory.update((list) => {
      const next = [...list, result];
      this.persist.write(STORE_KEYS.runs, next);
      return next;
    });
    this.testCases.update((list) => {
      const next = list.map((tc) =>
        tc.id === result.testCaseId
          ? {
              ...tc,
              lastRunAt: result.runAt,
              lastResult: result.evalResult.status === 'PASSED' ? ('PASSED' as const) : ('FAILED' as const),
              lastAssertion: result.assertion ?? 'none',
              lastAssertionClass: result.assertionClass ?? 'none',
            }
          : tc,
      );
      this.persist.write(STORE_KEYS.cases, next);
      return next;
    });
  }

  /** Set (or clear) the expected outcome assertion for a test case. */
  setExpectedResult(id: string, expected: 'PASSED' | 'FAILED' | undefined) {
    this.testCases.update((list) => {
      const next = list.map((tc) =>
        tc.id === id
          ? {
              ...tc,
              expectedResult: expected,
              expectedSnapshot: expected ? structuredClone(tc.snapshot) : undefined,
            }
          : tc,
      );
      this.persist.write(STORE_KEYS.cases, next);
      return next;
    });
  }

  /** Evaluate a test case against its rule, record the run + assertion, and return it. */
  executeTestCase(tc: TestCase): TestCaseRunResult {
    const rule = this.allRules().find((r) => r.rule_id === tc.ruleId);
    const evalResult: EvalResult = rule
      ? this.engine.evaluateRule(rule, tc.snapshot, this.allRules())
      : { expression: `Rule ${tc.ruleId} not found`, operator: 'unknown', expected: '', actual: '', status: 'FAILED' };
    const status = evalResult.status === 'PASSED' ? 'PASSED' : 'FAILED';
    const expected = tc.expectedResult;
    const assertion: 'match' | 'mismatch' | 'none' = !expected ? 'none' : status === expected ? 'match' : 'mismatch';

    const baseline = tc.expectedSnapshot ?? tc.snapshot;
    const dataChanged = !!expected && !snapshotsEqual(tc.snapshot, baseline);
    const assertionClass: 'match' | 'bug' | 'drift' | 'none' =
      assertion === 'none' ? 'none' : assertion === 'match' ? 'match' : dataChanged ? 'drift' : 'bug';

    const run: TestCaseRunResult = {
      id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      testCaseId: tc.id,
      ruleId: tc.ruleId,
      runAt: new Date().toISOString(),
      evalResult,
      snapshot: tc.snapshot,
      expectedResult: expected,
      assertion,
      assertionClass,
      dataChanged,
    };
    this.addRunResult(run);
    return run;
  }

  /** Run a batch of test cases sequentially, returning all run results. */
  executeTestCases(cases: TestCase[]): TestCaseRunResult[] {
    return cases.map((tc) => this.executeTestCase(tc));
  }

  runsForTestCase(testCaseId: string): TestCaseRunResult[] {
    return this.runHistory().filter((r) => r.testCaseId === testCaseId);
  }

  /** Regression diff: how the latest run of a case differs from the previous one. */
  regressionForCase(testCaseId: string): TraceDiff | null {
    const runs = this.runsForTestCase(testCaseId).sort((a, b) => a.runAt.localeCompare(b.runAt));
    if (runs.length < 2) return null;
    const prev = runs[runs.length - 2];
    const curr = runs[runs.length - 1];
    return diffTraces(prev.evalResult, curr.evalResult);
  }

  // --- Fixtures (reusable test data) ---

  saveFixture(fixture: Fixture) {
    this.fixtures.update((list) => {
      const idx = list.findIndex((f) => f.id === fixture.id);
      const next = idx >= 0 ? list.map((f, i) => (i === idx ? fixture : f)) : [...list, fixture];
      this.persist.write(STORE_KEYS.fixtures, next);
      return next;
    });
  }

  deleteFixture(id: string) {
    this.fixtures.update((list) => {
      const next = list.filter((f) => f.id !== id);
      this.persist.write(STORE_KEYS.fixtures, next);
      return next;
    });
  }

  // --- Suites (grouping of cases) ---

  saveSuite(suite: Suite) {
    this.suites.update((list) => {
      const idx = list.findIndex((s) => s.id === suite.id);
      const next = idx >= 0 ? list.map((s, i) => (i === idx ? suite : s)) : [...list, suite];
      this.persist.write(STORE_KEYS.suites, next);
      return next;
    });
  }

  deleteSuite(id: string) {
    this.suites.update((list) => {
      const next = list.filter((s) => s.id !== id);
      this.persist.write(STORE_KEYS.suites, next);
      return next;
    });
  }

  readonly suitesForSelectedRule = computed(() =>
    this.suites().filter((s) => s.ruleId === this.selectedRuleId()),
  );
}
