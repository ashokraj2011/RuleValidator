import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { TestCase, TestCaseRunResult } from '../../models/types';
import { MockDbService } from '../../services/mock-db.service';
import { RuleStoreService } from '../../services/rule-store.service';

@Component({
  selector: 'app-generated-tests-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './generated-tests-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeneratedTestsTabComponent {
  readonly store = inject(RuleStoreService);
  private readonly mockDb = inject(MockDbService);

  readonly testCases = computed(() => this.store.casesForSelectedRule());
  readonly expandedCaseId = signal<string | null>(null);
  readonly runningCaseId = signal<string | null>(null);
  readonly runningAll = signal(false);

  readonly assertionSummary = computed(() => {
    const cases = this.testCases();
    const asserted = cases.filter(c => c.expectedResult);
    return {
      total: cases.length,
      asserted: asserted.length,
      regressions: cases.filter(c => c.lastAssertion === 'mismatch').length,
      matches: cases.filter(c => c.lastAssertion === 'match').length,
      bugs: cases.filter(c => c.lastAssertionClass === 'bug').length,
      drift: cases.filter(c => c.lastAssertionClass === 'drift').length,
    };
  });

  toggleExpand(id: string) {
    this.expandedCaseId.update(cur => cur === id ? null : id);
  }
  isExpanded(id: string): boolean { return this.expandedCaseId() === id; }
  runsFor(id: string): TestCaseRunResult[] { return this.store.runsForTestCase(id); }

  async runTestCase(tc: TestCase) {
    this.runningCaseId.set(tc.id);
    await new Promise(r => setTimeout(r, 120));
    const run = this.store.executeTestCase(tc);
    this.runningCaseId.set(null);
    const tag =
      run.assertionClass === 'bug' ? ' 🐞 POSSIBLE RULE BUG (data unchanged)'
      : run.assertionClass === 'drift' ? ' ⚠️ mismatch (data changed)'
      : run.assertion === 'match' ? ' ✓ matches expected' : '';
    this.store.showToast(`${run.evalResult.status === 'PASSED' ? '✅' : '❌'} "${tc.name}" — ${run.evalResult.status}${tag}`);
  }

  async runAll() {
    const cases = this.testCases();
    if (!cases.length) { this.store.showToast('No test cases to run.'); return; }
    this.runningAll.set(true);
    await new Promise(r => setTimeout(r, 150));
    const runs = this.store.executeTestCases(cases);
    this.runningAll.set(false);
    const passed = runs.filter(r => r.evalResult.status === 'PASSED').length;
    const bugs = runs.filter(r => r.assertionClass === 'bug').length;
    const drift = runs.filter(r => r.assertionClass === 'drift').length;
    const tags = [
      bugs ? `${bugs} possible bug${bugs !== 1 ? 's' : ''} 🐞` : '',
      drift ? `${drift} data-drift ⚠️` : '',
    ].filter(Boolean).join(' • ');
    const tag = tags ? ` • ${tags}` : '';
    this.store.showToast(`▶️ Ran ${runs.length} test case${runs.length !== 1 ? 's' : ''} — ${passed} passed, ${runs.length - passed} failed${tag}`);
  }

  setExpected(tc: TestCase, value: 'PASSED' | 'FAILED' | 'NONE') {
    this.store.setExpectedResult(tc.id, value === 'NONE' ? undefined : value);
  }

  loadAndEvaluate(tc: TestCase) {
    this.store.testData.set(JSON.parse(JSON.stringify(tc.snapshot)));
    this.store.activeTab.set('test-runs');
    this.store.showToast(`📂 Loaded test case "${tc.name}" into Test Runs.`);
  }

  deleteTestCase(tc: TestCase) {
    if (confirm(`Delete test case "${tc.name}"?`)) {
      this.store.deleteTestCase(tc.id);
      this.store.showToast(`🗑️ Deleted "${tc.name}".`);
    }
  }

  formatDate(iso: string | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  objectEntries(obj: Record<string, any>): [string, any][] { return Object.entries(obj); }
  getAvailableKeys(ns: string): string[] { return this.mockDb.getAvailableKeys(ns); }
}
