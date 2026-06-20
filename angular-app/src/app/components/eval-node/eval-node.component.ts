import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { EvalResult } from '../../models/types';

@Component({
  selector: 'app-eval-node',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './eval-node.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EvalNodeComponent {
  @Input({ required: true }) result!: EvalResult;
  @Input() depth = 0;
  @Input() activeNodeId: string | null = null;
  @Output() nodeSelected = new EventEmitter<string>();

  readonly expandedNodeIds = signal<Set<string>>(new Set(['0']));

  isGroup(node: EvalResult): boolean {
    return !!node.children?.length;
  }

  toggle(path: string) {
    this.expandedNodeIds.update((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  isExpanded(path: string): boolean {
    return this.expandedNodeIds().has(path);
  }

  select(path: string) {
    this.nodeSelected.emit(path);
  }

  statusColor(status: EvalResult['status']): string {
    return status === 'PASSED'
      ? 'text-fidelity-green-bright'
      : status === 'FAILED'
        ? 'text-red-600'
        : 'text-neutral-500';
  }

  borderColor(status: EvalResult['status']): string {
    return status === 'PASSED'
      ? 'border-fidelity-green-bright'
      : status === 'FAILED'
        ? 'border-red-600'
        : 'border-neutral-300';
  }

  bgColor(status: EvalResult['status']): string {
    return status === 'PASSED'
      ? 'bg-green-50/50'
      : status === 'FAILED'
        ? 'bg-red-50/50'
        : 'bg-neutral-50';
  }

  leafClasses(node: EvalResult, path: string): string {
    const isActive = this.activeNodeId === path;
    if (isActive) {
      return node.status === 'PASSED'
        ? 'bg-green-50/40 border-primary shadow-xs ring-1 ring-primary/10'
        : node.status === 'FAILED'
          ? 'bg-red-50/30 border-red-500 shadow-xs ring-1 ring-red-500/10'
          : 'bg-neutral-100 border-neutral-400 ring-1 ring-neutral-300';
    }

    return node.status === 'PASSED'
      ? 'bg-neutral-50 border-neutral-200 hover:border-neutral-400'
      : node.status === 'FAILED'
        ? 'bg-red-50/10 border-red-200 hover:border-red-400'
        : 'bg-neutral-100 border-neutral-200 hover:border-neutral-400 opacity-60';
  }
}
