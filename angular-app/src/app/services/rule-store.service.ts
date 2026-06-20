import { Injectable, computed, signal } from '@angular/core';
import { ActiveTab, Rule, TestCase, TestCaseRunResult, TestDataSnapshot } from '../models/types';
import { SAMPLE_RULES } from '../data/sample-rules';

const LS_CASES_KEY = 'ruleValidator_testCases';
const LS_RUNS_KEY = 'ruleValidator_runHistory';

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
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
    // Update lastRunAt / lastResult on the test case
    this.testCases.update(list => {
      const next = list.map(tc =>
        tc.id === result.testCaseId
          ? { ...tc, lastRunAt: result.runAt, lastResult: result.evalResult.status as 'PASSED' | 'FAILED' }
          : tc
      );
      localStorage.setItem(LS_CASES_KEY, JSON.stringify(next));
      return next;
    });
  }

  runsForTestCase(testCaseId: string): TestCaseRunResult[] {
    return this.runHistory().filter(r => r.testCaseId === testCaseId);
  }
}
