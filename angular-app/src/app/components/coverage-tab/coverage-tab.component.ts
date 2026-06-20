import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { RuleStoreService } from '../../services/rule-store.service';

const INITIAL_GRID_ROWS = 96;
const CUSTOM_NODES_MAP: Record<number, { name: string; calls: number; coverage: number; status: string }> = {
  4: { name: 'rule.eligibility.VIP_check', calls: 8940, coverage: 100, status: 'PASSED' },
  12: { name: 'rule.bounds.age_max_limit', calls: 4120, coverage: 100, status: 'PASSED' },
  24: { name: 'rule.failure.api_timeout', calls: 0, coverage: 0, status: 'CRITICAL GAP' },
  35: { name: 'rule.calculations.scoring_tree', calls: 12040, coverage: 85, status: 'PASSED' },
  48: { name: 'rule.exceptions.null_reference', calls: 140, coverage: 12, status: 'WARNING' },
  72: { name: 'rule.eligibility.balance_scoring', calls: 3410, coverage: 90, status: 'PASSED' },
};

@Component({
  selector: 'app-coverage-tab',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './coverage-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoverageTabComponent {
  readonly store = inject(RuleStoreService);
  readonly activeCellIndex = signal(12);
  readonly activeBreakdownTab = signal<'namespace' | 'operator'>('namespace');
  readonly scenarios = signal([
    {
      id: 'UN-042',
      risk: 'HIGH RISK' as const,
      title: 'API timeout for session namespace',
      description: 'System behavior is undefined when the cross-sell API returns a 408 response code.',
    },
    {
      id: 'UN-115',
      risk: 'MEDIUM' as const,
      title: 'Negative balance overflow handling',
      description: 'Validation logic for edge-case integer overflow on legacy account types.',
    },
    {
      id: 'UN-089',
      risk: 'MEDIUM' as const,
      title: 'Currency mismatch in multi-tenant mode',
      description: 'No test data exists for tenants where base currency differs from reporting currency.',
    },
  ]);

  readonly gridIndexes = Array.from({ length: INITIAL_GRID_ROWS }, (_, index) => index);

  cellClasses(index: number): string {
    if (index === 12 || index === 4 || index === 72) return 'bg-[#368727] opacity-100 ring-2 ring-emerald-500/30';
    if (index === 24) return 'border border-red-300 bg-red-200';
    if (index % 7 === 0) return 'border border-rose-300 bg-rose-100';
    if (index % 3 === 0) return 'bg-primary opacity-45';
    if (index % 5 === 0) return 'bg-primary opacity-75';
    return 'bg-primary opacity-90';
  }

  cellDetails() {
    const index = this.activeCellIndex();
    return CUSTOM_NODES_MAP[index] ?? {
      name: `rule.internal_block.0x${index.toString(16).toUpperCase().padStart(4, '0')}`,
      calls: index * 120 + 20,
      coverage: index % 3 === 0 ? 100 : index % 5 === 0 ? 40 : 85,
      status: index % 5 === 0 ? 'WARNING' : 'PASSED',
    };
  }


  cellTitle(index: number): string {
    return CUSTOM_NODES_MAP[index]?.name ?? `Logic Node Block 0x${index.toString(16).toUpperCase()}`;
  }

  selectCell(index: number) {
    this.activeCellIndex.set(index);
    const customNode = CUSTOM_NODES_MAP[index];
    this.store.showToast(customNode ? `Selected compiled logic node: ${customNode.name}` : `Inspecting logic block hash 0x${index.toString(16).toUpperCase()}`);
  }

  autoGenerateAll() {
    if (!this.scenarios().length) {
      this.store.showToast('All uncovered edge-cases are already covered by valid synthetic test cases!');
      return;
    }

    this.store.showToast('⚙️ Injecting automated coverage cases to clear gaps...');
    setTimeout(() => {
      this.scenarios.set([]);
      this.store.aggregateCoverage.set(99.1);
      this.store.showToast('✨ Auto-generated 3 coverage regressions. Aggregated Coverage successfully boosted to 99.1%!');
    }, 1500);
  }

  setBreakdown(tab: 'namespace' | 'operator') {
    this.activeBreakdownTab.set(tab);
    this.store.showToast(tab === 'namespace' ? 'Breakdown: Grouping by logical namespace.' : 'Breakdown: Grouping by logical operators.');
  }
}
