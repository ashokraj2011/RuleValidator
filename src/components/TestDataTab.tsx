import React, { useState, useEffect, useMemo } from 'react';
import { 
  Code, 
  Database, 
  Save, 
  Sparkles, 
  CheckCircle, 
  ChevronRight,
  ChevronDown,
  Info,
  Download,
  RefreshCw,
  Edit3,
  Search,
  Layers,
  AlertTriangle,
  PlayCircle
} from 'lucide-react';
import { Rule, NamespaceConfig, TestDataSnapshot } from '../types';
import { extractNamespaces, extractNamespaceAttributes } from '../ruleEngine';
import { fetchFromDb, getAvailableKeys } from '../mockDb';

interface TestDataTabProps {
  rule: Rule;
  allRules: Rule[];
  testData: TestDataSnapshot;
  setTestData: React.Dispatch<React.SetStateAction<TestDataSnapshot>>;
  onSwitchTab: (tab: 'overview' | 'test-data' | 'generated' | 'test-runs' | 'coverage') => void;
  onRunTest: () => void;
}

export default function TestDataTab({
  rule,
  allRules,
  testData,
  setTestData,
  onSwitchTab,
  onRunTest,
}: TestDataTabProps) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [expandedNs, setExpandedNs] = useState<Set<string>>(new Set());
  const [nsConfigs, setNsConfigs] = useState<Record<string, NamespaceConfig>>({});
  const [loadingNs, setLoadingNs] = useState<Set<string>>(new Set());
  const [editingJson, setEditingJson] = useState<Record<string, string>>({});
  const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({});

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Extract namespaces & attributes from the current rule (including chained rules)
  const namespaces = useMemo(() => extractNamespaces(rule, allRules), [rule, allRules]);
  const nsAttributes = useMemo(() => extractNamespaceAttributes(rule, allRules), [rule, allRules]);

  // Initialize namespace configs when rule changes
  useEffect(() => {
    const newConfigs: Record<string, NamespaceConfig> = {};
    const newExpanded = new Set<string>();
    for (const ns of namespaces) {
      if (nsConfigs[ns]) {
        newConfigs[ns] = nsConfigs[ns];
      } else {
        newConfigs[ns] = {
          namespace: ns,
          dbKey: '',
          data: testData[ns] || {},
          isFetched: !!testData[ns],
          isEdited: false,
        };
      }
      newExpanded.add(ns);
    }
    setNsConfigs(newConfigs);
    setExpandedNs(newExpanded);
  }, [namespaces.join(',')]);

  const toggleNs = (ns: string) => {
    setExpandedNs(prev => {
      const next = new Set(prev);
      if (next.has(ns)) next.delete(ns);
      else next.add(ns);
      return next;
    });
  };

  // Fetch data from DB for a namespace
  const handleFetch = async (ns: string) => {
    const config = nsConfigs[ns];
    if (!config?.dbKey) {
      showToast(`⚠️ Enter a DB key for "${ns}" before fetching.`);
      return;
    }

    setLoadingNs(prev => new Set(prev).add(ns));

    const data = await fetchFromDb(ns, config.dbKey);
    
    setLoadingNs(prev => {
      const next = new Set(prev);
      next.delete(ns);
      return next;
    });

    if (data) {
      const updated = { ...nsConfigs };
      updated[ns] = { ...updated[ns], data, isFetched: true, isEdited: false };
      setNsConfigs(updated);

      // Sync to testData
      setTestData(prev => ({ ...prev, [ns]: data }));
      setEditingJson(prev => ({ ...prev, [ns]: JSON.stringify(data, null, 2) }));
      setJsonErrors(prev => { const next = { ...prev }; delete next[ns]; return next; });
      showToast(`✅ Fetched "${ns}" data for key "${config.dbKey}" successfully.`);
    } else {
      showToast(`❌ No data found for "${ns}" with key "${config.dbKey}".`);
    }
  };

  // Update DB key for a namespace
  const updateDbKey = (ns: string, key: string) => {
    setNsConfigs(prev => ({
      ...prev,
      [ns]: { ...prev[ns], dbKey: key },
    }));
  };

  // Handle JSON edit for a namespace
  const handleJsonEdit = (ns: string, text: string) => {
    setEditingJson(prev => ({ ...prev, [ns]: text }));

    try {
      const parsed = JSON.parse(text);
      setJsonErrors(prev => { const next = { ...prev }; delete next[ns]; return next; });
      setNsConfigs(prev => ({
        ...prev,
        [ns]: { ...prev[ns], data: parsed, isEdited: true },
      }));
      setTestData(prev => ({ ...prev, [ns]: parsed }));
    } catch (err: any) {
      setJsonErrors(prev => ({ ...prev, [ns]: err.message }));
    }
  };

  // Save all test data
  const handleSaveAll = () => {
    const hasErrors = Object.keys(jsonErrors).length > 0;
    if (hasErrors) {
      showToast('❌ Fix JSON errors before saving.');
      return;
    }
    showToast('💾 Test data snapshot saved successfully.');
  };

  const allNamespacesReady = namespaces.every(ns => {
    const config = nsConfigs[ns];
    return config && (config.isFetched || Object.keys(config.data).length > 0);
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-neutral-900 text-white px-5 py-3 rounded shadow-xl border border-primary flex items-center gap-3 animate-fade-in">
          <Sparkles className="w-5 h-5 text-yellow-500 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Header bar */}
      <div className="h-14 flex items-center justify-between px-5 border-b border-neutral-300 bg-white shrink-0 rounded-t-lg border border-neutral-300">
        <div className="flex items-center gap-3">
          <Database className="w-4.5 h-4.5 text-primary" />
          <div>
            <span className="text-sm font-bold text-neutral-800">Test Data — </span>
            <span className="text-sm font-bold text-primary">{rule.name}</span>
          </div>
          <span className="ml-2 px-2 py-0.5 bg-secondary/10 text-secondary text-[10px] font-bold rounded uppercase">
            {namespaces.length} Namespace{namespaces.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveAll}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-300 rounded text-xs font-semibold bg-white hover:bg-neutral-50 transition-colors"
          >
            <Save className="w-3.5 h-3.5 text-neutral-500" />
            Save Snapshot
          </button>
          <button
            type="button"
            onClick={() => {
              if (!allNamespacesReady) {
                showToast('⚠️ Fetch or provide data for all namespaces before running.');
                return;
              }
              onRunTest();
              onSwitchTab('test-runs');
            }}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-white rounded text-xs font-bold hover:opacity-90 transition-all"
          >
            <PlayCircle className="w-3.5 h-3.5" />
            Evaluate Rule
          </button>
        </div>
      </div>

      {/* Main content — two columns */}
      <div className="flex-1 min-h-0 flex overflow-hidden gap-5 mt-4">

        {/* Left: Namespace data panels */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
          {namespaces.map(ns => {
            const config = nsConfigs[ns];
            const isExpanded = expandedNs.has(ns);
            const isLoading = loadingNs.has(ns);
            const availableKeys = getAvailableKeys(ns);
            const attrs = nsAttributes[ns] || [];
            const jsonText = editingJson[ns] ?? (config?.data && Object.keys(config.data).length > 0 ? JSON.stringify(config.data, null, 2) : '');
            const hasError = !!jsonErrors[ns];
            const hasData = config && Object.keys(config.data).length > 0;

            return (
              <div key={ns} className="bg-white border border-neutral-300 rounded-lg overflow-hidden shadow-xs">
                {/* Namespace header */}
                <div
                  className="flex items-center justify-between px-4 py-3 bg-neutral-50 border-b border-neutral-300 cursor-pointer select-none hover:bg-neutral-100 transition-colors"
                  onClick={() => toggleNs(ns)}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-neutral-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-neutral-500" />
                    )}
                    <Layers className="w-4 h-4 text-secondary" />
                    <span className="text-xs font-bold text-neutral-800 uppercase tracking-wide">{ns}</span>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      [{attrs.join(', ')}]
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasData && !hasError && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-fidelity-green-bright">
                        <CheckCircle className="w-3.5 h-3.5" />
                        {config?.isEdited ? 'EDITED' : 'FETCHED'}
                      </span>
                    )}
                    {hasError && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-red-600">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        JSON ERROR
                      </span>
                    )}
                    {!hasData && !hasError && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600">
                        <Info className="w-3.5 h-3.5" />
                        NO DATA
                      </span>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 space-y-3">
                    {/* DB Key fetch row */}
                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">
                          DB Lookup Key
                        </label>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                            <input
                              type="text"
                              value={config?.dbKey || ''}
                              onChange={e => updateDbKey(ns, e.target.value)}
                              placeholder={availableKeys.length > 0 ? `e.g. ${availableKeys[0]}` : `Enter ${ns} key...`}
                              className="w-full pl-8 pr-3 py-2 border border-neutral-300 rounded text-xs font-mono focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                              list={`keys-${ns}`}
                            />
                            <datalist id={`keys-${ns}`}>
                              {availableKeys.map(k => (
                                <option key={k} value={k} />
                              ))}
                            </datalist>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleFetch(ns)}
                            disabled={isLoading}
                            className="flex items-center gap-1.5 px-3 py-2 bg-secondary text-white rounded text-xs font-bold hover:opacity-90 transition-all disabled:opacity-50"
                          >
                            {isLoading ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                            {isLoading ? 'Fetching...' : 'Fetch'}
                          </button>
                        </div>
                        {availableKeys.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {availableKeys.map(k => (
                              <button
                                key={k}
                                type="button"
                                onClick={() => {
                                  updateDbKey(ns, k);
                                }}
                                className={`px-2 py-0.5 text-[10px] font-mono border rounded cursor-pointer transition-colors ${
                                  config?.dbKey === k
                                    ? 'bg-secondary text-white border-secondary'
                                    : 'bg-neutral-50 text-neutral-600 border-neutral-250 hover:border-secondary hover:text-secondary'
                                }`}
                              >
                                {k}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Editable JSON panel */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
                          <Code className="w-3.5 h-3.5" />
                          Data Snapshot
                          {config?.isEdited && (
                            <span className="text-amber-600 normal-case">(edited — test grounded on this data)</span>
                          )}
                        </label>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          {jsonText ? `${jsonText.split('\n').length} lines` : 'empty'}
                        </span>
                      </div>
                      <div className="relative">
                        <div className="flex border border-neutral-300 rounded overflow-hidden">
                          {/* Line numbers */}
                          <div className="w-8 bg-neutral-50 border-r border-neutral-200 text-right pr-2 pt-3 text-neutral-400 font-mono text-[10px] select-none shrink-0">
                            {(jsonText || '\n').split('\n').map((_, i) => (
                              <div key={i} className="leading-5">{i + 1}</div>
                            ))}
                          </div>
                          <textarea
                            className="flex-1 p-3 bg-white text-neutral-800 font-mono text-xs leading-5 outline-none border-none resize-none ring-0 focus:ring-0 whitespace-pre min-h-[120px]"
                            value={jsonText}
                            onChange={e => handleJsonEdit(ns, e.target.value)}
                            placeholder={`{\n  "key": "value"\n}`}
                            spellCheck={false}
                            rows={Math.max(5, (jsonText || '').split('\n').length)}
                          />
                        </div>
                        {jsonErrors[ns] && (
                          <div className="mt-1 bg-red-50 text-red-700 text-[10px] py-1.5 px-3 border border-red-200 rounded flex items-center gap-1.5 font-mono">
                            <Info className="w-3.5 h-3.5 shrink-0" />
                            {jsonErrors[ns]}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Attributes used by rule */}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase">Used in rule:</span>
                      {attrs.map(attr => (
                        <span
                          key={attr}
                          className={`px-2 py-0.5 text-[10px] font-mono rounded border ${
                            hasData && config?.data[attr] !== undefined
                              ? 'bg-green-50 text-fidelity-green-bright border-green-200 font-bold'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {attr}: {hasData && config?.data[attr] !== undefined
                            ? JSON.stringify(config.data[attr])
                            : 'missing'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right: Rule JSON reference */}
        <aside className="w-80 shrink-0 hidden xl:flex flex-col gap-4 overflow-y-auto">
          {/* Rule JSON */}
          <div className="bg-white border border-neutral-300 rounded-lg overflow-hidden shadow-xs">
            <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-300 flex items-center gap-2">
              <Code className="w-4 h-4 text-secondary" />
              <span className="text-xs font-bold text-neutral-800 uppercase tracking-wide">Rule Definition</span>
            </div>
            <div className="p-3 bg-[#1e1e1e] text-[#d4d4d4] font-mono text-[11px] leading-5 overflow-auto max-h-[400px]">
              <pre className="whitespace-pre-wrap">{JSON.stringify(rule, null, 2)}</pre>
            </div>
          </div>

          {/* Chained rules info */}
          {allRules.length > 1 && (
            <div className="bg-white border border-neutral-300 rounded-lg overflow-hidden shadow-xs">
              <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-300 flex items-center gap-2">
                <Layers className="w-4 h-4 text-secondary" />
                <span className="text-xs font-bold text-neutral-800 uppercase tracking-wide">Chained Rules</span>
              </div>
              <div className="p-3 space-y-2">
                {allRules.map(r => (
                  <div
                    key={r.rule_id}
                    className={`p-2 rounded border text-xs ${
                      r.rule_id === rule.rule_id
                        ? 'bg-primary/10 border-primary text-primary font-bold'
                        : 'bg-neutral-50 border-neutral-200 text-neutral-600'
                    }`}
                  >
                    <span className="font-mono text-[10px] text-neutral-400">{r.rule_id}</span>
                    <div className="font-semibold">{r.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data readiness summary */}
          <div className="bg-white border border-neutral-300 rounded-lg overflow-hidden shadow-xs">
            <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-300">
              <span className="text-xs font-bold text-neutral-800 uppercase tracking-wide">Data Readiness</span>
            </div>
            <div className="p-3 space-y-2">
              {namespaces.map(ns => {
                const config = nsConfigs[ns];
                const ready = config && Object.keys(config.data).length > 0;
                return (
                  <div key={ns} className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-neutral-700">{ns}</span>
                    {ready ? (
                      <span className="flex items-center gap-1 text-fidelity-green-bright font-bold">
                        <CheckCircle className="w-3.5 h-3.5" /> Ready
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-600 font-bold">
                        <AlertTriangle className="w-3.5 h-3.5" /> Needs data
                      </span>
                    )}
                  </div>
                );
              })}
              <div className="pt-2 border-t border-neutral-200 mt-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-neutral-600">Overall</span>
                  {allNamespacesReady ? (
                    <span className="text-fidelity-green-bright">✓ Ready to evaluate</span>
                  ) : (
                    <span className="text-amber-600">⚠ Incomplete</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Footer */}
      <div className="h-8 bg-neutral-100 border-t border-neutral-300 flex items-center px-6 justify-between shrink-0 font-sans text-[10px] text-neutral-500 rounded-b-lg border-x">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${allNamespacesReady ? 'bg-fidelity-green-bright' : 'bg-amber-500'} shrink-0`}></span>
            <span className="font-bold text-neutral-600 uppercase tracking-wider">
              {allNamespacesReady ? 'All Namespaces Ready' : 'Data Incomplete'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4 font-semibold text-neutral-600">
          <span>Rule: <b className="text-primary">{rule.rule_id}</b></span>
          <span>Namespaces: <b>{namespaces.join(', ')}</b></span>
        </div>
      </div>
    </div>
  );
}
