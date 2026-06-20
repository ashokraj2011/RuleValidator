import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { EvalResult } from '../../models/types';
import { RuleEngineService } from '../../services/rule-engine.service';
import { RuleStoreService } from '../../services/rule-store.service';
import { EvalNodeComponent } from '../eval-node/eval-node.component';

@Component({
  selector: 'app-test-runs-tab',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, EvalNodeComponent],
  templateUrl: './test-runs-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TestRunsTabComponent {
  readonly store = inject(RuleStoreService);
  private readonly ruleEngine = inject(RuleEngineService);

  readonly activeNodeId = signal<string | null>(null);
  readonly isCopied = signal(false);

  readonly evalResult = computed(() =>
    this.ruleEngine.evaluateRule(this.store.selectedRule(), this.store.testData(), this.store.allRules()),
  );

  readonly counts = computed(() => this.countNodes(this.evalResult()));
  readonly snapshotJson = computed(() => JSON.stringify(this.store.testData(), null, 2));
  readonly selectedNode = computed(() => {
    const active = this.activeNodeId();
    return active ? this.findNodeByPath(this.evalResult(), active) : null;
  });

  readonly shortCircuitedCount = computed(() => {
    const leaves = this.ruleEngine.flattenConditions(this.evalResult());
    return leaves.filter(l => l.shortCircuited).length;
  });

  readonly passedNamespaceEntries = computed((): [string, any][] => {
    if (this.evalResult().status !== 'PASSED') return [];
    return Object.entries(this.store.testData());
  });

  constructor() {
    effect(() => {
      this.store.selectedRuleId();
      this.store.testData();
      this.activeNodeId.set(null);
    });
  }

  switchToTestData() {
    this.store.activeTab.set('test-data');
  }

  runEvaluation() {
    this.activeNodeId.set(null);
    this.store.showToast('▶️ Evaluation refreshed against the current test data snapshot.');
  }

  onNodeSelected(path: string) {
    this.activeNodeId.set(path);
  }

  async copySnapshot() {
    await navigator.clipboard.writeText(this.snapshotJson());
    this.isCopied.set(true);
    this.store.showToast('📋 Test data snapshot copied to clipboard!');
    setTimeout(() => this.isCopied.set(false), 2000);
  }

  private countNodes(result: EvalResult): { passed: number; failed: number; total: number } {
    if (!result.children?.length) {
      return {
        passed: result.status === 'PASSED' ? 1 : 0,
        failed: result.status === 'FAILED' ? 1 : 0,
        total: 1,
      };
    }

    return result.children.reduce(
      (acc, child) => {
        const counts = this.countNodes(child);
        return {
          passed: acc.passed + counts.passed,
          failed: acc.failed + counts.failed,
          total: acc.total + counts.total,
        };
      },
      { passed: 0, failed: 0, total: 0 },
    );
  }

  private findNodeByPath(result: EvalResult, path: string): EvalResult | null {
    if (path === '0') {
      return result;
    }

    const indexes = path
      .split('-')
      .slice(1)
      .map((value) => Number(value))
      .filter((value) => !Number.isNaN(value));

    let current: EvalResult | undefined = result;
    for (const index of indexes) {
      current = current?.children?.[index];
      if (!current) {
        return null;
      }
    }

    return current ?? null;
  }
}
