import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { TestCase, TestCaseRunResult } from '../../models/types';
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
  private readonly ruleEngine = inject(RuleEngineService);
  private readonly mockDb = inject(MockDbService);

  readonly testCases = computed(() => this.store.casesForSelectedRule());
  readonly expandedCaseId = signal<string | null>(null);
  readonly runningCaseId = signal<string | null>(null);

  toggleExpand(id: string) {
    this.expandedCaseId.update(cur => cur === id ? null : id);
  }
  isExpanded(id: string): boolean { return this.expandedCaseId() === id; }
  runsFor(id: string): TestCaseRunResult[] { return this.store.runsForTestCase(id); }

  async runTestCase(tc: TestCase) {
    this.runningCaseId.set(tc.id);
    await new Promise(r => setTimeout(r, 120));
    const rule = this.store.allRules().find(r => r.rule_id === tc.ruleId);
    if (!rule) { this.runningCaseId.set(null); return; }

    const evalResult = this.ruleEngine.evaluateRule(rule, tc.snapshot, this.store.allRules());
    const run: TestCaseRunResult = {
      id: `run-${Date.now()}`,
      testCaseId: tc.id,
      ruleId: tc.ruleId,
      runAt: new Date().toISOString(),
      evalResult,
      snapshot: tc.snapshot,
    };
    this.store.addRunResult(run);
    this.runningCaseId.set(null);
    this.store.showToast(`${evalResult.status === 'PASSED' ? '✅' : '❌'} "${tc.name}" — ${evalResult.status}`);
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
