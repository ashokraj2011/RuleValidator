import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { EvalResult, TestCase, TestCaseRunResult } from '../../models/types';
import { MockDbService } from '../../services/mock-db.service';
import { RuleEngineService } from '../../services/rule-engine.service';
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
  private readonly engine = inject(RuleEngineService);

  readonly testCases = computed(() => this.store.casesForSelectedRule());
  readonly expandedCaseId = signal<string | null>(null);
  readonly runningCaseId = signal<string | null>(null);
  readonly runningAll = signal(false);

  // --- Live-data test ---
  readonly showLiveModal = signal(false);
  readonly livePersonaType = signal<'MID' | 'WID'>('MID');
  readonly livePersonaId = signal('');
  readonly liveParams = signal<{ key: string; value: string }[]>([]);
  readonly liveRunning = signal(false);
  readonly liveResult = signal<EvalResult | null>(null);
  readonly liveSnapshot = signal<Record<string, any> | null>(null);
  readonly liveMatched = signal<Record<string, string | null>>({});
  readonly liveSaveName = signal('');
  readonly liveExpected = signal<'PASSED' | 'FAILED' | 'NONE'>('NONE');

  /** Namespaces (+attributes) the selected rule needs from live data. */
  readonly requiredNamespaces = computed(() =>
    this.engine.extractNamespaceAttributes(this.store.selectedRule(), this.store.allRules()),
  );

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

  // --- Live-data test flow ---

  openLive() {
    this.livePersonaType.set('MID');
    this.livePersonaId.set('');
    this.liveParams.set([]);
    this.liveResult.set(null);
    this.liveSnapshot.set(null);
    this.liveMatched.set({});
    this.liveSaveName.set('');
    this.liveExpected.set('NONE');
    this.showLiveModal.set(true);
  }

  closeLive() { this.showLiveModal.set(false); }

  addLiveParam() {
    this.liveParams.update((list) => [...list, { key: '', value: '' }]);
  }
  removeLiveParam(i: number) {
    this.liveParams.update((list) => list.filter((_, idx) => idx !== i));
  }
  updateLiveParam(i: number, field: 'key' | 'value', val: string) {
    this.liveParams.update((list) => list.map((p, idx) => (idx === i ? { ...p, [field]: val } : p)));
  }

  async runLive() {
    const personaId = this.livePersonaId().trim();
    if (!personaId) { this.store.showToast('⚠️ Enter a Persona ID to fetch live data.'); return; }

    this.liveRunning.set(true);
    this.liveResult.set(null);
    const rule = this.store.selectedRule();
    const { snapshot, matched } = await this.mockDb.fetchLiveData(
      { personaType: this.livePersonaType(), personaId, extra: this.liveParams() },
      this.requiredNamespaces(),
    );
    const result = this.engine.evaluateRule(rule, snapshot, this.store.allRules());
    this.liveSnapshot.set(snapshot);
    this.liveMatched.set(matched);
    this.liveResult.set(result);
    this.liveRunning.set(false);
    this.store.showToast(`${result.status === 'PASSED' ? '✅' : '❌'} Live evaluation — ${result.status}`);
  }

  /** Persist the fetched live snapshot as a reproducible, DB-grounded test case. */
  saveLiveAsCase() {
    const snapshot = this.liveSnapshot();
    const result = this.liveResult();
    if (!snapshot || !result) return;
    const name = this.liveSaveName().trim()
      || `Live ${this.livePersonaType()} ${this.livePersonaId().trim()}`;

    const dbKeys: Record<string, string> = {};
    const matched = this.liveMatched();
    for (const ns of Object.keys(matched)) {
      if (matched[ns]) dbKeys[ns] = matched[ns] as string;
    }
    const extras = this.liveParams().filter((p) => p.key.trim());
    const paramNote = extras.length
      ? ` • params: ${extras.map((p) => `${p.key}=${p.value}`).join(', ')}`
      : '';
    const expected = this.liveExpected();

    const tc: TestCase = {
      id: `tc-${Date.now()}`,
      name,
      description: `Captured from live data (${this.livePersonaType()} ${this.livePersonaId().trim()})${paramNote}`,
      ruleId: this.store.selectedRuleId(),
      dbKeys,
      snapshot: JSON.parse(JSON.stringify(snapshot)),
      createdAt: new Date().toISOString(),
      lastRunAt: new Date().toISOString(),
      lastResult: result.status === 'PASSED' ? 'PASSED' : 'FAILED',
      expectedResult: expected === 'NONE' ? undefined : expected,
      expectedSnapshot: expected === 'NONE' ? undefined : JSON.parse(JSON.stringify(snapshot)),
    };
    this.store.saveTestCase(tc);
    this.store.addRunResult({
      id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      testCaseId: tc.id,
      ruleId: tc.ruleId,
      runAt: tc.lastRunAt!,
      evalResult: result,
      snapshot: tc.snapshot,
      expectedResult: tc.expectedResult,
      assertion: !tc.expectedResult ? 'none' : tc.lastResult === tc.expectedResult ? 'match' : 'mismatch',
      assertionClass: !tc.expectedResult ? 'none' : tc.lastResult === tc.expectedResult ? 'match' : 'bug',
      dataChanged: false,
    });
    this.showLiveModal.set(false);
    this.store.showToast(`💾 Saved live result as test case "${name}".`);
  }

  liveLeafSummary(): { passed: number; failed: number; skipped: number } {
    const result = this.liveResult();
    if (!result) return { passed: 0, failed: 0, skipped: 0 };
    const leaves = this.engine.flattenConditions(result);
    return {
      passed: leaves.filter((l) => l.status === 'PASSED').length,
      failed: leaves.filter((l) => l.status === 'FAILED').length,
      skipped: leaves.filter((l) => l.status === 'SKIPPED' || l.shortCircuited).length,
    };
  }

  liveSnapshotEntries(): [string, any][] {
    const s = this.liveSnapshot();
    return s ? Object.entries(s) : [];
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
