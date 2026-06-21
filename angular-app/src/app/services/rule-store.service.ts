import { Injectable, computed, inject, signal } from '@angular/core';
import { ActiveTab, EvalResult, Rule, TestCase, TestCaseRunResult, TestDataSnapshot } from '../models/types';
import { SAMPLE_RULES } from '../data/sample-rules';
import { buildSampleData } from '../data/sample-test-cases';
import { RuleEngineService } from './rule-engine.service';

const LS_CASES_KEY = 'ruleValidator_testCases';
const LS_RUNS_KEY = 'ruleValidator_runHistory';
const LS_SEED_KEY = 'ruleValidator_seeded';

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
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
  readonly allRules = signal<Rule[]>(SAMPLE_RULES);
  readonly selectedRuleId = signal<string>(SAMPLE_RULES[0].rule_id);
  readonly testData = signal<TestDataSnapshot>({});
  readonly activeTab = signal<ActiveTab>('overview');
  readonly aggregateCoverage = signal(82.4);
  readonly isOptimized = signal(false);
  readonly toastMessage = signal<string | null>(null);
  readonly ruleStatus = signal('Active');
  readonly selectedTestCaseId = signal<string | null>(null);

  readonly testCases = signal<TestCase[]>(loadFromStorage(LS_CASES_KEY, []));
  readonly runHistory = signal<TestCaseRunResult[]>(loadFromStorage(LS_RUNS_KEY, []));

  private readonly engine = inject(RuleEngineService);

  constructor() {
    this.seedSampleDataIfEmpty();
  }

  /** Populate demo test cases + run history the first time the app is opened. */
  private seedSampleDataIfEmpty() {
    const SEED_VERSION = '3';
    const storedVersion = localStorage.getItem(LS_SEED_KEY);
    const cases = this.testCases();
    const isEmpty = cases.length === 0 && this.runHistory().length === 0;
    const isPureSeed = cases.length > 0 && cases.every((c) => c.id.startsWith('tc_seed_'));

    // Seed when empty, or upgrade untouched demo data to the latest seed version.
    if (!isEmpty && !(storedVersion !== SEED_VERSION && isPureSeed)) {
      return;
    }
    const { testCases, runHistory } = buildSampleData(this.engine, this.allRules());
    this.testCases.set(testCases);
    this.runHistory.set(runHistory);
    localStorage.setItem(LS_CASES_KEY, JSON.stringify(testCases));
    localStorage.setItem(LS_RUNS_KEY, JSON.stringify(runHistory));
    localStorage.setItem(LS_SEED_KEY, SEED_VERSION);
  }

  readonly selectedRule = computed(() =>
    this.allRules().find((rule) => rule.rule_id === this.selectedRuleId()) ?? this.allRules()[0],
  );

  readonly casesForSelectedRule = computed(() =>
    this.testCases().filter(tc => tc.ruleId === this.selectedRuleId())
  );

  readonly runsForSelectedRule = computed(() =>
    this.runHistory().filter(r => r.ruleId === this.selectedRuleId())
  );

  showToast(message: string) {
    this.toastMessage.set(message);
    setTimeout(() => this.toastMessage.set(null), 3000);
  }

  addRule(rule: Rule) {
    this.allRules.update((rules) => [...rules, rule]);
    this.selectedRuleId.set(rule.rule_id);
    this.testData.set({});
  }

  selectRule(ruleId: string) {
    this.selectedRuleId.set(ruleId);
    this.testData.set({});
  }

  // --- Test Case CRUD ---

  saveTestCase(tc: TestCase) {
    this.testCases.update(list => {
      const idx = list.findIndex(c => c.id === tc.id);
      const next = idx >= 0 ? list.map((c, i) => i === idx ? tc : c) : [...list, tc];
      localStorage.setItem(LS_CASES_KEY, JSON.stringify(next));
      return next;
    });
  }

  deleteTestCase(id: string) {
    this.testCases.update(list => {
      const next = list.filter(c => c.id !== id);
      localStorage.setItem(LS_CASES_KEY, JSON.stringify(next));
      return next;
    });
    this.runHistory.update(list => {
      const next = list.filter(r => r.testCaseId !== id);
      localStorage.setItem(LS_RUNS_KEY, JSON.stringify(next));
      return next;
    });
  }

  addRunResult(result: TestCaseRunResult) {
    this.runHistory.update(list => {
      const next = [...list, result];
      localStorage.setItem(LS_RUNS_KEY, JSON.stringify(next));
      return next;
    });
    // Update lastRunAt / lastResult / lastAssertion on the test case
    this.testCases.update(list => {
      const next = list.map(tc =>
        tc.id === result.testCaseId
          ? {
              ...tc,
              lastRunAt: result.runAt,
              lastResult: result.evalResult.status as 'PASSED' | 'FAILED',
              lastAssertion: result.assertion ?? 'none',
              lastAssertionClass: result.assertionClass ?? 'none',
            }
          : tc
      );
      localStorage.setItem(LS_CASES_KEY, JSON.stringify(next));
      return next;
    });
  }

  /** Set (or clear) the expected outcome assertion for a test case. */
  setExpectedResult(id: string, expected: 'PASSED' | 'FAILED' | undefined) {
    this.testCases.update(list => {
      const next = list.map(tc =>
        tc.id === id
          ? {
              ...tc,
              expectedResult: expected,
              // Pin the data the expectation is based on so we can later tell a
              // genuine rule bug (same data, different result) from data drift.
              expectedSnapshot: expected ? structuredClone(tc.snapshot) : undefined,
            }
          : tc,
      );
      localStorage.setItem(LS_CASES_KEY, JSON.stringify(next));
      return next;
    });
  }

  /** Evaluate a test case against its rule, record the run + assertion, and return it. */
  executeTestCase(tc: TestCase): TestCaseRunResult {
    const rule = this.allRules().find(r => r.rule_id === tc.ruleId);
    const evalResult: EvalResult = rule
      ? this.engine.evaluateRule(rule, tc.snapshot, this.allRules())
      : { expression: `Rule ${tc.ruleId} not found`, operator: 'unknown', expected: '', actual: '', status: 'FAILED' };
    const status = evalResult.status === 'PASSED' ? 'PASSED' : 'FAILED';
    const expected = tc.expectedResult;
    const assertion: 'match' | 'mismatch' | 'none' = !expected ? 'none' : status === expected ? 'match' : 'mismatch';

    // Did the data change since the expectation was pinned? If no baseline was
    // captured, fall back to the case's own snapshot (i.e. treat as unchanged).
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
    return cases.map(tc => this.executeTestCase(tc));
  }

  runsForTestCase(testCaseId: string): TestCaseRunResult[] {
    return this.runHistory().filter(r => r.testCaseId === testCaseId);
  }
}
