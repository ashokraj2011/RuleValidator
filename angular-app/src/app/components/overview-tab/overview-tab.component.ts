import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { Rule } from '../../models/types';
import { RuleEngineService } from '../../services/rule-engine.service';
import { RuleStoreService } from '../../services/rule-store.service';

export interface RuleHealth {
  rule: Rule;
  namespaceCount: number;
  conditionCount: number;
  testCaseCount: number;
  runCount: number;
  passedRuns: number;
  failedRuns: number;
  lastResult: 'PASSED' | 'FAILED' | null;
  lastRunAt: string | null;
  coverage: number;        // % of conditions evaluated at least once across runs
  passRate: number;        // % of runs that passed
  health: 'healthy' | 'failing' | 'untested';
}

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
  private readonly ruleEngine = inject(RuleEngineService);

  readonly searchQuery = signal('');
  readonly healthFilter = signal<'all' | 'healthy' | 'failing' | 'untested'>('all');

  /** Per-rule health derived from rules, saved test cases, and run history. */
  readonly ruleHealth = computed((): RuleHealth[] => {
    const rules = this.store.allRules();
    const allRules = rules;
    const testCases = this.store.testCases();
    const runs = this.store.runHistory();

    return rules.map((rule) => {
      const namespaces = this.ruleEngine.extractNamespaces(rule, allRules);
      const attrs = this.ruleEngine.extractNamespaceAttributes(rule, allRules);
      const conditionCount = Object.values(attrs).reduce((sum, list) => sum + list.length, 0);

      const ruleCases = testCases.filter((tc) => tc.ruleId === rule.rule_id);
      const ruleRuns = runs.filter((r) => r.ruleId === rule.rule_id);
      const passedRuns = ruleRuns.filter((r) => r.evalResult.status === 'PASSED').length;
      const failedRuns = ruleRuns.length - passedRuns;

      // Coverage: distinct conditions evaluated (not short-circuited) at least once
      const evaluatedExpr = new Set<string>();
      const allExpr = new Set<string>();
      for (const run of ruleRuns) {
        for (const leaf of this.ruleEngine.flattenConditions(run.evalResult)) {
          allExpr.add(leaf.expression);
          if (!leaf.shortCircuited && leaf.status !== 'SKIPPED') {
            evaluatedExpr.add(leaf.expression);
          }
        }
      }
      const coverage = allExpr.size > 0 ? Math.round((evaluatedExpr.size / allExpr.size) * 100) : 0;
      const passRate = ruleRuns.length > 0 ? Math.round((passedRuns / ruleRuns.length) * 100) : 0;

      const sortedRuns = [...ruleRuns].sort((a, b) => b.runAt.localeCompare(a.runAt));
      const lastRun = sortedRuns[0];

      let health: RuleHealth['health'] = 'untested';
      if (ruleRuns.length > 0) {
        health = failedRuns > 0 ? 'failing' : 'healthy';
      }

      return {
        rule,
        namespaceCount: namespaces.length,
        conditionCount,
        testCaseCount: ruleCases.length,
        runCount: ruleRuns.length,
        passedRuns,
        failedRuns,
        lastResult: lastRun ? (lastRun.evalResult.status as 'PASSED' | 'FAILED') : null,
        lastRunAt: lastRun ? lastRun.runAt : null,
        coverage,
        passRate,
        health,
      };
    });
  });

  readonly filteredHealth = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const filter = this.healthFilter();
    return this.ruleHealth().filter((h) => {
      if (filter !== 'all' && h.health !== filter) return false;
      if (!q) return true;
      return h.rule.name.toLowerCase().includes(q) || h.rule.rule_id.toLowerCase().includes(q);
    });
  });

  readonly summary = computed(() => {
    const health = this.ruleHealth();
    const totalCases = this.store.testCases().length;
    const totalRuns = this.store.runHistory().length;
    const passedRuns = this.store.runHistory().filter((r) => r.evalResult.status === 'PASSED').length;
    const tested = health.filter((h) => h.runCount > 0);
    const avgCoverage = tested.length > 0
      ? Math.round(tested.reduce((s, h) => s + h.coverage, 0) / tested.length)
      : 0;

    return {
      totalRules: health.length,
      healthy: health.filter((h) => h.health === 'healthy').length,
      failing: health.filter((h) => h.health === 'failing').length,
      untested: health.filter((h) => h.health === 'untested').length,
      totalCases,
      totalRuns,
      passedRuns,
      failedRuns: totalRuns - passedRuns,
      overallPassRate: totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : 0,
      avgCoverage,
    };
  });

  /** Overall health score 0-100 blending coverage, pass rate, and test presence. */
  readonly healthScore = computed(() => {
    const s = this.summary();
    if (s.totalRules === 0) return 0;
    const testedRatio = (s.totalRules - s.untested) / s.totalRules;
    const score = 0.4 * s.overallPassRate + 0.35 * s.avgCoverage + 0.25 * (testedRatio * 100);
    return Math.round(score);
  });

  readonly healthScoreLabel = computed(() => {
    const score = this.healthScore();
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Needs Attention';
    return 'Critical';
  });

  setFilter(f: 'all' | 'healthy' | 'failing' | 'untested') {
    this.healthFilter.set(f);
  }

  formatDate(iso: string | null): string {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  openRule(h: RuleHealth, tab: 'test-data' | 'generated' | 'test-runs' | 'coverage') {
    this.store.selectRule(h.rule.rule_id);
    this.store.activeTab.set(tab);
  }

  coverageColor(pct: number): string {
    if (pct >= 75) return 'bg-green-500';
    if (pct >= 40) return 'bg-yellow-400';
    return 'bg-red-500';
  }

  scoreColor(score: number): string {
    if (score >= 80) return 'text-fidelity-green-bright';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-600';
  }
}
