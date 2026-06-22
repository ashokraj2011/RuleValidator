import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { Finding, Rule } from '../../kernel';
import { RuleEngineService } from '../../services/rule-engine.service';
import { RuleStoreService } from '../../services/rule-store.service';

interface RuleFindings {
  rule: Rule;
  findings: Finding[];
  errors: number;
  warnings: number;
}

/**
 * Static analysis surface ("pre-flight lint"). Runs the kernel linter over rules
 * BEFORE any data is involved and reports type errors, undefined attributes,
 * cyclic references, and contradictory / tautological branches.
 */
@Component({
  selector: 'app-validate-tab',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './validate-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ValidateTabComponent {
  readonly store = inject(RuleStoreService);
  private readonly engine = inject(RuleEngineService);

  /** Findings for the currently selected rule. */
  readonly selected = computed<RuleFindings>(() => {
    const rule = this.store.selectedRule();
    return this.classify(rule);
  });

  /** Findings across every rule, for the portfolio summary. */
  readonly allRuleFindings = computed<RuleFindings[]>(() =>
    this.store.allRules().map((rule) => this.classify(rule)),
  );

  readonly summary = computed(() => {
    const all = this.allRuleFindings();
    return {
      rules: all.length,
      clean: all.filter((r) => r.findings.length === 0).length,
      withErrors: all.filter((r) => r.errors > 0).length,
      withWarnings: all.filter((r) => r.errors === 0 && r.warnings > 0).length,
      totalErrors: all.reduce((n, r) => n + r.errors, 0),
      totalWarnings: all.reduce((n, r) => n + r.warnings, 0),
    };
  });

  private classify(rule: Rule): RuleFindings {
    const findings = this.engine.lint(rule, this.store.allRules());
    return {
      rule,
      findings,
      errors: findings.filter((f) => f.severity === 'error').length,
      warnings: findings.filter((f) => f.severity === 'warning').length,
    };
  }

  select(ruleId: string) {
    this.store.selectRule(ruleId);
  }

  severityIcon(sev: Finding['severity']): string {
    return sev === 'error' ? 'octagon-x' : sev === 'warning' ? 'triangle-alert' : 'info';
  }

  severityClass(sev: Finding['severity']): string {
    return sev === 'error'
      ? 'border-red-300 bg-red-50/60 text-red-700'
      : sev === 'warning'
        ? 'border-amber-300 bg-amber-50/60 text-amber-700'
        : 'border-sky-300 bg-sky-50/60 text-sky-700';
  }

  iconColor(sev: Finding['severity']): string {
    return sev === 'error' ? 'text-red-600' : sev === 'warning' ? 'text-amber-600' : 'text-sky-600';
  }

  rowClass(r: RuleFindings): string {
    if (r.errors > 0) return 'border-red-200';
    if (r.warnings > 0) return 'border-amber-200';
    return 'border-green-200';
  }
}
