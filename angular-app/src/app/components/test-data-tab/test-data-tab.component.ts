import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { NamespaceConfig, NamespaceData, TestCase } from '../../models/types';
import { MockDbService } from '../../services/mock-db.service';
import { RuleEngineService } from '../../services/rule-engine.service';
import { RuleStoreService } from '../../services/rule-store.service';

interface GridRow {
  id: number;
  cells: Record<string, string>;
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

  /** Namespaces fetched from the database (everything that is not session/context). */
  readonly dbNamespaces = computed(() => this.namespaces().filter((ns) => !this.ruleEngine.isSessionNamespace(ns)));
  /** Session namespaces (supplied by the calling application), with their attributes. */
  readonly sessionNamespaceAttrs = computed<Record<string, string[]>>(() => {
    const attrs = this.namespaceAttributes();
    const out: Record<string, string[]> = {};
    for (const ns of Object.keys(attrs)) {
      if (this.ruleEngine.isSessionNamespace(ns)) out[ns] = attrs[ns];
    }
    return out;
  });
  readonly hasSessionData = computed(() => Object.keys(this.sessionNamespaceAttrs()).length > 0);

  /** Session field values keyed by "namespace.attribute". */
  readonly sessionValues = signal<Record<string, string>>({});

  readonly expandedNamespaces = signal<Set<string>>(new Set());
  readonly namespaceConfigs = signal<Record<string, NamespaceConfig>>({});
  readonly loadingNamespaces = signal<Set<string>>(new Set());
  readonly editingJson = signal<Record<string, string>>({});
  readonly jsonErrors = signal<Record<string, string>>({});

  // Per-namespace editor view: 'table' (spreadsheet grid) or 'json'
  readonly viewModes = signal<Record<string, 'table' | 'json'>>({});
  // Spreadsheet grid state: columns (attributes) + rows (records) per namespace
  readonly gridColumns = signal<Record<string, string[]>>({});
  readonly gridRows = signal<Record<string, GridRow[]>>({});
  readonly activeRowId = signal<Record<string, number>>({});
  readonly newColumnName = signal<Record<string, string>>({});
  private rowSeq = 0;

  // Save as Test Case modal
  readonly showSaveModal = signal(false);
  readonly saveName = signal('');
  readonly saveDescription = signal('');
  readonly saveExpected = signal<'PASSED' | 'FAILED' | 'NONE'>('NONE');

  readonly allNamespacesReady = computed(() =>
    this.dbNamespaces().every((namespace) => {
      const config = this.namespaceConfigs()[namespace];
      return !!config && (config.isFetched || Object.keys(config.data).length > 0);
    }),
  );

  constructor() {
    effect(() => {
      this.store.selectedRuleId();
      const namespaces = this.dbNamespaces();
      const sessionAttrs = this.sessionNamespaceAttrs();
      untracked(() => {
        this.initializeNamespaceConfigs(namespaces);
        this.initializeSessionValues(sessionAttrs);
      });
    });
  }

  /** Seed session field values from the current snapshot (calling-app supplied data). */
  private initializeSessionValues(sessionAttrs: Record<string, string[]>) {
    const snapshot = this.store.testData();
    const values: Record<string, string> = {};
    for (const ns of Object.keys(sessionAttrs)) {
      for (const attr of sessionAttrs[ns]) {
        const current = snapshot[ns]?.[attr];
        values[`${ns}.${attr}`] = current === undefined ? '' : this.valueToText(current);
      }
    }
    this.sessionValues.set(values);
    this.commitSessionData(values, sessionAttrs);
  }

  sessionValue(ns: string, attr: string): string {
    return this.sessionValues()[`${ns}.${attr}`] ?? '';
  }

  setSessionValue(ns: string, attr: string, text: string) {
    const next = { ...this.sessionValues(), [`${ns}.${attr}`]: text };
    this.sessionValues.set(next);
    this.commitSessionData(next, this.sessionNamespaceAttrs());
  }

  sessionTypeHint(ns: string, attr: string): string {
    return this.typeOfText(this.sessionValue(ns, attr));
  }

  /** Write session field values into the store snapshot so evaluation uses them. */
  private commitSessionData(values: Record<string, string>, sessionAttrs: Record<string, string[]>) {
    const snapshot = { ...this.store.testData() };
    for (const ns of Object.keys(sessionAttrs)) {
      const data: NamespaceData = { ...(snapshot[ns] ?? {}) };
      for (const attr of sessionAttrs[ns]) {
        const text = values[`${ns}.${attr}`];
        if (text !== undefined && text.trim() !== '') {
          data[attr] = this.textToValue(text);
        } else {
          delete data[attr];
        }
      }
      snapshot[ns] = data;
    }
    this.store.testData.set(snapshot);
  }

  // --- Invocation context (persona + request params) ---

  setPersonaType(type: 'MID' | 'WID') {
    this.store.invocation.update((c) => ({ ...c, personaType: type }));
  }
  setPersonaId(id: string) {
    this.store.invocation.update((c) => ({ ...c, personaId: id }));
  }
  addRequestParam() {
    this.store.invocation.update((c) => ({ ...c, requestParams: [...c.requestParams, { key: '', value: '' }] }));
  }
  removeRequestParam(i: number) {
    this.store.invocation.update((c) => ({ ...c, requestParams: c.requestParams.filter((_, idx) => idx !== i) }));
  }
  updateRequestParam(i: number, field: 'key' | 'value', val: string) {
    this.store.invocation.update((c) => ({
      ...c,
      requestParams: c.requestParams.map((p, idx) => (idx === i ? { ...p, [field]: val } : p)),
    }));
  }

  private initializeNamespaceConfigs(namespaces: string[]) {
    const currentConfigs = this.namespaceConfigs();
    const snapshot = this.store.testData();
    const nextConfigs: Record<string, NamespaceConfig> = {};
    const nextEditing = { ...this.editingJson() };
    const nextModes = { ...this.viewModes() };
    const nextColumns = { ...this.gridColumns() };
    const nextRows = { ...this.gridRows() };
    const nextActive = { ...this.activeRowId() };

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

      if (!nextColumns[namespace]) {
        const records = Object.keys(data).length ? [data] : [];
        const cols = this.buildColumns(namespace, records);
        const rows: GridRow[] = records.map((r) => ({ id: this.rowSeq++, cells: this.recordToCells(cols, r) }));
        if (!rows.length) rows.push({ id: this.rowSeq++, cells: this.emptyCells(cols) });
        nextColumns[namespace] = cols;
        nextRows[namespace] = rows;
        nextActive[namespace] = rows[0].id;
      }
    }

    this.namespaceConfigs.set(nextConfigs);
    this.editingJson.set(nextEditing);
    this.viewModes.set(nextModes);
    this.gridColumns.set(nextColumns);
    this.gridRows.set(nextRows);
    this.activeRowId.set(nextActive);
    this.jsonErrors.set({});
    this.expandedNamespaces.set(new Set(namespaces));

    // Restore active grid records into the store so readiness/evaluation stay in sync
    const restored = { ...this.store.testData() };
    const restoredConfigs = { ...this.namespaceConfigs() };
    for (const namespace of namespaces) {
      const record = this.activeRecord(namespace);
      if (Object.keys(record).length) {
        restored[namespace] = record;
        restoredConfigs[namespace] = { ...restoredConfigs[namespace], data: record, isFetched: true };
      }
    }
    this.store.testData.set(restored);
    this.namespaceConfigs.set(restoredConfigs);
  }

  // --- Editor view toggle (table <-> json) ---

  viewMode(namespace: string): 'table' | 'json' {
    return this.viewModes()[namespace] ?? 'table';
  }

  setViewMode(namespace: string, mode: 'table' | 'json') {
    if (this.viewMode(namespace) === mode) return;
    if (mode === 'json') {
      const data = this.activeRecord(namespace);
      this.editingJson.update((current) => ({ ...current, [namespace]: JSON.stringify(data, null, 2) }));
      this.jsonErrors.update((current) => { const next = { ...current }; delete next[namespace]; return next; });
    }
    this.viewModes.update((modes) => ({ ...modes, [namespace]: mode }));
  }

  // --- Value typing helpers ---

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

  private typeOfText(text: string): string {
    if (text === undefined || text.trim() === '') return 'empty';
    const v = this.textToValue(text);
    if (Array.isArray(v)) return 'array';
    if (v === null) return 'null';
    if (typeof v === 'object') return 'object';
    return typeof v;
  }

  // --- Grid construction ---

  private buildColumns(namespace: string, records: NamespaceData[]): string[] {
    const cols: string[] = [];
    const add = (c: string) => { if (c && !cols.includes(c)) cols.push(c); };
    add('id');
    this.attrsFor(namespace).forEach(add);
    records.forEach((r) => Object.keys(r).forEach(add));
    return cols;
  }

  private recordToCells(cols: string[], record: NamespaceData): Record<string, string> {
    const cells: Record<string, string> = {};
    for (const col of cols) cells[col] = this.valueToText(record[col]);
    return cells;
  }

  private emptyCells(cols: string[]): Record<string, string> {
    const cells: Record<string, string> = {};
    for (const col of cols) cells[col] = '';
    return cells;
  }

  private cellsToRecord(cols: string[], cells: Record<string, string>): NamespaceData {
    const record: NamespaceData = {};
    for (const col of cols) {
      const text = cells[col];
      if (text === undefined || text.trim() === '') continue;
      record[col] = this.textToValue(text);
    }
    return record;
  }

  // --- Grid accessors ---

  columnsFor(namespace: string): string[] { return this.gridColumns()[namespace] ?? []; }
  rowsFor(namespace: string): GridRow[] { return this.gridRows()[namespace] ?? []; }

  primaryKey(namespace: string): string {
    const cols = this.columnsFor(namespace);
    return cols.includes('id') ? 'id' : (cols[0] ?? 'id');
  }

  isPrimaryKey(namespace: string, col: string): boolean { return col === this.primaryKey(namespace); }

  /** Datatype shared by a column's cells (for header tooltip). */
  columnType(namespace: string, col: string): string {
    for (const row of this.rowsFor(namespace)) {
      const t = this.typeOfText(row.cells[col]);
      if (t !== 'empty') return t;
    }
    return 'empty';
  }

  cellType(row: GridRow, col: string): string { return this.typeOfText(row.cells[col]); }

  cellValue(row: GridRow, col: string): string { return row.cells[col] ?? ''; }

  isActiveRow(namespace: string, rowId: number): boolean { return this.activeRowId()[namespace] === rowId; }

  private activeRecord(namespace: string): NamespaceData {
    const cols = this.columnsFor(namespace);
    const rows = this.rowsFor(namespace);
    const active = rows.find((r) => r.id === this.activeRowId()[namespace]) ?? rows[0];
    return active ? this.cellsToRecord(cols, active.cells) : {};
  }

  // --- Grid mutations ---

  updateCell(namespace: string, rowId: number, col: string, text: string) {
    this.gridRows.update((all) => ({
      ...all,
      [namespace]: (all[namespace] ?? []).map((r) =>
        r.id === rowId ? { ...r, cells: { ...r.cells, [col]: text } } : r,
      ),
    }));
    if (this.isActiveRow(namespace, rowId)) this.syncActive(namespace);
  }

  setActiveRow(namespace: string, rowId: number) {
    this.activeRowId.update((all) => ({ ...all, [namespace]: rowId }));
    this.syncActive(namespace);
  }

  addGridRow(namespace: string) {
    if (!this.isExpanded(namespace)) this.expandedNamespaces.update((s) => new Set(s).add(namespace));
    const cols = this.columnsFor(namespace);
    const cells = this.emptyCells(cols);
    const pk = this.primaryKey(namespace);
    cells[pk] = this.uniquePk(namespace, namespace.toUpperCase().slice(0, 4) + '-NEW');
    const row: GridRow = { id: this.rowSeq++, cells };
    this.gridRows.update((all) => ({ ...all, [namespace]: [...(all[namespace] ?? []), row] }));
  }

  /** Copy a row into a new row directly below, with a fresh primary key. */
  copyRow(namespace: string, rowId: number) {
    const rows = this.rowsFor(namespace);
    const idx = rows.findIndex((r) => r.id === rowId);
    if (idx < 0) return;
    const source = rows[idx];
    const pk = this.primaryKey(namespace);
    const cells = { ...source.cells };
    cells[pk] = this.uniquePk(namespace, (source.cells[pk] || namespace.toUpperCase().slice(0, 4)) + '-COPY');
    const copy: GridRow = { id: this.rowSeq++, cells };
    const next = [...rows.slice(0, idx + 1), copy, ...rows.slice(idx + 1)];
    this.gridRows.update((all) => ({ ...all, [namespace]: next }));
    this.setActiveRow(namespace, copy.id);
    this.store.showToast(`📋 Row copied as "${cells[pk]}".`);
  }

  removeRow(namespace: string, rowId: number) {
    const rows = this.rowsFor(namespace);
    if (rows.length <= 1) { this.store.showToast('⚠️ At least one row is required.'); return; }
    const next = rows.filter((r) => r.id !== rowId);
    this.gridRows.update((all) => ({ ...all, [namespace]: next }));
    if (this.activeRowId()[namespace] === rowId) {
      this.activeRowId.update((all) => ({ ...all, [namespace]: next[0].id }));
    }
    this.syncActive(namespace);
  }

  updateNewColumnName(namespace: string, name: string) {
    this.newColumnName.update((all) => ({ ...all, [namespace]: name }));
  }

  addColumn(namespace: string) {
    const name = (this.newColumnName()[namespace] ?? '').trim();
    if (!name) { this.store.showToast('⚠️ Enter a column name.'); return; }
    if (this.columnsFor(namespace).includes(name)) { this.store.showToast(`⚠️ Column "${name}" already exists.`); return; }
    this.gridColumns.update((all) => ({ ...all, [namespace]: [...(all[namespace] ?? []), name] }));
    this.gridRows.update((all) => ({
      ...all,
      [namespace]: (all[namespace] ?? []).map((r) => ({ ...r, cells: { ...r.cells, [name]: '' } })),
    }));
    this.newColumnName.update((all) => ({ ...all, [namespace]: '' }));
  }

  removeColumn(namespace: string, col: string) {
    if (this.isPrimaryKey(namespace, col)) { this.store.showToast('⚠️ Cannot remove the primary key column.'); return; }
    this.gridColumns.update((all) => ({ ...all, [namespace]: (all[namespace] ?? []).filter((c) => c !== col) }));
    this.gridRows.update((all) => ({
      ...all,
      [namespace]: (all[namespace] ?? []).map((r) => {
        const cells = { ...r.cells };
        delete cells[col];
        return { ...r, cells };
      }),
    }));
    this.syncActive(namespace);
  }

  private uniquePk(namespace: string, base: string): string {
    const pk = this.primaryKey(namespace);
    const existing = new Set(this.rowsFor(namespace).map((r) => r.cells[pk]));
    if (!existing.has(base)) return base;
    let i = 2;
    while (existing.has(`${base}-${i}`)) i++;
    return `${base}-${i}`;
  }

  /** Push the active row's record into the store + JSON view + config. */
  private syncActive(namespace: string) {
    const data = this.activeRecord(namespace);
    this.namespaceConfigs.update((configs) => ({
      ...configs,
      [namespace]: { ...configs[namespace], data, isEdited: true, isFetched: true },
    }));
    this.editingJson.update((current) => ({ ...current, [namespace]: JSON.stringify(data, null, 2) }));
    this.jsonErrors.update((current) => { const next = { ...current }; delete next[namespace]; return next; });
    this.store.testData.update((current) => ({ ...current, [namespace]: data }));
  }

  /** Add or update a fetched record as a grid row (keyed by primary key) and make it active. */
  private upsertRecord(namespace: string, record: NamespaceData) {
    const cols = this.buildColumns(namespace, [...this.rowsToRecords(namespace), record]);
    const pk = cols.includes('id') ? 'id' : cols[0];
    const pkValue = this.valueToText(record[pk]);
    const rows = this.rowsFor(namespace);
    const existingIdx = pkValue ? rows.findIndex((r) => r.cells[pk] === pkValue) : -1;
    const cells = this.recordToCells(cols, record);

    let activeId: number;
    let nextRows: GridRow[];
    if (existingIdx >= 0) {
      activeId = rows[existingIdx].id;
      nextRows = rows.map((r, i) => (i === existingIdx ? { id: r.id, cells } : { ...r, cells: this.recordToCells(cols, this.cellsToRecord(this.columnsFor(namespace), r.cells)) }));
    } else {
      const row: GridRow = { id: this.rowSeq++, cells };
      activeId = row.id;
      nextRows = [...rows.map((r) => ({ ...r, cells: this.padCells(cols, r.cells) })), row];
    }

    this.gridColumns.update((all) => ({ ...all, [namespace]: cols }));
    this.gridRows.update((all) => ({ ...all, [namespace]: nextRows }));
    this.activeRowId.update((all) => ({ ...all, [namespace]: activeId }));
    this.syncActive(namespace);
  }

  private padCells(cols: string[], cells: Record<string, string>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const col of cols) out[col] = cells[col] ?? '';
    return out;
  }

  private rowsToRecords(namespace: string): NamespaceData[] {
    const cols = this.columnsFor(namespace);
    return this.rowsFor(namespace).map((r) => this.cellsToRecord(cols, r.cells));
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
    this.upsertRecord(namespace, cloned);
    this.store.showToast(`✅ Fetched "${namespace}" data for key "${config.dbKey}" successfully.`);
  }

  onJsonEdit(namespace: string, text: string) {
    this.editingJson.update(current => ({ ...current, [namespace]: text }));
    try {
      const parsed = JSON.parse(text) as NamespaceData;
      this.jsonErrors.update(current => { const next = { ...current }; delete next[namespace]; return next; });
      // Reflect JSON edits back into the active grid row
      const cols = this.buildColumns(namespace, [...this.rowsToRecords(namespace), parsed]);
      const activeId = this.activeRowId()[namespace];
      this.gridColumns.update(all => ({ ...all, [namespace]: cols }));
      this.gridRows.update(all => ({
        ...all,
        [namespace]: (all[namespace] ?? []).map(r =>
          r.id === activeId
            ? { id: r.id, cells: this.recordToCells(cols, parsed) }
            : { ...r, cells: this.padCells(cols, r.cells) },
        ),
      }));
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
    this.saveExpected.set('NONE');
    this.showSaveModal.set(true);
  }

  confirmSave() {
    const name = this.saveName().trim();
    if (!name) { this.store.showToast('⚠️ Enter a name for the test case.'); return; }

    const configs = this.namespaceConfigs();
    const dbKeys: Record<string, string> = {};
    const snapshot = this.store.testData();
    for (const ns of this.dbNamespaces()) {
      dbKeys[ns] = configs[ns]?.dbKey ?? '';
    }

    const expected = this.saveExpected();
    const snapshotCopy = JSON.parse(JSON.stringify(snapshot));
    const tc: TestCase = {
      id: `tc-${Date.now()}`,
      name,
      description: this.saveDescription().trim(),
      ruleId: this.store.selectedRuleId(),
      dbKeys,
      snapshot: snapshotCopy,
      invocation: JSON.parse(JSON.stringify(this.store.invocation())),
      createdAt: new Date().toISOString(),
      expectedResult: expected === 'NONE' ? undefined : expected,
      // Pin the data the expectation is based on so later runs can tell a real
      // rule bug (same data, different result) from data drift.
      expectedSnapshot: expected === 'NONE' ? undefined : JSON.parse(JSON.stringify(snapshot)),
    };
    this.store.saveTestCase(tc);
    this.showSaveModal.set(false);
    this.store.showToast(`✅ Test case "${name}" saved.`);
  }
}
