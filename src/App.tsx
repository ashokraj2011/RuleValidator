import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Plus, 
  HelpCircle, 
  Contact, 
  Bell, 
  Settings, 
  ChevronRight,
  Info,
  Layers,
  Sparkles,
  LayoutDashboard,
  Database,
  Beaker,
  Edit,
  PlayCircle,
  TrendingUp,
  ExternalLink,
  ChevronDown,
  Globe,
  Share2,
  X
} from 'lucide-react';
import { ActiveTab, Rule, TestDataSnapshot } from './types';
import { SAMPLE_RULES } from './sampleRules';
import OverviewTab from './components/OverviewTab';
import TestDataTab from './components/TestDataTab';
import GeneratedTestsTab from './components/GeneratedTestsTab';
import TestRunsTab from './components/TestRunsTab';
import CoverageTab from './components/CoverageTab';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  
  // Shared reactive states
  const [aggregateCoverage, setAggregateCoverage] = useState(82.4);
  const [isOptimized, setIsOptimized] = useState(false);
  const [ruleStatus, setRuleStatus] = useState<string>("Active");
  const [selectedTestCaseId, setSelectedTestCaseId] = useState<string | null>(null);
  
  // Rule state
  const [allRules, setAllRules] = useState<Rule[]>(SAMPLE_RULES);
  const [selectedRuleId, setSelectedRuleId] = useState<string>(SAMPLE_RULES[0].rule_id);
  const selectedRule = allRules.find(r => r.rule_id === selectedRuleId) || allRules[0];

  // Test data snapshot (namespace → data)
  const [testData, setTestData] = useState<TestDataSnapshot>({});

  // Modal / Feedback state
  const [isNewValidationModalOpen, setIsNewValidationModalOpen] = useState(false);
  const [newRuleJson, setNewRuleJson] = useState('');
  const [ruleJsonError, setRuleJsonError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(newRuleJson);
      if (!parsed.rule_id || !parsed.name || !parsed.terms) {
        setRuleJsonError('Rule must have rule_id, name, and terms fields.');
        return;
      }
      setAllRules(prev => [...prev, parsed as Rule]);
      setSelectedRuleId(parsed.rule_id);
      setIsNewValidationModalOpen(false);
      setNewRuleJson('');
      setRuleJsonError(null);
      showToast(`✨ Rule "${parsed.name}" added successfully.`);
    } catch (err: any) {
      setRuleJsonError(`JSON Error: ${err.message}`);
    }
  };

  const handleRunTest = () => {
    setActiveTab('test-runs');
  };

  return (
    <div className="bg-background min-h-screen text-neutral-850 flex flex-col font-sans select-all relative overflow-x-hidden">
      
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-neutral-900 text-white px-5 py-3 rounded-lg shadow-xl border border-secondary flex items-center gap-3 animate-fade-in animate-bounce">
          <Sparkles className="w-5 h-5 text-yellow-400 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <header className="fixed top-0 left-0 w-full z-40 flex justify-between items-center px-6 h-16 bg-white border-b border-neutral-300 pointer-events-auto select-none">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('overview')}>
            <span className="text-lg font-extrabold tracking-tight text-primary">CCRE Rule Validation Studio</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-4 h-full">
            <button type="button" onClick={() => setActiveTab('overview')}
              className={`font-semibold text-xs h-full flex items-center px-2 cursor-pointer transition-colors ${activeTab === 'overview' ? 'text-primary border-b-2 border-primary pb-[1px]' : 'text-neutral-500 hover:text-primary'}`}>
              Dashboard
            </button>
            <button type="button" onClick={() => setActiveTab('test-data')}
              className={`font-semibold text-xs h-full flex items-center px-2 cursor-pointer transition-colors ${activeTab === 'test-data' ? 'text-primary border-b-2 border-primary pb-[1px]' : 'text-neutral-500 hover:text-primary'}`}>
              Test Data
            </button>
            <button type="button" onClick={() => setActiveTab('test-runs')}
              className={`font-semibold text-xs h-full flex items-center px-2 cursor-pointer transition-colors ${activeTab === 'test-runs' ? 'text-primary border-b-2 border-primary pb-[1px]' : 'text-neutral-500 hover:text-primary'}`}>
              Evaluate
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {/* Rule selector */}
          <select
            value={selectedRuleId}
            onChange={(e) => {
              setSelectedRuleId(e.target.value);
              setTestData({});
              showToast(`Switched to rule: ${allRules.find(r => r.rule_id === e.target.value)?.name}`);
            }}
            className="border border-neutral-300 rounded px-3 py-1.5 text-xs font-bold text-secondary bg-white focus:ring-1 focus:ring-primary outline-none cursor-pointer"
          >
            {allRules.map(r => (
              <option key={r.rule_id} value={r.rule_id}>{r.name}</option>
            ))}
          </select>

          <button type="button"
            onClick={() => showToast("Validated all active rules against current test data.")}
            className="hidden sm:inline-block border border-neutral-400 text-neutral-800 px-4 py-1.5 font-bold text-xs rounded hover:bg-neutral-50 transition-colors whitespace-nowrap">
            Validate All
          </button>
          
          <div className="flex items-center gap-1 border-l border-neutral-250 pl-3 ml-1">
            <button type="button" onClick={() => showToast("Zero critical alerts.")} 
              className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-500 hover:text-neutral-900 transition-colors" title="Notifications">
              <Bell className="w-4.5 h-4.5" />
            </button>
            <button type="button" onClick={() => showToast("Settings managed via backend.")} 
              className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-500 hover:text-neutral-900 transition-colors" title="Preferences">
              <Settings className="w-4.5 h-4.5" />
            </button>
            <img alt="User Profile" className="w-8 h-8 rounded-full ml-1.5 border border-neutral-300 shrink-0"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBsYpyMxPJSuLkythkHCI1RN00yDZ0xRHm_S10Ud52TDYQmRODAyfmTUtwhLFrka4YC4gVlvIMbTnRgbcwlcKY5gTV9PUXDfjzh_QWeuSscNaDe0RQuNx195qfF3tfZHW3--dPfPL-Qn71UyB2hhO6g0jFOcHPBA8GvgExXoJ0MQB1GFS2GNFleeIXc2tTGGgOmPV7g9uzkxWbh0zgSpP0OabrRpM_Memk_CUrLghNQPbtC51EOn2PqhzyzCAMVlBrcYn9CgxaeFXY" />
          </div>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 pt-16 min-h-0">
        
        {/* Sidebar */}
        <aside className="fixed left-0 top-16 h-[calc(100vh-64px)] w-64 flex flex-col py-4 bg-[#f4f4f4] border-r border-neutral-300 z-30 select-none">
          <div className="px-4 mb-5">
            <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-neutral-250 shadow-xs mb-3.5">
              <span className="p-1.5 bg-primary rounded text-white shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <div>
                <div className="text-xs font-extrabold text-primary leading-tight">Rule Engine v4.2</div>
                <div className="text-[9px] uppercase tracking-wider text-neutral-400 font-bold">Enterprise Validation</div>
              </div>
            </div>

            <div className="mt-2.5 p-3 bg-white rounded-lg border border-neutral-250">
              <div className="text-xs text-secondary font-bold truncate">{selectedRule.name}</div>
              <div className="text-[10px] text-neutral-400 mt-0.5">{selectedRule.rule_id} • {allRules.length} rules loaded</div>
            </div>
          </div>

          <div className="flex-1 space-y-1.5 px-3 overflow-y-auto">
            <p className="px-3 pb-1 text-[9px] font-bold text-neutral-400 uppercase tracking-widest">Navigation</p>
            
            <button type="button" onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-3 px-3 py-2 cursor-pointer transition-all rounded-lg outline-none text-left ${activeTab === 'overview' ? 'bg-[#79a9fd]/20 text-[#003c7e] font-extrabold shadow-2xs' : 'text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900'}`}>
              <LayoutDashboard className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs font-semibold">Overview</span>
            </button>

            <button type="button" onClick={() => setActiveTab('test-data')}
              className={`w-full flex items-center gap-3 px-3 py-2 cursor-pointer transition-all rounded-lg outline-none text-left ${activeTab === 'test-data' ? 'bg-[#79a9fd]/20 text-[#003c7e] font-extrabold shadow-2xs' : 'text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900'}`}>
              <Database className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs font-semibold font-sans">Test Data</span>
            </button>

            <button type="button" onClick={() => setActiveTab('generated')}
              className={`w-full flex items-center gap-3 px-3 py-2 cursor-pointer transition-all rounded-lg outline-none text-left ${activeTab === 'generated' ? 'bg-[#79a9fd]/20 text-[#003c7e] font-extrabold shadow-2xs' : 'text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900'}`}>
              <Beaker className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs font-semibold font-sans">Generated Tests</span>
            </button>

            <button type="button" onClick={() => setActiveTab('test-runs')}
              className={`w-full flex items-center gap-3 px-3 py-2 cursor-pointer transition-all rounded-lg outline-none text-left ${activeTab === 'test-runs' ? 'bg-[#79a9fd]/20 text-[#003c7e] font-extrabold shadow-2xs' : 'text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900'}`}>
              <PlayCircle className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs font-semibold font-sans">Evaluate / Test Runs</span>
            </button>

            <button type="button" onClick={() => setActiveTab('coverage')}
              className={`w-full flex items-center gap-3 px-3 py-2 cursor-pointer transition-all rounded-lg outline-none text-left ${activeTab === 'coverage' ? 'bg-[#79a9fd]/20 text-[#003c7e] font-extrabold shadow-2xs' : 'text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900'}`}>
              <TrendingUp className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs font-semibold font-sans">Coverage</span>
            </button>

            {/* Rule list */}
            <p className="px-3 pb-1 pt-4 text-[9px] font-bold text-neutral-400 uppercase tracking-widest">Rules</p>
            {allRules.map(r => (
              <button key={r.rule_id} type="button"
                onClick={() => {
                  setSelectedRuleId(r.rule_id);
                  setTestData({});
                  showToast(`Selected: ${r.name}`);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 cursor-pointer transition-all rounded-lg outline-none text-left ${
                  selectedRuleId === r.rule_id
                    ? 'bg-secondary/10 text-secondary font-bold'
                    : 'text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900'
                }`}>
                <Layers className="w-3.5 h-3.5 text-secondary shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold truncate block">{r.name}</span>
                  <span className="text-[9px] text-neutral-400 font-mono">{r.rule_id}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="px-3 mt-auto space-y-3 pt-4 border-t border-neutral-300">
            <button type="button"
              onClick={() => setIsNewValidationModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded font-bold text-xs shadow-xs hover:opacity-90 active:scale-95 transition-all outline-none">
              <Plus className="w-4 h-4 shrink-0" />
              Add Rule
            </button>
            
            <div className="space-y-1 text-neutral-500">
              <a href="#docs" onClick={(e) => { e.preventDefault(); showToast("Opened documentation."); }} 
                className="flex items-center gap-3 px-3 py-1.5 hover:bg-neutral-200 transition-all rounded-lg text-xs">
                <HelpCircle className="w-4 h-4 text-primary" />
                Documentation
              </a>
              <a href="#support" onClick={(e) => { e.preventDefault(); showToast("Connecting to support..."); }} 
                className="flex items-center gap-3 px-3 py-1.5 hover:bg-neutral-200 transition-all rounded-lg text-xs">
                <Contact className="w-4 h-4 text-primary font-bold" />
                Support
              </a>
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 ml-64 p-6 overflow-y-auto block bg-[#fcf9f8]">
          <div className="max-w-(--size-container-max) mx-auto p-1">
            {activeTab === 'overview' && (
              <OverviewTab 
                onSwitchTab={(tab) => {
                  setActiveTab(tab);
                  setSelectedTestCaseId(null);
                }}
                setSelectedTestCaseId={setSelectedTestCaseId}
                aggregateCoverage={aggregateCoverage}
                setAggregateCoverage={setAggregateCoverage}
                isOptimized={isOptimized}
                setIsOptimized={setIsOptimized}
                ruleStatus={ruleStatus}
              />
            )}

            {activeTab === 'test-data' && (
              <TestDataTab 
                rule={selectedRule}
                allRules={allRules}
                testData={testData}
                setTestData={setTestData}
                onSwitchTab={setActiveTab}
                onRunTest={handleRunTest}
              />
            )}

            {activeTab === 'generated' && (
              <GeneratedTestsTab 
                onSwitchTab={setActiveTab}
                aggregateCoverage={aggregateCoverage}
                setAggregateCoverage={setAggregateCoverage}
              />
            )}

            {activeTab === 'test-runs' && (
              <TestRunsTab 
                rule={selectedRule}
                allRules={allRules}
                testData={testData}
                onSwitchTab={setActiveTab}
              />
            )}

            {activeTab === 'coverage' && (
              <CoverageTab 
                aggregateCoverage={aggregateCoverage}
                setAggregateCoverage={setAggregateCoverage}
                isOptimized={isOptimized}
              />
            )}
          </div>
        </main>
      </div>

      {/* Add Rule Modal */}
      {isNewValidationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs select-none">
          <div className="bg-white rounded-lg border border-neutral-350 shadow-2xl w-full max-w-lg p-6 relative animate-fade-in animate-scale-up">
            <button type="button" onClick={() => setIsNewValidationModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors cursor-pointer">
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-3.5 mb-4">
              <span className="p-2 bg-[#79a9fd]/20 rounded text-secondary">
                <ShieldCheck className="w-6 h-6 text-primary" />
              </span>
              <div>
                <h3 className="font-bold text-base text-neutral-900 leading-tight">Add New Rule</h3>
                <p className="text-[11px] text-neutral-500 mt-0.5">Paste a rule JSON following the grammar</p>
              </div>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-600 uppercase mb-1.5">Rule JSON</label>
                <textarea
                  value={newRuleJson}
                  onChange={(e) => { setNewRuleJson(e.target.value); setRuleJsonError(null); }}
                  placeholder={`{\n  "rule_id": "rule_5",\n  "name": "My Rule",\n  "terms": {\n    "operator": "AND",\n    "terms": [...]\n  }\n}`}
                  className="w-full px-3 py-2 border border-neutral-300 rounded text-xs font-mono focus:ring-1 focus:ring-primary focus:border-primary outline-none min-h-[200px] resize-y"
                  required
                />
                {ruleJsonError && (
                  <p className="mt-1 text-xs text-red-600 font-mono">{ruleJsonError}</p>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-2 text-xs">
                <button type="button" onClick={() => setIsNewValidationModalOpen(false)}
                  className="px-4 py-2 border border-neutral-350 rounded text-neutral-600 font-bold hover:bg-neutral-55 cursor-pointer">
                  Cancel
                </button>
                <button type="submit"
                  className="px-4 py-2 bg-primary text-white rounded font-bold hover:opacity-95 cursor-pointer">
                  Add Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
