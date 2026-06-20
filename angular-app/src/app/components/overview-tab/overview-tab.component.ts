import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { TestCaseRun } from '../../models/types';
import { RuleStoreService } from '../../services/rule-store.service';

const SYSTEM_TEST_CASES: TestCaseRun[] = [
  {
    id: 'Elig_Gold_Tier_Premium',
    name: 'Elig_Gold_Tier_Premium',
    description: 'Edge Case: High Balance',
    version: 'v12.0.4',
    status: 'passed',
    timestamp: '2 mins ago',
  },
  {
    id: 'Neg_Underage_Exclusion',
    name: 'Neg_Underage_Exclusion',
    description: 'Regression: Age Validation',
    version: 'v12.0.4',
    status: 'failed',
    timestamp: '15 mins ago',
  },
  {
    id: 'Elig_Standard_Customer',
    name: 'Elig_Standard_Customer',
    description: 'Baseline Validation',
    version: 'v12.0.4',
    status: 'passed',
    timestamp: '42 mins ago',
  },
  {
    id: 'Elig_Credit_Limit_Cross',
    name: 'Elig_Credit_Limit_Cross',
    description: 'Complex Boolean Tree',
    version: 'v12.0.3',
    status: 'pending',
    timestamp: '1 hour ago',
  },
];

const USER_TEST_CASES: TestCaseRun[] = [
  {
    id: 'User_Retail_HighAge',
    name: 'User_Retail_HighAge',
    description: 'Manual input exceeding 85 years age',
    version: 'v12.0.4',
    status: 'passed',
    timestamp: '3 hours ago',
  },
  {
    id: 'User_Empty_Tags_Check',
    name: 'User_Empty_Tags_Check',
    description: 'Null and empty tags edge validation',
    version: 'v12.0.4',
    status: 'passed',
    timestamp: '5 hours ago',
  },
  {
    id: 'User_Extreme_Balance_Ex',
    name: 'User_Extreme_Balance_Ex',
    description: 'Balance > 1,000,000 extreme bounds',
    version: 'v12.0.3',
    status: 'failed',
    timestamp: '1 day ago',
  },
];

@Component({
  selector: 'app-overview-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './overview-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverviewTabComponent {
  readonly Math = Math;
  readonly store = inject(RuleStoreService);
  readonly activeTabSub = signal<'system' | 'user'>('system');
  readonly searchQuery = signal('');
  readonly currentPage = signal(1);
  readonly isRunningValidation = signal(false);
  readonly systemCases = signal<TestCaseRun[]>(SYSTEM_TEST_CASES);
  readonly userCases = signal<TestCaseRun[]>(USER_TEST_CASES);
  readonly casesPerPage = 4;

  readonly currentCases = computed(() =>
    this.activeTabSub() === 'system' ? this.systemCases() : this.userCases(),
  );

  readonly filteredCases = computed(() => {
    const query = this.searchQuery().toLowerCase();
    return this.currentCases().filter(
      (testCase) =>
        testCase.name.toLowerCase().includes(query) || testCase.description.toLowerCase().includes(query),
    );
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredCases().length / this.casesPerPage)));
  readonly paginatedCases = computed(() => {
    const start = (this.currentPage() - 1) * this.casesPerPage;
    return this.filteredCases().slice(start, start + this.casesPerPage);
  });

  selectSubTab(tab: 'system' | 'user') {
    this.activeTabSub.set(tab);
    this.currentPage.set(1);
  }

  updateSearch(query: string) {
    this.searchQuery.set(query);
    this.currentPage.set(1);
  }

  pageNumbers(): number[] {
    return Array.from({ length: this.totalPages() }, (_, index) => index + 1);
  }

  runValidation() {
    this.isRunningValidation.set(true);
    this.store.showToast('Starting live evaluation on active rule set...');

    setTimeout(() => {
      if (this.activeTabSub() === 'system') {
        this.systemCases.update((cases) =>
          cases.map((testCase) =>
            testCase.status === 'pending'
              ? { ...testCase, status: 'passed', timestamp: 'Just now' }
              : testCase,
          ),
        );
        this.store.showToast('Validation complete! 1 pending run cleared. Status: Active.');
      } else {
        this.store.showToast('Validation complete on manually defined cases!');
      }
      this.isRunningValidation.set(false);
    }, 1800);
  }

  applyOptimization() {
    if (this.store.isOptimized()) {
      this.store.showToast('Optimization has already been flattened into CrossSellCampaignEligibility (v12-opt)!');
      return;
    }

    this.store.isOptimized.set(true);
    this.store.aggregateCoverage.set(92.4);
    this.store.showToast('✨ AI Audit applied! Removed 3 redundant logical paths. Performance +14%! Coverage boosted to 92.4%.');
  }

  viewExplanation(caseId: string) {
    this.store.selectedTestCaseId.set(caseId);
    this.store.activeTab.set('test-runs');
  }

  switchToGenerated() {
    this.store.activeTab.set('generated');
    this.store.showToast('Switched to generation studio.');
  }
}
