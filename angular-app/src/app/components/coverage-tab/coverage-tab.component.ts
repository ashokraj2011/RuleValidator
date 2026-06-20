import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ConditionStats } from '../../models/types';
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
