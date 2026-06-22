import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ConditionStats, TestCase } from '../../models/types';
import { coverageGaps } from '../../kernel';
import { RuleEngineService } from '../../services/rule-engine.service';
import { RuleStoreService } from '../../services/rule-store.service';

@Component({
  selector: 'app-coverage-tab',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './coverage-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoverageTabComponent {
  readonly store = inject(RuleStoreService);
  private readonly ruleEngine = inject(RuleEngineService);

  /** Real MC/DC branch-coverage report (both TRUE and FALSE per condition). */
  readonly report = computed(() => this.store.coverageReport());

  /** Conditions still missing a TRUE and/or FALSE branch. */
  readonly gaps = computed(() => coverageGaps(this.report()));

  /**
   * For each uncovered branch, synthesize a targeted snapshot that drives that
   * specific condition to the missing truth (TRUE/FALSE) while keeping it
   * reachable, save it as a case, and run it — so coverage actually closes.
   */
  coverGaps() {
    const rule = this.store.selectedRule();
    const allRules = this.store.allRules();
    const stamp = new Date().toISOString();
    let made = 0;

    for (const gap of this.gaps()) {
      const wants = [gap.needsTrue ? true : null, gap.needsFalse ? false : null].filter((w): w is boolean => w !== null);
      for (const want of wants) {
        const snapshot = this.ruleEngine.synthesizeBranch(rule, gap.expression, want, allRules);
        if (!Object.keys(snapshot).length) continue;
        const tc: TestCase = {
          id: `tc_cov_${rule.rule_id}_${made}_${Date.now()}`,
          name: `Coverage: ${gap.expression} = ${want ? 'TRUE' : 'FALSE'}`,
          description: 'Auto-synthesized to close a coverage gap.',
          ruleId: rule.rule_id,
          source: 'system',
          tags: ['coverage'],
          dbKeys: {},
          snapshot,
          createdAt: stamp,
        };
        this.store.saveTestCase(tc);
        this.store.executeTestCase(tc);
        made++;
      }
    }
    this.store.showToast(made ? `🤖 Synthesized & ran ${made} case(s) to close coverage gaps.` : '⚠️ No coverable gaps found.');
  }

  branchBarColor(pct: number): string {
    if (pct >= 80) return 'bg-green-500';
    if (pct >= 50) return 'bg-yellow-400';
    return 'bg-red-500';
  }

  /** Aggregate condition stats derived from actual run history for the selected rule. */
  readonly conditionStats = computed((): ConditionStats[] => {
    const runs = this.store.runsForSelectedRule();
    if (runs.length === 0) return [];

    const map = new Map<string, ConditionStats>();

    for (const run of runs) {
      const leaves = this.ruleEngine.flattenConditions(run.evalResult);
      for (const leaf of leaves) {
        const key = leaf.expression;
        let stat = map.get(key);
        if (!stat) {
          stat = {
            expression: leaf.expression,
            namespace: leaf.namespace,
            attribute: leaf.attribute,
            operator: leaf.operator,
            evaluated: 0,
            passed: 0,
            failed: 0,
            shortCircuited: 0,
          };
          map.set(key, stat);
        }
        if (leaf.shortCircuited || leaf.status === 'SKIPPED') {
          stat.shortCircuited++;
        } else {
          stat.evaluated++;
          if (leaf.status === 'PASSED') stat.passed++;
          else if (leaf.status === 'FAILED') stat.failed++;
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.evaluated - a.evaluated);
  });

  readonly totalRuns = computed(() => this.store.runsForSelectedRule().length);

  readonly coverageSummary = computed(() => {
    const stats = this.conditionStats();
    if (stats.length === 0) return { total: 0, evaluated: 0, fullyPassed: 0, alwaysFailed: 0, mixed: 0, shortCircuited: 0 };
    return {
      total: stats.length,
      evaluated: stats.filter(s => s.evaluated > 0).length,
      fullyPassed: stats.filter(s => s.evaluated > 0 && s.failed === 0).length,
      alwaysFailed: stats.filter(s => s.evaluated > 0 && s.passed === 0).length,
      mixed: stats.filter(s => s.passed > 0 && s.failed > 0).length,
      shortCircuited: stats.filter(s => s.shortCircuited > 0 && s.evaluated === 0).length,
    };
  });

  passRate(stat: ConditionStats): number {
    if (stat.evaluated === 0) return 0;
    return Math.round((stat.passed / stat.evaluated) * 100);
  }

  cellColor(stat: ConditionStats): string {
    if (stat.evaluated === 0) return 'bg-neutral-200 text-neutral-400';
    const rate = this.passRate(stat);
    if (rate === 100) return 'bg-green-500';
    if (rate >= 75) return 'bg-green-400';
    if (rate >= 50) return 'bg-yellow-400';
    if (rate >= 25) return 'bg-orange-400';
    return 'bg-red-500';
  }

  rowBorder(stat: ConditionStats): string {
    if (stat.evaluated === 0) return 'border-neutral-200';
    const rate = this.passRate(stat);
    if (rate === 100) return 'border-green-300';
    if (rate >= 50) return 'border-yellow-300';
    return 'border-red-300';
  }
}
