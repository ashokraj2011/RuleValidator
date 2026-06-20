import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { NamespaceConfig, NamespaceData } from '../../models/types';
import { MockDbService } from '../../services/mock-db.service';
import { RuleEngineService } from '../../services/rule-engine.service';
import { RuleStoreService } from '../../services/rule-store.service';

@Component({
  selector: 'app-test-data-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './test-data-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TestDataTabComponent {
  readonly Math = Math;
  readonly store = inject(RuleStoreService);
  private readonly ruleEngine = inject(RuleEngineService);
  private readonly mockDb = inject(MockDbService);

  readonly namespaces = computed(() => this.ruleEngine.extractNamespaces(this.store.selectedRule(), this.store.allRules()));
  readonly namespaceAttributes = computed(() =>
    this.ruleEngine.extractNamespaceAttributes(this.store.selectedRule(), this.store.allRules()),
  );

  readonly expandedNamespaces = signal<Set<string>>(new Set());
  readonly namespaceConfigs = signal<Record<string, NamespaceConfig>>({});
  readonly loadingNamespaces = signal<Set<string>>(new Set());
  readonly editingJson = signal<Record<string, string>>({});
  readonly jsonErrors = signal<Record<string, string>>({});

  readonly allNamespacesReady = computed(() =>
    this.namespaces().every((namespace) => {
      const config = this.namespaceConfigs()[namespace];
      return !!config && (config.isFetched || Object.keys(config.data).length > 0);
    }),
  );

  constructor() {
    effect(() => {
      this.store.selectedRuleId();
      const namespaces = this.namespaces();
      untracked(() => this.initializeNamespaceConfigs(namespaces));
    });
  }

  private initializeNamespaceConfigs(namespaces: string[]) {
    const currentConfigs = this.namespaceConfigs();
    const snapshot = this.store.testData();
    const nextConfigs: Record<string, NamespaceConfig> = {};
    const nextEditing = { ...this.editingJson() };

    for (const namespace of namespaces) {
      const existing = currentConfigs[namespace];
      const data = existing?.data ?? snapshot[namespace] ?? {};
      nextConfigs[namespace] = existing ?? {
        namespace,
        dbKey: '',
        data,
        isFetched: Object.keys(data).length > 0,
        isEdited: false,
      };
      if (!nextEditing[namespace] && Object.keys(data).length > 0) {
        nextEditing[namespace] = JSON.stringify(data, null, 2);
      }
    }

    this.namespaceConfigs.set(nextConfigs);
    this.editingJson.set(nextEditing);
    this.jsonErrors.set({});
    this.expandedNamespaces.set(new Set(namespaces));
  }

  toggleNamespace(namespace: string) {
    this.expandedNamespaces.update((current) => {
      const next = new Set(current);
      if (next.has(namespace)) {
        next.delete(namespace);
      } else {
        next.add(namespace);
      }
      return next;
    });
  }

  isExpanded(namespace: string): boolean {
    return this.expandedNamespaces().has(namespace);
  }

  isLoading(namespace: string): boolean {
    return this.loadingNamespaces().has(namespace);
  }

  getConfig(namespace: string): NamespaceConfig | undefined {
    return this.namespaceConfigs()[namespace];
  }

  getAvailableKeys(namespace: string): string[] {
    return this.mockDb.getAvailableKeys(namespace);
  }

  updateDbKey(namespace: string, key: string) {
    this.namespaceConfigs.update((configs) => ({
      ...configs,
      [namespace]: {
        ...configs[namespace],
        dbKey: key,
      },
    }));
  }

  async fetchNamespace(namespace: string) {
    const config = this.namespaceConfigs()[namespace];
    if (!config?.dbKey) {
      this.store.showToast(`⚠️ Enter a DB key for "${namespace}" before fetching.`);
      return;
    }

    this.loadingNamespaces.update((current) => new Set(current).add(namespace));
    const data = await this.mockDb.fetchFromDb(namespace, config.dbKey);
    this.loadingNamespaces.update((current) => {
      const next = new Set(current);
      next.delete(namespace);
      return next;
    });

    if (!data) {
      this.store.showToast(`❌ No data found for "${namespace}" with key "${config.dbKey}".`);
      return;
    }

    const cloned = JSON.parse(JSON.stringify(data)) as NamespaceData;
    this.namespaceConfigs.update((configs) => ({
      ...configs,
      [namespace]: {
        ...configs[namespace],
        data: cloned,
        isFetched: true,
        isEdited: false,
      },
    }));
    this.editingJson.update((current) => ({ ...current, [namespace]: JSON.stringify(cloned, null, 2) }));
    this.jsonErrors.update((current) => {
      const next = { ...current };
      delete next[namespace];
      return next;
    });
    this.store.testData.update((current) => ({ ...current, [namespace]: cloned }));
    this.store.showToast(`✅ Fetched "${namespace}" data for key "${config.dbKey}" successfully.`);
  }

  onJsonEdit(namespace: string, text: string) {
    this.editingJson.update((current) => ({ ...current, [namespace]: text }));

    try {
      const parsed = JSON.parse(text) as NamespaceData;
      this.jsonErrors.update((current) => {
        const next = { ...current };
        delete next[namespace];
        return next;
      });
      this.namespaceConfigs.update((configs) => ({
        ...configs,
        [namespace]: {
          ...configs[namespace],
          data: parsed,
          isEdited: true,
          isFetched: true,
        },
      }));
      this.store.testData.update((current) => ({ ...current, [namespace]: parsed }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid JSON';
      this.jsonErrors.update((current) => ({ ...current, [namespace]: message }));
    }
  }

  getJsonText(namespace: string): string {
    const cached = this.editingJson()[namespace];
    if (cached !== undefined) {
      return cached;
    }

    const data = this.namespaceConfigs()[namespace]?.data;
    return data && Object.keys(data).length > 0 ? JSON.stringify(data, null, 2) : '';
  }

  hasError(namespace: string): boolean {
    return !!this.jsonErrors()[namespace];
  }

  hasData(namespace: string): boolean {
    const data = this.namespaceConfigs()[namespace]?.data;
    return !!data && Object.keys(data).length > 0;
  }

  lineNumbers(text: string): number[] {
    return Array.from({ length: Math.max(1, text.split('\n').length) }, (_, index) => index + 1);
  }

  attrsFor(namespace: string): string[] {
    return this.namespaceAttributes()[namespace] ?? [];
  }

  isAttributePresent(namespace: string, attribute: string): boolean {
    const config = this.namespaceConfigs()[namespace];
    return config ? config.data[attribute] !== undefined : false;
  }

  saveSnapshot() {
    if (Object.keys(this.jsonErrors()).length > 0) {
      this.store.showToast('❌ Fix JSON errors before saving.');
      return;
    }

    this.store.showToast('💾 Test data snapshot saved successfully.');
  }

  evaluateRule() {
    if (!this.allNamespacesReady()) {
      this.store.showToast('⚠️ Fetch or provide data for all namespaces before running.');
      return;
    }

    this.store.activeTab.set('test-runs');
  }
}
