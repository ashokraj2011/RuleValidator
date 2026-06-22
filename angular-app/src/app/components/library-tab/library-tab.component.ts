import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { Fixture, Suite } from '../../models/types';
import { RuleEngineService } from '../../services/rule-engine.service';
import { RuleStoreService } from '../../services/rule-store.service';

/**
 * Library — manage reusable Fixtures (named test data) and Suites (groupings of
 * test cases). Fixtures are composed into many cases instead of re-typing inline
 * data; suites run a group of cases as a unit.
 */
@Component({
  selector: 'app-library-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './library-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryTabComponent {
  readonly store = inject(RuleStoreService);
  private readonly engine = inject(RuleEngineService);

  readonly newSuiteName = signal('');

  readonly fixtures = computed(() => this.store.fixtures());
  readonly suites = computed(() => this.store.suites());

  fixtureNamespaces(f: Fixture): string[] {
    return Object.keys(f.data);
  }

  /** Synthesize a fixture from the selected rule for the given target outcome. */
  newFixtureFromRule(target: boolean) {
    const rule = this.store.selectedRule();
    const data = this.engine.synthesizeSnapshot(rule, target, this.store.allRules());
    if (!Object.keys(data).length) {
      this.store.showToast('⚠️ Nothing to synthesize for this rule.');
      return;
    }
    const fixture: Fixture = {
      id: `fx-${Date.now()}`,
      name: `${rule.name} — ${target ? 'PASS' : 'FAIL'} data`,
      description: `Synthesized to make "${rule.name}" ${target ? 'pass' : 'fail'}.`,
      data,
      createdAt: new Date().toISOString(),
    };
    this.store.saveFixture(fixture);
    this.store.showToast(`🧪 Created fixture "${fixture.name}".`);
  }

  /** Load a fixture into the Test Rule workspace for the selected rule. */
  useFixture(f: Fixture) {
    this.store.testData.set(structuredClone(f.data));
    this.store.activeTab.set('test-runs');
    this.store.showToast(`📂 Loaded fixture "${f.name}" — evaluating.`);
  }

  deleteFixture(f: Fixture) {
    if (confirm(`Delete fixture "${f.name}"?`)) {
      this.store.deleteFixture(f.id);
      this.store.showToast(`🗑️ Deleted fixture "${f.name}".`);
    }
  }

  /** Create a suite from every test case of the selected rule. */
  createSuiteFromRule() {
    const name = this.newSuiteName().trim() || `${this.store.selectedRule().name} suite`;
    const cases = this.store.casesForSelectedRule();
    if (!cases.length) {
      this.store.showToast('⚠️ The selected rule has no test cases to group.');
      return;
    }
    const suite: Suite = {
      id: `st-${Date.now()}`,
      name,
      ruleId: this.store.selectedRuleId(),
      caseIds: cases.map((c) => c.id),
      createdAt: new Date().toISOString(),
    };
    this.store.saveSuite(suite);
    this.newSuiteName.set('');
    this.store.showToast(`📦 Created suite "${name}" with ${cases.length} case(s).`);
  }

  ruleName(ruleId: string): string {
    return this.store.allRules().find((r) => r.rule_id === ruleId)?.name ?? ruleId;
  }

  /** Run every case in a suite and report a pass/fail/regression summary. */
  runSuite(s: Suite) {
    const cases = this.store.testCases().filter((c) => s.caseIds.includes(c.id));
    if (!cases.length) {
      this.store.showToast('⚠️ This suite has no resolvable cases.');
      return;
    }
    const runs = this.store.executeTestCases(cases);
    const passed = runs.filter((r) => r.evalResult.status === 'PASSED').length;
    const bugs = runs.filter((r) => r.assertionClass === 'bug').length;
    const tag = bugs ? ` • ${bugs} possible bug(s) 🐞` : '';
    this.store.showToast(`▶️ Suite "${s.name}": ${passed}/${runs.length} passed${tag}.`);
  }

  deleteSuite(s: Suite) {
    if (confirm(`Delete suite "${s.name}"?`)) {
      this.store.deleteSuite(s.id);
      this.store.showToast(`🗑️ Deleted suite "${s.name}".`);
    }
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
