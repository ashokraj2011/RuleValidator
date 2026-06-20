import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { PendingCase } from '../../models/types';
import { RuleStoreService } from '../../services/rule-store.service';

const INITIAL_PENDING_CASES: PendingCase[] = [
  {
    id: 'Eligibility_MinAge_Check',
    name: 'Eligibility_MinAge_Check',
    description: 'CrossSell eligibility threshold',
    focus: 'Boundary: age = 18',
    bgClass: 'bg-neutral-100 text-neutral-800 border-neutral-300',
  },
  {
    id: 'Legacy_User_Mapping',
    name: 'Legacy_User_Mapping',
    description: 'Profile data synchronization',
    focus: 'Null: userID = null',
    bgClass: 'bg-rose-50 text-rose-700 border-rose-100',
  },
  {
    id: 'Max_Credit_Limit_Test',
    name: 'Max_Credit_Limit_Test',
    description: 'Financial cap validation',
    focus: 'Happy path: normal limit',
    bgClass: 'bg-blue-50 text-blue-700 border-blue-100',
  },
  {
    id: 'Account_Status_Active',
    name: 'Account_Status_Active',
    description: 'State machine validation',
    focus: "Boundary: status = 'DORMANT'",
    bgClass: 'bg-neutral-100 text-neutral-800 border-neutral-300',
  },
  {
    id: 'Nested_Product_Array',
    name: 'Nested_Product_Array',
    description: 'Collection parsing depth',
    focus: 'Array: length = 100',
    bgClass: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100',
  },
  {
    id: 'Currency_Code_Iso',
    name: 'Currency_Code_Iso',
    description: 'Localization checks',
    focus: 'Missing: currencyKey',
    bgClass: 'bg-red-50 text-red-700 border-red-100',
  },
];

const PREVIEW_DATA_MAP: Record<string, { expected: 'TRUE' | 'FALSE'; code: string; explanation: string }> = {
  Eligibility_MinAge_Check: {
    expected: 'TRUE',
    explanation: 'The user age of 18 exactly matches the inclusive lower bound defined in the CrossSell eligibility tree node #442. This triggers an early-exit TRUE for the eligibility path.',
    code: `{
  "test_id": "EL_MIN_18",
  "input": {
    "user": {
      "age": 18,
      "region": "NA",
      "tier": "GOLD"
    },
    "campaign": "CROSS_SELL_V12",
    "timestamp": 1694203400
  },
  "logic_path": [
    "root.eligibility",
    "nodes.age_validation",
    "conditions.inclusive_lower_bound"
  ],
  "engine_metadata": {
    "trace_id": "8fa-22-x9",
    "snapshot": "s45"
  }
}`,
  },
  Legacy_User_Mapping: {
    expected: 'FALSE',
    explanation: 'The profile data defines userID as null, which violates the primary index constraints in key resolution v1. Mapping returns an eligibility check failure.',
    code: `{
  "test_id": "LEG_USR_NULL",
  "input": {
    "user": {
      "userID": null,
      "account_standing": "ACTIVE"
    },
    "campaign": "CROSS_SELL_V12",
    "timestamp": 1694203480
  },
  "logic_path": [
    "root.resolver",
    "nodes.null_reference_handler",
    "exceptions.early_abort_fail"
  ],
  "engine_metadata": {
    "trace_id": "9cc-ef-x11",
    "snapshot": "s45"
  }
}`,
  },
  Max_Credit_Limit_Test: {
    expected: 'TRUE',
    explanation: 'Normal balance limit resolves positive under classical retail profile scoring criteria, skipping fallback tier evaluations entirely.',
    code: `{
  "test_id": "MAX_CREDIT_OK",
  "input": {
    "user": {
      "age": 35,
      "balance": 50000,
      "account_standing": "ACTIVE"
    },
    "campaign": "CROSS_SELL_V12",
    "timestamp": 1694203520
  },
  "logic_path": [
    "root.eligibility",
    "nodes.balance_scoring",
    "conditions.tier_match"
  ],
  "engine_metadata": {
    "trace_id": "aa1-09-y72",
    "snapshot": "s45"
  }
}`,
  },
  Account_Status_Active: {
    expected: 'FALSE',
    explanation: 'Customer profile status of "DORMANT" triggers high risk restrictions flags, early exiting from evaluation sequences with a FALSE outcome.',
    code: `{
  "test_id": "STAT_DORMANT_BLOCKED",
  "input": {
    "user": {
      "id": "USR-8411",
      "status": "DORMANT"
    },
    "campaign": "CROSS_SELL_V12",
    "timestamp": 1694203610
  },
  "logic_path": [
    "root.eligibility",
    "nodes.status_verification",
    "conditions.blacklist_dormant"
  ],
  "engine_metadata": {
    "trace_id": "fa2-31-y91",
    "snapshot": "s45"
  }
}`,
  },
  Nested_Product_Array: {
    expected: 'TRUE',
    explanation: 'Parser verification check passes matching full array of 100 catalog assets. System bounds verified up to 255 elements limits.',
    code: `{
  "test_id": "ARRAY_100_SIZE",
  "input": {
    "catalog_items": ["p1", "p2", "product_subset_ex_100"],
    "campaign_eligibility": "BASIC"
  },
  "logic_path": [
    "root.catalog_parser",
    "nodes.array_size_bounds",
    "conditions.safe_limits"
  ],
  "engine_metadata": {
    "trace_id": "bc8-11-f12",
    "snapshot": "s45"
  }
}`,
  },
  Currency_Code_Iso: {
    expected: 'FALSE',
    explanation: 'Missing currencyKey elements triggers a runtime exception check, mapping custom defaults to empty causing early exit logic checks to fail.',
    code: `{
  "test_id": "MISSING_CURR_ERR",
  "input": {
    "user": {
      "currency": null
    }
  },
  "logic_path": [
    "root.resolver",
    "nodes.currency_mapping_v2",
    "exceptions.invalid_currency"
  ],
  "engine_metadata": {
    "trace_id": "da5-52-c02",
    "snapshot": "s45"
  }
}`,
  },
};

@Component({
  selector: 'app-generated-tests-tab',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './generated-tests-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeneratedTestsTabComponent {
  readonly store = inject(RuleStoreService);
  readonly strategies = signal({
    happyPath: true,
    boundary: true,
    nulls: true,
    arrays: false,
    coercion: false,
  });
  readonly selectedCaseId = signal('Eligibility_MinAge_Check');
  readonly isCopied = signal(false);
  readonly runCaseId = signal<string | null>(null);
  readonly isRegenerating = signal(false);

  readonly filteredCases = computed(() =>
    INITIAL_PENDING_CASES.filter((testCase) => {
      const strategy = this.strategies();
      if (testCase.focus.toLowerCase().includes('happy path') && !strategy.happyPath) return false;
      if (testCase.focus.toLowerCase().includes('boundary') && !strategy.boundary) return false;
      if (testCase.focus.toLowerCase().includes('null') && !strategy.nulls) return false;
      if (testCase.focus.toLowerCase().includes('array') && !strategy.arrays) return false;
      if (testCase.focus.toLowerCase().includes('missing') && !strategy.coercion) return false;
      return true;
    }),
  );

  readonly activePreview = computed(
    () => PREVIEW_DATA_MAP[this.selectedCaseId()] ?? PREVIEW_DATA_MAP['Eligibility_MinAge_Check'],
  );

  toggleStrategy(key: keyof ReturnType<typeof this.strategies>) {
    this.strategies.update((current) => ({ ...current, [key]: !current[key] }));
  }

  async copyPreview() {
    await navigator.clipboard.writeText(this.activePreview().code);
    this.isCopied.set(true);
    this.store.showToast('📋 Snapshot JSON copied to clipboard!');
    setTimeout(() => this.isCopied.set(false), 2000);
  }

  runTestCase(id: string) {
    this.runCaseId.set(id);
    this.store.showToast(`Initializing generator on ${id}...`);
    setTimeout(() => {
      this.runCaseId.set(null);
      this.store.showToast(`✨ Generated and saved test payload case for ${id}!`);
      this.store.aggregateCoverage.update((coverage) => Math.min(coverage + 0.8, 100));
    }, 1200);
  }

  regenerateAll() {
    this.isRegenerating.set(true);
    this.store.showToast('⚙️ Re-evaluating engine AST and remapping test seeds...');
    setTimeout(() => {
      this.isRegenerating.set(false);
      this.store.aggregateCoverage.update((coverage) => Math.min(coverage + 1.2, 100));
      this.store.showToast('✨ Successfully refreshed and regenerated all queued boundary snapshots.');
    }, 2000);
  }
}
