import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { Rule } from '../../models/types';
import { RuleStoreService } from '../../services/rule-store.service';
import { CoverageTabComponent } from '../coverage-tab/coverage-tab.component';
import { GeneratedTestsTabComponent } from '../generated-tests-tab/generated-tests-tab.component';
import { OverviewTabComponent } from '../overview-tab/overview-tab.component';
import { TestDataTabComponent } from '../test-data-tab/test-data-tab.component';
import { TestRunsTabComponent } from '../test-runs-tab/test-runs-tab.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
    OverviewTabComponent,
    TestDataTabComponent,
    GeneratedTestsTabComponent,
    TestRunsTabComponent,
    CoverageTabComponent,
  ],
  templateUrl: './shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  readonly store = inject(RuleStoreService);
  readonly isNewValidationModalOpen = signal(false);
  readonly newRuleJson = signal('');
  readonly ruleJsonError = signal<string | null>(null);
  readonly selectedRule = computed(() => this.store.selectedRule());

  openAddRuleModal() {
    this.isNewValidationModalOpen.set(true);
  }

  closeAddRuleModal() {
    this.isNewValidationModalOpen.set(false);
    this.ruleJsonError.set(null);
  }

  updateRuleJson(value: string) {
    this.newRuleJson.set(value);
    this.ruleJsonError.set(null);
  }

  handleCreateRule() {
    try {
      const parsed = JSON.parse(this.newRuleJson()) as Partial<Rule>;
      if (!parsed.rule_id || !parsed.name || !parsed.terms) {
        this.ruleJsonError.set('Rule must have rule_id, name, and terms fields.');
        return;
      }

      this.store.addRule(parsed as Rule);
      this.closeAddRuleModal();
      this.newRuleJson.set('');
      this.store.showToast(`✨ Rule "${parsed.name}" added successfully.`);
    } catch (error) {
      this.ruleJsonError.set(`JSON Error: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
    }
  }

  switchTab(tab: 'overview' | 'test-data' | 'generated' | 'test-runs' | 'coverage') {
    this.store.activeTab.set(tab);
  }

  selectRule(ruleId: string, announce = true) {
    this.store.selectRule(ruleId);
    if (announce) {
      const rule = this.store.allRules().find((candidate) => candidate.rule_id === ruleId);
      this.store.showToast(`Selected: ${rule?.name ?? ruleId}`);
    }
  }

  handleHeaderRuleChange(ruleId: string) {
    this.store.selectRule(ruleId);
    const rule = this.store.allRules().find((candidate) => candidate.rule_id === ruleId);
    this.store.showToast(`Switched to rule: ${rule?.name ?? ruleId}`);
  }
}
