import React, { useState } from 'react';
import { 
  Sparkles, 
  Settings, 
  Play, 
  CheckCircle, 
  Clipboard, 
  ClipboardCheck, 
  Filter, 
  Bug, 
  FileText
} from 'lucide-react';
import { PendingCase } from '../types';

interface GeneratedTestsTabProps {
  onSwitchTab: (tab: 'overview' | 'test-data' | 'generated' | 'test-runs' | 'coverage') => void;
  aggregateCoverage: number;
  setAggregateCoverage: (cov: number) => void;
}

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
  }
];

// Snapshot JSON payloads keyed by case ID
const PREVIEW_DATA_MAP: Record<string, { expected: 'TRUE' | 'FALSE'; code: string; explanation: string }> = {
  'Eligibility_MinAge_Check': {
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
}`
  },
  'Legacy_User_Mapping': {
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
}`
  },
  'Max_Credit_Limit_Test': {
    expected: 'TRUE',
    explanation: 'Normal balance limit resolves positive under classical retail profile scoring criteria, skipping fallback tier evaluations entirely.',
    code: `{
  "test_id": "MAX_CREDIT_OK",
  "input": {
    "user": {
      "age": 35,
      "balance": 50000.00,
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
}`
  },
  'Account_Status_Active': {
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
}`
  },
  'Nested_Product_Array': {
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
}`
  },
  'Currency_Code_Iso': {
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
}`
  }
};

export default function GeneratedTestsTab({
  onSwitchTab,
  aggregateCoverage,
  setAggregateCoverage
}: GeneratedTestsTabProps) {
  // Strategy selections
  const [strategies, setStrategies] = useState({
    happyPath: true,
    boundary: true,
    nulls: true,
    arrays: false,
    coercion: false
  });

  const [selectedCaseId, setSelectedCaseId] = useState<string>('Eligibility_MinAge_Check');
  const [isCopied, setIsCopied] = useState(false);
  const [runCaseId, setRunCaseId] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const toggleStrategy = (key: keyof typeof strategies) => {
    setStrategies(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Filter pending cases dynamically based on checked strategies
  const filteredCases = INITIAL_PENDING_CASES.filter(c => {
    if (c.focus.toLowerCase().includes('happy path') && !strategies.happyPath) return false;
    if (c.focus.toLowerCase().includes('boundary') && !strategies.boundary) return false;
    if (c.focus.toLowerCase().includes('null') && !strategies.nulls) return false;
    if (c.focus.toLowerCase().includes('array') && !strategies.arrays) return false;
    if (c.focus.toLowerCase().includes('missing') && !strategies.coercion) return false; // Map missing to coercion
    return true;
  });

  const activePreview = PREVIEW_DATA_MAP[selectedCaseId] || PREVIEW_DATA_MAP['Eligibility_MinAge_Check'];

  const handleCopy = () => {
    navigator.clipboard.writeText(activePreview.code);
    setIsCopied(true);
    showToast("📋 Snapshot JSON copied to clipboard!");
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleRunTestCase = (id: string) => {
    setRunCaseId(id);
    showToast(`Initializing generator on ${id}...`);
    setTimeout(() => {
      setRunCaseId(null);
      showToast(`✨ Generated and saved test payload case for ${id}!`);
      // Boost aggregate coverage in background
      setAggregateCoverage(Math.min(aggregateCoverage + 0.8, 100));
    }, 1200);
  };

  const handleRegenerateAll = () => {
    setIsRegenerating(true);
    showToast("⚙️ Re-evaluating engine AST and remapping test seeds...");
    setTimeout(() => {
      setIsRegenerating(false);
      setAggregateCoverage(Math.min(aggregateCoverage + 1.2, 100));
      showToast("✨ Successfully refreshed and regenerated all queued boundary snapshots.");
    }, 2000);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-neutral-100">
      {/* Toast feedback alerts */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-neutral-900 text-white px-5 py-3 rounded shadow-xl border border-secondary flex items-center gap-3 animate-fade-in">
          <Sparkles className="w-5 h-5 text-yellow-550 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Sub Header breadcrumbs */}
      <div className="px-6 py-3.5 bg-white border-b border-neutral-300 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
        <div className="flex items-center gap-2 text-xs text-neutral-500 font-sans">
          <span>Projects / Validation Studio / </span>
          <span className="font-bold text-neutral-800">Test Case Generation Studio - CrossSellCampaignEligibility v12</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            type="button"
            onClick={() => showToast("Archiving historical schema test suites...")}
            className="px-3 py-1.5 border border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-50 transition-colors rounded text-xs font-semibold"
          >
            Archive Old Tests
          </button>
          <button 
            type="button"
            onClick={() => showToast("Scanning matrix for 3 missing failure paths...")}
            className="px-3 py-1.5 border border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-50 transition-colors rounded text-xs font-semibold"
          >
            Regenerate Only Missing
          </button>
          <button 
            type="button"
            onClick={handleRegenerateAll}
            disabled={isRegenerating}
            className={`px-3 py-1.5 bg-primary-container bg-primary text-white text-xs font-semibold hover:opacity-95 transition-all rounded ${isRegenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isRegenerating ? 'Regenerating...' : 'Regenerate All'}
          </button>
        </div>
      </div>

      <div className="p-5 flex-1 min-h-0 flex flex-col lg:flex-row gap-5 overflow-hidden">
        {/* Left column generation strategy (1/4 space) */}
        <div className="w-full lg:w-72 flex flex-col gap-4 shrink-0 overflow-y-auto">
          {/* Generation Strategy Panel */}
          <div className="bg-white border border-neutral-300 p-4 rounded-lg flex flex-col gap-3 shadow-xs">
            <div className="flex justify-between items-center pb-2 border-b border-neutral-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800">Generation Strategy</h3>
              <Settings className="w-4 h-4 text-neutral-500" />
            </div>
            <div className="space-y-1 select-none">
              <label className="flex items-center justify-between p-2 rounded hover:bg-neutral-50 cursor-pointer border border-transparent transition-all">
                <span className="text-xs font-medium text-neutral-700">Happy Path</span>
                <input 
                  type="checkbox" 
                  checked={strategies.happyPath}
                  onChange={() => toggleStrategy('happyPath')}
                  className="rounded border-neutral-300 text-primary focus:ring-0 cursor-pointer h-4 w-4"
                />
              </label>
              <label className="flex items-center justify-between p-2 rounded hover:bg-neutral-50 cursor-pointer border border-transparent transition-all">
                <span className="text-xs font-medium text-neutral-700">Boundary Analysis</span>
                <input 
                  type="checkbox" 
                  checked={strategies.boundary}
                  onChange={() => toggleStrategy('boundary')}
                  className="rounded border-neutral-300 text-primary focus:ring-0 cursor-pointer h-4 w-4"
                />
              </label>
              <label className="flex items-center justify-between p-2 rounded hover:bg-neutral-50 cursor-pointer border border-transparent transition-all">
                <span className="text-xs font-medium text-neutral-700">Null/Missing Values</span>
                <input 
                  type="checkbox" 
                  checked={strategies.nulls}
                  onChange={() => toggleStrategy('nulls')}
                  className="rounded border-neutral-300 text-primary focus:ring-0 cursor-pointer h-4 w-4"
                />
              </label>
              <label className="flex items-center justify-between p-2 rounded hover:bg-neutral-50 cursor-pointer border border-transparent transition-all">
                <span className="text-xs font-medium text-neutral-700">Array Scenarios</span>
                <input 
                  type="checkbox" 
                  checked={strategies.arrays}
                  onChange={() => toggleStrategy('arrays')}
                  className="rounded border-neutral-300 text-primary focus:ring-0 cursor-pointer h-4 w-4"
                />
              </label>
              <label className="flex items-center justify-between p-2 rounded hover:bg-neutral-50 cursor-pointer border border-transparent transition-all">
                <span className="text-xs font-medium text-neutral-700">Type Coercion</span>
                <input 
                  type="checkbox" 
                  checked={strategies.coercion}
                  onChange={() => toggleStrategy('coercion')}
                  className="rounded border-neutral-300 text-primary focus:ring-0 cursor-pointer h-4 w-4"
                />
              </label>
            </div>
          </div>

          {/* Current Config configuration */}
          <div className="bg-white border border-neutral-300 p-4 rounded-lg shadow-xs flex flex-col gap-2">
            <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">Current Configuration</h3>
            <div className="p-3 bg-neutral-50 rounded border border-neutral-200 text-xs font-sans space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-neutral-500">Engine Version:</span>
                <span className="font-mono text-primary font-bold">2.4.1-stable</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-500">Complexity:</span>
                <span className="font-mono text-neutral-700">O(log n)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-500">Snapshot Tag:</span>
                <span className="font-mono text-primary font-bold">s45</span>
              </div>
            </div>
          </div>

          {/* Coverage Heatmap Area */}
          <div className="bg-white border border-neutral-300 p-4 rounded-lg shadow-xs flex-1 flex flex-col justify-between">
            <div>
              <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-3">Coverage Heatmap</h3>
              <div className="grid grid-cols-4 gap-2">
                <div className="aspect-square bg-primary opacity-90 rounded"></div>
                <div className="aspect-square bg-fidelity-green-bright rounded"></div>
                <div className="aspect-square bg-primary opacity-60 rounded"></div>
                <div className="aspect-square bg-rose-500 opacity-80 rounded"></div>
                <div className="aspect-square bg-primary opacity-80 rounded"></div>
                <div className="aspect-square bg-neutral-200 rounded"></div>
                <div className="aspect-square bg-primary opacity-45 rounded"></div>
                <div className="aspect-square bg-fidelity-green-bright opacity-70 rounded"></div>
              </div>
            </div>
            <div className="text-[10px] text-neutral-400 select-none mt-4 text-center">
              Evaluated on v12-logical state rules
            </div>
          </div>
        </div>

        {/* Center column Queue List (2/4 space) */}
        <div className="flex-1 min-h-0 bg-white border border-neutral-300 rounded-lg flex flex-col shadow-xs">
          <div className="p-4 border-b border-neutral-300 flex justify-between items-center bg-white shrink-0">
            <h3 className="font-bold text-sm text-neutral-800">Pending Generations</h3>
            <div className="flex items-center gap-3.5">
              <span className="text-xs text-neutral-500">{filteredCases.length} cases loaded</span>
              <div className="h-4 w-px bg-neutral-300"></div>
              <Filter className="w-4 h-4 text-neutral-400 hover:text-primary cursor-pointer transition-colors" />
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-neutral-50 border-b border-neutral-300 text-[10px] uppercase font-bold text-neutral-500 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3">Case Identifier</th>
                  <th className="px-6 py-3">Strategy Focus</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="text-xs text-neutral-700">
                {filteredCases.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-10 text-neutral-400">
                      Select custom generation strategies in the checklist.
                    </td>
                  </tr>
                ) : (
                  filteredCases.map((pc) => (
                    <tr 
                      key={pc.id} 
                      onClick={() => setSelectedCaseId(pc.name)}
                      className={`hover:bg-neutral-50/50 border-b border-neutral-200 transition-colors cursor-pointer ${selectedCaseId === pc.name ? 'bg-neutral-50 border-l-4 border-primary' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <div className="font-bold text-neutral-800">{pc.name}</div>
                        <div className="text-[10px] text-neutral-400">{pc.description}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${pc.bgClass || 'bg-neutral-100 text-neutral-800'}`}>
                          {pc.focus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button 
                          type="button"
                          onClick={() => handleRunTestCase(pc.id)}
                          className="p-1.5 rounded-full hover:bg-neutral-200/70 transition-colors outline-none text-neutral-500 hover:text-primary"
                          title="Generate payload"
                        >
                          <Play className={`w-4 h-4 fill-current ${runCaseId === pc.id ? 'animate-spin text-primary' : ''}`} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column Snapshot Preview (1/4 space) */}
        <div className="w-full lg:w-80 shrink-0 bg-white border border-neutral-300 rounded-lg flex flex-col shadow-xs overflow-hidden">
          <div className="p-4 border-b border-neutral-300 flex justify-between items-center bg-neutral-50 shrink-0">
            <h3 className="font-bold text-xs text-neutral-800 uppercase tracking-tight">Snapshot Preview</h3>
            <span className="px-2 py-0.5 bg-primary text-white text-[9px] font-bold rounded uppercase">TAG: s45</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col bg-[#111] text-[#ccc] font-mono text-xs select-text">
            {/* Expected results badge */}
            <div className={`p-3 rounded-md mb-3 flex items-center gap-2.5 border font-semibold select-none ${activePreview.expected === 'TRUE' ? 'bg-green-950/40 text-emerald-400 border-green-900/30' : 'bg-red-950/40 text-red-400 border-red-900/30'}`}>
              <CheckCircle className={`w-4.5 h-4.5 shrink-0 ${activePreview.expected === 'TRUE' ? 'text-emerald-500' : 'text-red-500'}`} />
              <span className="text-[10px] tracking-wide uppercase font-bold">Expected Result: {activePreview.expected}</span>
            </div>
            
            {/* Code Block Container */}
            <pre className="text-[11px] leading-relaxed whitespace-pre font-mono flex-1 overflow-auto">
              {activePreview.code}
            </pre>
          </div>

          {/* Explanation Footer details */}
          <div className="p-4 bg-neutral-50 border-t border-neutral-300 text-xs shrink-0 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Logic Explanation</span>
              <p className="text-neutral-700 leading-relaxed text-xs">
                {activePreview.explanation}
              </p>
            </div>
            <button 
              type="button"
              onClick={handleCopy}
              className="w-full py-2 bg-white text-primary font-bold text-xs border border-primary rounded-md hover:bg-green-50 transition-colors flex items-center justify-center gap-2 outline-none cursor-pointer"
            >
              {isCopied ? (
                <>
                  <ClipboardCheck className="w-4 h-4 text-primary" />
                  Copied!
                </>
              ) : (
                <>
                  <Clipboard className="w-4 h-4 text-primary" />
                  Copy JSON to Clipboard
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
