import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { NamespaceConfig, NamespaceData, TestCase } from '../../models/types';
import { MockDbService } from '../../services/mock-db.service';
import { RuleEngineService } from '../../services/rule-engine.service';
import { RuleStoreService } from '../../services/rule-store.service';

interface TableRow {
  id: number;
  key: string;
  valueText: string;
}

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

  // Per-namespace editor view: 'table' (field rows) or 'json'
  readonly viewModes = signal<Record<string, 'table' | 'json'>>({});
  // Per-namespace table draft rows (key/value pairs being edited)
  readonly tableDrafts = signal<Record<string, TableRow[]>>({});
  private rowSeq = 0;

  // Save as Test Case modal
  readonly showSaveModal = signal(false);
  readonly saveName = signal('');
  readonly saveDescription = signal('');

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
    const nextModes = { ...this.viewModes() };
    const nextDrafts = { ...this.tableDrafts() };

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
      nextModes[namespace] ??= 'table';
      nextDrafts[namespace] = this.buildDraft(nextConfigs[namespace].data);
    }

    this.namespaceConfigs.set(nextConfigs);
    this.editingJson.set(nextEditing);
    this.viewModes.set(nextModes);
    this.tableDrafts.set(nextDrafts);
    this.jsonErrors.set({});
    this.expandedNamespaces.set(new Set(namespaces));
  }

  // --- Editor view toggle (table <-> json) ---

  viewMode(namespace: string): 'table' | 'json' {
    return this.viewModes()[namespace] ?? 'table';
  }

  setViewMode(namespace: string, mode: 'table' | 'json') {
    if (this.viewMode(namespace) === mode) return;
    const data = this.namespaceConfigs()[namespace]?.data ?? {};
    if (mode === 'table') {
      // Rebuild table rows from current data so it reflects JSON edits
      this.tableDrafts.update((drafts) => ({ ...drafts, [namespace]: this.buildDraft(data) }));
    } else {
      // Rebuild JSON text from current data so it reflects table edits
      this.editingJson.update((current) => ({ ...current, [namespace]: JSON.stringify(data, null, 2) }));
      this.jsonErrors.update((current) => { const next = { ...current }; delete next[namespace]; return next; });
    }
    this.viewModes.update((modes) => ({ ...modes, [namespace]: mode }));
  }

  // --- Table editing ---

  private buildDraft(data: NamespaceData): TableRow[] {
    return Object.entries(data ?? {}).map(([key, value]) => ({
      id: this.rowSeq++,
      key,
      valueText: this.valueToText(value),
    }));
  }

  private valueToText(value: any): string {
    if (typeof value === 'string') return value;
    if (value === undefined) return '';
    return JSON.stringify(value);
  }

  private textToValue(text: string): any {
    const trimmed = text.trim();
    if (trimmed === '') return '';
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
    if (/^[[{"]/.test(trimmed)) {
      try { return JSON.parse(trimmed); } catch { return text; }
    }
    return text;
  }

  tableRows(namespace: string): TableRow[] {
    return this.tableDrafts()[namespace] ?? [];
  }

  rowValueType(row: TableRow): string {
    const v = this.textToValue(row.valueText);
    if (Array.isArray(v)) return 'array';
    if (v === null) return 'null';
    return typeof v;
  }

  updateRowKey(namespace: string, id: number, key: string) {
    this.tableDrafts.update((drafts) => ({
      ...drafts,
      [namespace]: (drafts[namespace] ?? []).map((r) => (r.id === id ? { ...r, key } : r)),
    }));
    this.commitDraft(namespace);
  }

  updateRowValue(namespace: string, id: number, valueText: string) {
    this.tableDrafts.update((drafts) => ({
      ...drafts,
      [namespace]: (drafts[namespace] ?? []).map((r) => (r.id === id ? { ...r, valueText } : r)),
    }));
    this.commitDraft(namespace);
  }

  addRow(namespace: string) {
    if (!this.isExpanded(namespace)) this.expandedNamespaces.update((s) => new Set(s).add(namespace));
    this.tableDrafts.update((drafts) => ({
      ...drafts,
      [namespace]: [...(drafts[namespace] ?? []), { id: this.rowSeq++, key: '', valueText: '' }],
    }));
  }

  removeRow(namespace: string, id: number) {
    this.tableDrafts.update((drafts) => ({
      ...drafts,
      [namespace]: (drafts[namespace] ?? []).filter((r) => r.id !== id),
    }));
    this.commitDraft(namespace);
  }

  /** Rebuild the namespace data object from its table rows and sync everywhere. */
  private commitDraft(namespace: string) {
    const rows = this.tableDrafts()[namespace] ?? [];
    const data: NamespaceData = {};
    for (const row of rows) {
      const key = row.key.trim();
      if (!key) continue;
      data[key] = this.textToValue(row.valueText);
    }
    this.namespaceConfigs.update((configs) => ({
      ...configs,
      [namespace]: { ...configs[namespace], data, isEdited: true, isFetched: true },
    }));
    this.editingJson.update((current) => ({ ...current, [namespace]: JSON.stringify(data, null, 2) }));
    this.jsonErrors.update((current) => { const next = { ...current }; delete next[namespace]; return next; });
    this.store.testData.update((current) => ({ ...current, [namespace]: data }));
  }

  toggleNamespace(namespace: string) {
    this.expandedNamespaces.update((current) => {
      const next = new Set(current);
      if (next.has(namespace)) next.delete(namespace);
      else next.add(namespace);
      return next;
    });
  }

  isExpanded(namespace: string): boolean { return this.expandedNamespaces().has(namespace); }
  isLoading(namespace: string): boolean { return this.loadingNamespaces().has(namespace); }
  getConfig(namespace: string): NamespaceConfig | undefined { return this.namespaceConfigs()[namespace]; }
  getAvailableKeys(namespace: string): string[] { return this.mockDb.getAvailableKeys(namespace); }

  updateDbKey(namespace: string, key: string) {
    this.namespaceConfigs.update(configs => ({ ...configs, [namespace]: { ...configs[namespace], dbKey: key } }));
  }

  async fetchNamespace(namespace: string) {
    const config = this.namespaceConfigs()[namespace];
    if (!config?.dbKey) { this.store.showToast(`⚠️ Enter a DB key for "${namespace}" before fetching.`); return; }

    this.loadingNamespaces.update(current => new Set(current).add(namespace));
    const data = await this.mockDb.fetchFromDb(namespace, config.dbKey);
    this.loadingNamespaces.update(current => { const next = new Set(current); next.delete(namespace); return next; });

    if (!data) { this.store.showToast(`❌ No data found for "${namespace}" with key "${config.dbKey}".`); return; }

    const cloned = JSON.parse(JSON.stringify(data)) as NamespaceData;
    this.namespaceConfigs.update(configs => ({ ...configs, [namespace]: { ...configs[namespace], data: cloned, isFetched: true, isEdited: false } }));
    this.editingJson.update(current => ({ ...current, [namespace]: JSON.stringify(cloned, null, 2) }));
    this.tableDrafts.update(drafts => ({ ...drafts, [namespace]: this.buildDraft(cloned) }));
    this.jsonErrors.update(current => { const next = { ...current }; delete next[namespace]; return next; });
    this.store.testData.update(current => ({ ...current, [namespace]: cloned }));
    this.store.showToast(`✅ Fetched "${namespace}" data for key "${config.dbKey}" successfully.`);
  }

  onJsonEdit(namespace: string, text: string) {
    this.editingJson.update(current => ({ ...current, [namespace]: text }));
    try {
      const parsed = JSON.parse(text) as NamespaceData;
      this.jsonErrors.update(current => { const next = { ...current }; delete next[namespace]; return next; });
      this.namespaceConfigs.update(configs => ({ ...configs, [namespace]: { ...configs[namespace], data: parsed, isEdited: true, isFetched: true } }));
      this.store.testData.update(current => ({ ...current, [namespace]: parsed }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid JSON';
      this.jsonErrors.update(current => ({ ...current, [namespace]: message }));
    }
  }

  getJsonText(namespace: string): string {
    const cached = this.editingJson()[namespace];
    if (cached !== undefined) return cached;
    const data = this.namespaceConfigs()[namespace]?.data;
    return data && Object.keys(data).length > 0 ? JSON.stringify(data, null, 2) : '';
  }

  hasError(namespace: string): boolean { return !!this.jsonErrors()[namespace]; }
  hasData(namespace: string): boolean {
    const data = this.namespaceConfigs()[namespace]?.data;
    return !!data && Object.keys(data).length > 0;
  }

  lineNumbers(text: string): number[] {
    return Array.from({ length: Math.max(1, text.split('\n').length) }, (_, index) => index + 1);
  }

  attrsFor(namespace: string): string[] { return this.namespaceAttributes()[namespace] ?? []; }

  isAttributePresent(namespace: string, attribute: string): boolean {
    const config = this.namespaceConfigs()[namespace];
    return config ? config.data[attribute] !== undefined : false;
  }

  saveSnapshot() {
    if (Object.keys(this.jsonErrors()).length > 0) { this.store.showToast('❌ Fix JSON errors before saving.'); return; }
    this.store.showToast('💾 Test data snapshot saved successfully.');
  }

  evaluateRule() {
    if (!this.allNamespacesReady()) { this.store.showToast('⚠️ Fetch or provide data for all namespaces before running.'); return; }
    this.store.activeTab.set('test-runs');
  }

  openSaveModal() {
    if (!this.allNamespacesReady()) { this.store.showToast('⚠️ Provide data for all namespaces first.'); return; }
    this.saveName.set('');
    this.saveDescription.set('');
    this.showSaveModal.set(true);
  }

  confirmSave() {
    const name = this.saveName().trim();
    if (!name) { this.store.showToast('⚠️ Enter a name for the test case.'); return; }

    const configs = this.namespaceConfigs();
    const dbKeys: Record<string, string> = {};
    const snapshot = this.store.testData();
    for (const ns of this.namespaces()) {
      dbKeys[ns] = configs[ns]?.dbKey ?? '';
    }

    const tc: TestCase = {
      id: `tc-${Date.now()}`,
      name,
      description: this.saveDescription().trim(),
      ruleId: this.store.selectedRuleId(),
      dbKeys,
      snapshot: JSON.parse(JSON.stringify(snapshot)),
      createdAt: new Date().toISOString(),
    };
    this.store.saveTestCase(tc);
    this.showSaveModal.set(false);
    this.store.showToast(`✅ Test case "${name}" saved.`);
  }
}
