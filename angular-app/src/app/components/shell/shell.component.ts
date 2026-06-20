import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
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
  readonly selectedRule = computed(() => this.store.selectedRule());

  // Rule search
  readonly ruleSearchQuery = signal('');
  readonly filteredRules = computed(() => {
    const q = this.ruleSearchQuery().toLowerCase().trim();
    if (!q) return this.store.allRules();
    return this.store.allRules().filter(r =>
      r.name.toLowerCase().includes(q) || r.rule_id.toLowerCase().includes(q)
    );
  });

  clearSearch() {
    this.ruleSearchQuery.set('');
  }

  switchTab(tab: 'overview' | 'test-data' | 'generated' | 'test-runs' | 'coverage') {
    this.store.activeTab.set(tab);
  }

  selectRule(ruleId: string) {
    this.store.selectRule(ruleId);
    const rule = this.store.allRules().find(r => r.rule_id === ruleId);
    this.store.showToast(`Selected: ${rule?.name ?? ruleId}`);
  }
}
