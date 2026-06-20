import { Injectable, computed, signal } from '@angular/core';
import { ActiveTab, Rule, TestDataSnapshot } from '../models/types';
import { SAMPLE_RULES } from '../data/sample-rules';

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

  readonly selectedRule = computed(() =>
    this.allRules().find((rule) => rule.rule_id === this.selectedRuleId()) ?? this.allRules()[0],
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
}
