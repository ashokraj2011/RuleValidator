import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ActiveTab } from '../../models/types';
import { RuleStoreService } from '../../services/rule-store.service';
import { CoverageTabComponent } from '../coverage-tab/coverage-tab.component';
import { GeneratedTestsTabComponent } from '../generated-tests-tab/generated-tests-tab.component';
import { OverviewTabComponent } from '../overview-tab/overview-tab.component';
import { TestDataTabComponent } from '../test-data-tab/test-data-tab.component';
import { TestRunsTabComponent } from '../test-runs-tab/test-runs-tab.component';
import { ValidateTabComponent } from '../validate-tab/validate-tab.component';
import { LibraryTabComponent } from '../library-tab/library-tab.component';

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
    ValidateTabComponent,
    LibraryTabComponent,
  ],
  templateUrl: './shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  readonly store = inject(RuleStoreService);
  readonly selectedRule = computed(() => this.store.selectedRule());

  /** Single source of truth for the primary navigation. */
  readonly navItems: { tab: ActiveTab; label: string; icon: string }[] = [
    { tab: 'overview', label: 'Dashboard', icon: 'layout-dashboard' },
    { tab: 'test-data', label: 'Test Rule', icon: 'database' },
    { tab: 'generated', label: 'Test Cases', icon: 'beaker' },
    { tab: 'test-runs', label: 'Evaluate', icon: 'circle-play' },
    { tab: 'coverage', label: 'Coverage', icon: 'trending-up' },
    { tab: 'validate', label: 'Validate', icon: 'shield-check' },
    { tab: 'library', label: 'Library', icon: 'archive' },
  ];

  /** Human label of the active section, shown in the header. */
  readonly activeSectionLabel = computed(
    () => this.navItems.find((n) => n.tab === this.store.activeTab())?.label ?? '',
  );

  /** Classify the current toast by its leading emoji so it can be styled by tone. */
  readonly toastTone = computed<'success' | 'warn' | 'error' | 'info'>(() => {
    const m = this.store.toastMessage() ?? '';
    if (m.includes('❌')) return 'error';
    if (m.includes('⚠')) return 'warn';
    if (m.includes('✅')) return 'success';
    return 'info';
  });

  toastIcon(): string {
    switch (this.toastTone()) {
      case 'success': return 'circle-check';
      case 'warn': return 'triangle-alert';
      case 'error': return 'octagon-x';
      default: return 'sparkles';
    }
  }

  toastIconClass(): string {
    switch (this.toastTone()) {
      case 'success': return 'text-green-400';
      case 'warn': return 'text-amber-400';
      case 'error': return 'text-red-400';
      default: return 'text-sky-400';
    }
  }

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

  switchTab(tab: ActiveTab) {
    this.store.activeTab.set(tab);
  }

  selectRule(ruleId: string) {
    this.store.selectRule(ruleId);
    const rule = this.store.allRules().find(r => r.rule_id === ruleId);
    this.store.showToast(`Selected: ${rule?.name ?? ruleId}`);
  }
}
