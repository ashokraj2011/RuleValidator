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
import { ActiveTab, Dataset } from './types';
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
  
  const [dataset, setDataset] = useState<Dataset>({
    customer: {
      id: "USR-8829-X",
      age: 25,
      status: "ACTIVE",
      tags: ["VIP", "LOYALTY_PROGRAM"],
      last_login: "2023-11-24T10:30:00Z"
    }
  });

  // Modal / Feedback state
  const [isNewValidationModalOpen, setIsNewValidationModalOpen] = useState(false);
  const [newValName, setNewValName] = useState("CrossSellCampaignEligibility");
  const [newValBranch, setNewValBranch] = useState("Main");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCreateValidation = (e: React.FormEvent) => {
    e.preventDefault();
    setIsNewValidationModalOpen(false);
    showToast(`✨ Initiated Validation Flow for ${newValName} [Branch: ${newValBranch}] successfully.`);
  };

  return (
    <div className="bg-background min-h-screen text-neutral-850 flex flex-col font-sans select-all relative overflow-x-hidden">
      
      {/* Dynamic Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-neutral-900 text-white px-5 py-3 rounded-lg shadow-xl border border-secondary flex items-center gap-3 animate-fade-in animate-bounce">
          <Sparkles className="w-5 h-5 text-yellow-400 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Top Application Header Navbar */}
      <header className="fixed top-0 left-0 w-full z-40 flex justify-between items-center px-6 h-16 bg-white border-b border-neutral-300 pointer-events-auto select-none">
        
        {/* Brand Group */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('overview')}>
            <span className="text-lg font-extrabold tracking-tight text-primary">CCRE Rule Validation Studio</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-4 h-full">
            <button 
              type="button"
              onClick={() => {
                setActiveTab('overview');
                showToast("Returned to overview dashboard.");
              }}
              className={`font-semibold text-xs h-full flex items-center px-2 cursor-pointer transition-colors ${activeTab === 'overview' ? 'text-primary border-b-2 border-primary pb-[1px]' : 'text-neutral-500 hover:text-primary'}`}
            >
              Dashboard
            </button>
            <button 
              type="button"
              onClick={() => {
                setActiveTab('test-data');
                showToast("Opened workspaces sandbox.");
              }}
              className={`font-semibold text-xs h-full flex items-center px-2 cursor-pointer transition-colors ${activeTab === 'test-data' ? 'text-primary border-b-2 border-primary pb-[1px]' : 'text-neutral-500 hover:text-primary'}`}
            >
              Workspaces
            </button>
            <button 
              type="button"
              onClick={() => {
                setActiveTab('test-runs');
                showToast("Loaded historical rule logs.");
              }}
              className={`font-semibold text-xs h-full flex items-center px-2 cursor-pointer transition-colors ${activeTab === 'test-runs' ? 'text-primary border-b-2 border-primary pb-[1px]' : 'text-neutral-500 hover:text-primary'}`}
            >
              History
            </button>
          </nav>
        </div>

        {/* User profile action buttons */}
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => showToast("Validation suite deployed to stage. Zero issues detected.")}
            className="hidden sm:inline-block px-4 py-1.5 bg-primary text-white font-bold text-xs rounded hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            Deploy Rule
          </button>
          <button 
            type="button"
            onClick={() => showToast("Validated all active sandbox cases against version AST. Coverage is green.")}
            className="hidden sm:inline-block border border-neutral-400 text-neutral-800 px-4 py-1.5 font-bold text-xs rounded hover:bg-neutral-50 transition-colors whitespace-nowrap"
          >
            Validate All
          </button>
          
          <div className="flex items-center gap-1 border-l border-neutral-250 pl-3 ml-1 col-span-1 shrink-0">
            <button 
              type="button" 
              onClick={() => showToast("Zero critical alerts. System is normal.")} 
              className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-500 hover:text-neutral-900 transition-colors"
              title="Notifications"
            >
              <Bell className="w-4.5 h-4.5" />
            </button>
            <button 
              type="button" 
              onClick={() => showToast("Settings config is managed via backend workspace accounts.")} 
              className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-500 hover:text-neutral-900 transition-colors"
              title="Preferences"
            >
              <Settings className="w-4.5 h-4.5" />
            </button>
            <img 
              alt="User Profile" 
              className="w-8 h-8 rounded-full ml-1.5 border border-neutral-300 shrink-0"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBsYpyMxPJSuLkythkHCI1RN00yDZ0xRHm_S10Ud52TDYQmRODAyfmTUtwhLFrka4YC4gVlvIMbTnRgbcwlcKY5gTV9PUXDfjzh_QWeuSscNaDe0RQuNx195qfF3tfZHW3--dPfPL-Qn71UyB2hhO6g0jFOcHPBA8GvgExXoJ0MQB1GFS2GNFleeIXc2tTGGgOmPV7g9uzkxWbh0zgSpP0OabrRpM_Memk_CUrLghNQPbtC51EOn2PqhzyzCAMVlBrcYn9CgxaeFXY"
            />
          </div>
        </div>

      </header>

      {/* Main layout frame */}
      <div className="flex flex-1 pt-16 min-h-0">
        
        {/* Left Side Navigation Panel */}
        <aside className="fixed left-0 top-16 h-[calc(100vh-64px)] w-64 flex flex-col py-4 bg-[#f4f4f4] border-r border-neutral-300 z-30 select-none">
          
          {/* Brand/Branding Section widget */}
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
              <div className="text-xs text-secondary font-bold truncate">CrossSellCampaignEligibility</div>
              <div className="text-[10px] text-neutral-400 mt-0.5">Version 12 • Branch: Main</div>
            </div>
          </div>

          {/* Navigation Items menu list */}
          <div className="flex-1 space-y-1.5 px-3 overflow-y-auto">
            <p className="px-3 pb-1 text-[9px] font-bold text-neutral-400 uppercase tracking-widest">Navigation</p>
            
            <button 
              type="button"
              onClick={() => {
                setActiveTab('overview');
                showToast("Loading Validation Dashboard overview...");
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 cursor-pointer transition-all rounded-lg outline-none text-left ${activeTab === 'overview' ? 'bg-[#79a9fd]/20 text-[#003c7e] font-extrabold shadow-2xs' : 'text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900'}`}
            >
              <LayoutDashboard className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs font-semibold">Overview</span>
            </button>

            <button 
              type="button"
              onClick={() => {
                setActiveTab('test-data');
                showToast("Loading customer JSON variables editor...");
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 cursor-pointer transition-all rounded-lg outline-none text-left ${activeTab === 'test-data' ? 'bg-[#79a9fd]/20 text-[#003c7e] font-extrabold shadow-2xs' : 'text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900'}`}
            >
              <Database className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs font-semibold font-sans">Test Data</span>
            </button>

            <button 
              type="button"
              onClick={() => {
                setActiveTab('generated');
                showToast("Loading boundary snapshots generator studio...");
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 cursor-pointer transition-all rounded-lg outline-none text-left ${activeTab === 'generated' ? 'bg-[#79a9fd]/20 text-[#003c7e] font-extrabold shadow-2xs' : 'text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900'}`}
            >
              <Beaker className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs font-semibold font-sans">Generated Tests</span>
            </button>

            <button 
              type="button"
              onClick={() => showToast("Custom custom_rules editor are checked directly inside 'Test Runs' tab.")}
              className="w-full flex items-center gap-3 px-3 py-2 cursor-pointer text-left text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900 transition-all rounded-lg outline-none"
            >
              <Edit className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs font-semibold font-sans">Custom Tests</span>
            </button>

            <button 
              type="button"
              onClick={() => {
                setActiveTab('test-runs');
                showToast("Loading live execution debugger...");
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 cursor-pointer transition-all rounded-lg outline-none text-left ${activeTab === 'test-runs' ? 'bg-[#79a9fd]/20 text-[#003c7e] font-extrabold shadow-2xs' : 'text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900'}`}
            >
              <PlayCircle className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs font-semibold font-sans">Test Runs</span>
            </button>

            <button 
              type="button"
              onClick={() => {
                setActiveTab('coverage');
                showToast("Loading multi-node logic heatmap analysis...");
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 cursor-pointer transition-all rounded-lg outline-none text-left ${activeTab === 'coverage' ? 'bg-[#79a9fd]/20 text-[#003c7e] font-extrabold shadow-2xs' : 'text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900'}`}
            >
              <TrendingUp className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs font-semibold font-sans">Coverage</span>
            </button>

          </div>

          {/* Bottom Sidebar layout group */}
          <div className="px-3 mt-auto space-y-3 pt-4 border-t border-neutral-300">
            <button 
              type="button"
              onClick={() => setIsNewValidationModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded font-bold text-xs shadow-xs hover:opacity-90 active:scale-95 transition-all outline-none"
            >
              <Plus className="w-4 h-4 shrink-0" />
              New Validation
            </button>
            
            <div className="space-y-1 text-neutral-500">
              <a 
                href="#docs" 
                onClick={(e) => {
                  e.preventDefault();
                  showToast("Opened interactive CCRE Studio documentation.");
                }} 
                className="flex items-center gap-3 px-3 py-1.5 hover:bg-neutral-200 transition-all rounded-lg text-xs"
              >
                <HelpCircle className="w-4 h-4 text-primary" />
                Documentation
              </a>
              <a 
                href="#support" 
                onClick={(e) => {
                  e.preventDefault();
                  showToast("Connecting to Google Enterprise Validation help desk...");
                }} 
                className="flex items-center gap-3 px-3 py-1.5 hover:bg-neutral-200 transition-all rounded-lg text-xs"
              >
                <Contact className="w-4 h-4 text-primary font-bold" />
                Support
              </a>
            </div>
          </div>

        </aside>

        {/* Content Container (Offset by Sidebar) */}
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
                dataset={dataset}
                setDataset={setDataset}
                onSwitchTab={setActiveTab}
                setRuleStatus={setRuleStatus}
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
                selectedTestCaseId={selectedTestCaseId}
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

      {/* New Validation Flow Setup Modal */}
      {isNewValidationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs select-none">
          <div className="bg-white rounded-lg border border-neutral-350 shadow-2xl w-full max-w-md p-6 relative animate-fade-in animate-scale-up">
            <button 
              type="button" 
              onClick={() => setIsNewValidationModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-3.5 mb-4">
              <span className="p-2 bg-[#79a9fd]/20 rounded text-secondary">
                <ShieldCheck className="w-6 h-6 text-primary" />
              </span>
              <div>
                <h3 className="font-bold text-base text-neutral-900 leading-tight">Create New Validation</h3>
                <p className="text-[11px] text-neutral-500 mt-0.5">Define metadata targets to seed a secondary checking mirror</p>
              </div>
            </div>

            <form onSubmit={handleCreateValidation} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-600 uppercase mb-1.5">Rule / Namespace Name</label>
                <input 
                  type="text" 
                  value={newValName}
                  onChange={(e) => setNewValName(e.target.value)}
                  placeholder="e.g. Eligible_Campaign_Scoring"
                  className="w-full px-3 py-2 border border-neutral-300 rounded text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-600 uppercase mb-1.5">Branch Target</label>
                <input 
                  type="text" 
                  value={newValBranch}
                  onChange={(e) => setNewValBranch(e.target.value)}
                  placeholder="e.g. Master"
                  className="w-full px-3 py-2 border border-neutral-300 rounded text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 text-xs">
                <button 
                  type="button" 
                  onClick={() => setIsNewValidationModalOpen(false)}
                  className="px-4 py-2 border border-neutral-350 rounded text-neutral-600 font-bold hover:bg-neutral-55 font-sans cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded font-bold hover:opacity-95 font-sans cursor-pointer"
                >
                  Create flow
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
