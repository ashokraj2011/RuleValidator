import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Archive, 
  TrendingUp, 
  AlertTriangle, 
  Search, 
  Filter, 
  FileText, 
  Bug, 
  History, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Play, 
  Diff, 
  ArrowRight,
  CheckCircle,
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import { TestCaseRun } from '../types';

interface OverviewTabProps {
  onSwitchTab: (tab: 'overview' | 'test-data' | 'generated' | 'test-runs' | 'coverage') => void;
  setSelectedTestCaseId: (id: string | null) => void;
  aggregateCoverage: number;
  setAggregateCoverage: (cov: number) => void;
  isOptimized: boolean;
  setIsOptimized: (opt: boolean) => void;
  ruleStatus: string;
}

// Preloaded mock data based directly on image screenshots
const SYSTEM_TEST_CASES: TestCaseRun[] = [
  {
    id: 'Elig_Gold_Tier_Premium',
    name: 'Elig_Gold_Tier_Premium',
    description: 'Edge Case: High Balance',
    version: 'v12.0.4',
    status: 'passed',
    timestamp: '2 mins ago'
  },
  {
    id: 'Neg_Underage_Exclusion',
    name: 'Neg_Underage_Exclusion',
    description: 'Regression: Age Validation',
    version: 'v12.0.4',
    status: 'failed',
    timestamp: '15 mins ago'
  },
  {
    id: 'Elig_Standard_Customer',
    name: 'Elig_Standard_Customer',
    description: 'Baseline Validation',
    version: 'v12.0.4',
    status: 'passed',
    timestamp: '42 mins ago'
  },
  {
    id: 'Elig_Credit_Limit_Cross',
    name: 'Elig_Credit_Limit_Cross',
    description: 'Complex Boolean Tree',
    version: 'v12.0.3',
    status: 'pending',
    timestamp: '1 hour ago'
  }
];

const USER_TEST_CASES: TestCaseRun[] = [
  {
    id: 'User_Retail_HighAge',
    name: 'User_Retail_HighAge',
    description: 'Manual input exceeding 85 years age',
    version: 'v12.0.4',
    status: 'passed',
    timestamp: '3 hours ago'
  },
  {
    id: 'User_Empty_Tags_Check',
    name: 'User_Empty_Tags_Check',
    description: 'Null and empty tags edge validation',
    version: 'v12.0.4',
    status: 'passed',
    timestamp: '5 hours ago'
  },
  {
    id: 'User_Extreme_Balance_Ex',
    name: 'User_Extreme_Balance_Ex',
    description: 'Balance > 1,000,000 extreme bounds',
    version: 'v12.0.3',
    status: 'failed',
    timestamp: '1 day ago'
  }
];

export default function OverviewTab({
  onSwitchTab,
  setSelectedTestCaseId,
  aggregateCoverage,
  setAggregateCoverage,
  isOptimized,
  setIsOptimized,
  ruleStatus
}: OverviewTabProps) {
  const [activeTabSub, setActiveTabSub] = useState<'system' | 'user'>('system');
  const [searchQuery, setSearchQuery] = useState('');
  const [testCasesState, setTestCasesState] = useState<TestCaseRun[]>(SYSTEM_TEST_CASES);
  const [userCasesState, setUserCasesState] = useState<TestCaseRun[]>(USER_TEST_CASES);
  const [isRunningValidation, setIsRunningValidation] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const casesPerPage = 4;

  const currentCases = activeTabSub === 'system' ? testCasesState : userCasesState;
  
  // Filter search
  const filteredCases = currentCases.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredCases.length / casesPerPage) || 1;
  const indexOfLastCase = currentPage * casesPerPage;
  const indexOfFirstCase = indexOfLastCase - casesPerPage;
  const paginatedCases = filteredCases.slice(indexOfFirstCase, indexOfLastCase);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleRunValidation = () => {
    setIsRunningValidation(true);
    showToast("Starting live evaluation on active rule set...");
    
    setTimeout(() => {
      // Complete pending case dynamically and flip states
      if (activeTabSub === 'system') {
        const updated = testCasesState.map(c => {
          if (c.status === 'pending') {
            return { ...c, status: 'passed' as const, timestamp: 'Just now' };
          }
          return c;
        });
        setTestCasesState(updated);
        showToast("Validation complete! 1 pending run cleared. Status: Active.");
      } else {
        showToast("Validation complete on manually defined cases!");
      }
      setIsRunningValidation(false);
    }, 1800);
  };

  const handleApplyOptimization = () => {
    if (isOptimized) {
      showToast("Optimization has already been flattened into CrossSellCampaignEligibility (v12-opt)!");
      return;
    }
    setIsOptimized(true);
    setAggregateCoverage(92.4);
    showToast("✨ AI Audit applied! Removed 3 redundant logical paths. Performance +14%! Coverage boosted to 92.4%.");
  };

  const handleViewExplanation = (caseId: string) => {
    setSelectedTestCaseId(caseId);
    onSwitchTab('test-runs');
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert Feedback */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-neutral-900 text-white px-5 py-3 rounded-lg shadow-xl border border-secondary flex items-center gap-3 animate-fade-in animate-bounce">
          <Sparkles className="w-5 h-5 text-yellow-400 shrink-0" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Validation Dashboard</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Monitoring eligibility logic for <span className="font-semibold text-primary">CrossSellCampaignEligibility v12</span>
            {isOptimized && <span className="ml-[6px] text-xs font-bold text-fidelity-green-bright bg-green-50 px-2 py-0.5 border border-green-200 rounded uppercase">Optimized</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button 
            type="button"
            onClick={() => showToast("Diff Tool loaded: Version 12 vs Production Base. Zero logic drift detected.")}
            className="flex items-center gap-2 px-4 py-2 border border-neutral-300 rounded bg-white hover:bg-neutral-50 transition-colors font-semibold text-xs text-neutral-700"
          >
            <Diff className="w-4 h-4 text-neutral-500" /> Compare Versions
          </button>
          <button 
            type="button"
            onClick={() => {
              onSwitchTab('generated');
              showToast("Switched to generation studio.");
            }}
            className="flex items-center gap-2 px-4 py-2 border border-neutral-300 rounded bg-white hover:bg-neutral-50 transition-colors font-semibold text-xs text-neutral-700"
          >
            <Sparkles className="w-4 h-4 text-primary" /> Generate System Tests
          </button>
          <button 
            type="button"
            onClick={handleRunValidation}
            disabled={isRunningValidation}
            className={`flex items-center gap-2 px-4 py-2 bg-primary text-white rounded font-semibold text-xs shadow-sm shadow-green-900/10 hover:opacity-90 active:scale-95 transition-all ${isRunningValidation ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Play className={`w-4 h-4 fill-current ${isRunningValidation ? 'animate-spin' : ''}`} /> 
            {isRunningValidation ? 'Executing...' : 'Run Validation'}
          </button>
        </div>
      </div>

      {/* Dashboard Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-neutral-300 p-5 rounded-lg flex flex-col justify-between h-28 shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-neutral-500 text-xs font-semibold uppercase tracking-wider">Rule Status</span>
            <span className="p-1 bg-green-50 text-fidelity-green-bright rounded-full">
              <CheckCircle className="w-4 h-4 fill-current text-white" />
            </span>
          </div>
          <div className="mt-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-fidelity-green-bright animate-ping absolute"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-fidelity-green-bright relative"></span>
              <span className="text-xl font-bold text-neutral-900">{ruleStatus}</span>
            </div>
            <p className="text-[10px] text-neutral-500 mt-0.5">Live index • Production branch</p>
          </div>
        </div>

        <div className="bg-white border border-neutral-300 p-5 rounded-lg flex flex-col justify-between h-28 shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-neutral-500 text-xs font-semibold uppercase tracking-wider">Total Test Cases</span>
            <Archive className="w-4 h-4 text-primary/60" />
          </div>
          <div className="mt-1">
            <div className="text-xl font-bold text-neutral-900">
              {activeTabSub === 'system' ? testCasesState.length + 138 : userCasesState.length + 20}
            </div>
            <p className="text-[10px] text-neutral-500 mt-0.5">+12 added since version checkout</p>
          </div>
        </div>

        <div className="bg-white border border-neutral-300 p-5 rounded-lg flex flex-col justify-between h-28 shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-neutral-500 text-xs font-semibold uppercase tracking-wider">Logic Coverage</span>
            <TrendingUp className="w-4 h-4 text-primary/60" />
          </div>
          <div className="mt-1">
            <div className="text-xl font-bold text-neutral-900">{isOptimized ? '92.4%' : '88.0%'}</div>
            <div className="w-full bg-neutral-200 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-primary h-full transition-all duration-1000" 
                style={{ width: isOptimized ? '92.4%' : '88.0%' }}
              ></div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-neutral-300 p-5 rounded-lg flex flex-col justify-between h-28 shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-neutral-500 text-xs font-semibold uppercase tracking-wider">Recent Failures</span>
            <AlertCircle className="w-4 h-4 text-red-500/80" />
          </div>
          <div className="mt-1">
            <div className="text-xl font-bold text-red-600">3</div>
            <p className="text-[10px] text-neutral-500 mt-0.5">Critical regressions isolated in sandbox</p>
          </div>
        </div>
      </div>

      {/* Tabs Switcher for Systems vs User Test Cases */}
      <div className="border-b border-neutral-300">
        <div className="flex gap-6">
          <button 
            type="button"
            className={`pb-2.5 font-bold text-sm border-b-2 cursor-pointer transition-all ${activeTabSub === 'system' ? 'border-primary text-primary' : 'border-transparent text-neutral-500 hover:text-primary'}`}
            onClick={() => {
              setActiveTabSub('system');
              setCurrentPage(1);
            }}
          >
            System Test Cases
          </button>
          <button 
            type="button"
            className={`pb-2.5 font-bold text-sm border-b-2 cursor-pointer transition-all ${activeTabSub === 'user' ? 'border-primary text-primary' : 'border-transparent text-neutral-500 hover:text-primary'}`}
            onClick={() => {
              setActiveTabSub('user');
              setCurrentPage(1);
            }}
          >
            User Test Cases
          </button>
        </div>
      </div>

      {/* Recent Test Runs Table Card */}
      <div className="bg-white border border-neutral-300 rounded-lg overflow-hidden shadow-sm">
        <div className="p-4 border-b border-neutral-300 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-neutral-50">
          <h3 className="font-bold text-sm text-neutral-800">Recent Test Runs</h3>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 w-3.5 h-3.5" />
              <input 
                type="text"
                placeholder="Search cases..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-8 pr-3 py-1.5 w-full bg-white border border-neutral-300 rounded text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none text-neutral-700"
              />
            </div>
            <button 
              type="button"
              onClick={() => showToast("Filters adjusted strictly to active version code.")}
              className="p-1.5 border border-neutral-300 rounded bg-white hover:bg-neutral-100 transition-colors"
              title="Filter list"
            >
              <Filter className="w-3.5 h-3.5 text-neutral-600" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50/50 border-b border-neutral-300">
                <th className="px-6 py-3 font-semibold text-xs text-neutral-500 uppercase tracking-wider">Case Name</th>
                <th className="px-6 py-3 font-semibold text-xs text-neutral-500 uppercase tracking-wider">Version</th>
                <th className="px-6 py-3 font-semibold text-xs text-neutral-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 font-semibold text-xs text-neutral-500 uppercase tracking-wider">Timestamp</th>
                <th className="px-6 py-3 font-semibold text-xs text-neutral-500 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-250">
              {paginatedCases.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-neutral-500 text-sm">
                    No matching test cases found.
                  </td>
                </tr>
              ) : (
                paginatedCases.map((tc) => (
                  <tr key={tc.id} className="hover:bg-neutral-50/50 transition-colors group">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        {tc.status === 'failed' ? (
                          <Bug className="w-4 h-4 text-red-500 shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-primary shrink-0" />
                        )}
                        <div>
                          <div className="font-semibold text-sm text-neutral-800">{tc.name}</div>
                          <div className="text-[11px] text-neutral-400">{tc.description}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-xs font-mono text-neutral-500">{tc.version}</td>
                    <td className="px-6 py-3.5">
                      {tc.status === 'passed' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-tight border border-emerald-100">
                          <CheckCircle className="w-3 h-3 text-emerald-600 fill-current text-white shrink-0" /> Passed
                        </span>
                      )}
                      {tc.status === 'failed' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 text-[10px] font-bold uppercase tracking-tight border border-red-100">
                          <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" /> Failed
                        </span>
                      )}
                      {tc.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-tight border border-blue-100">
                          <Clock className="w-3 h-3 text-blue-600 shrink-0 animate-spin" /> Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-xs text-neutral-500">{tc.timestamp}</td>
                    <td className="px-6 py-3.5 text-right">
                      {tc.status === 'pending' ? (
                        <span className="text-xs font-medium text-neutral-400 pr-1 italic animate-pulse">Processing...</span>
                      ) : (
                        <button 
                          type="button"
                          onClick={() => handleViewExplanation(tc.id)}
                          className="text-secondary hover:text-blue-800 text-xs font-bold hover:underline decoration-2 underline-offset-4"
                        >
                          View Explanation
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Pagination */}
        <div className="p-4 bg-neutral-50 border-t border-neutral-300 flex justify-between items-center text-xs">
          <span className="text-neutral-500">
            Showing {indexOfFirstCase + 1} to {Math.min(indexOfLastCase, filteredCases.length)} of {filteredCases.length} recent runs
          </span>
          <div className="flex gap-1">
            <button 
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              className={`px-2 py-1 rounded border border-neutral-300 bg-white hover:bg-neutral-100 ${currentPage === 1 ? 'opacity-45 cursor-not-allowed' : ''}`}
            >
              <ChevronLeft className="w-3.5 h-3.5 text-neutral-600" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button 
                key={i + 1}
                type="button"
                onClick={() => setCurrentPage(i + 1)}
                className={`px-3 py-1 rounded text-xs font-bold leading-tight ${currentPage === i + 1 ? 'border border-primary bg-primary text-white font-semibold' : 'border border-neutral-300 bg-white hover:bg-neutral-100'}`}
              >
                {i + 1}
              </button>
            ))}
            <button 
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
              className={`px-2 py-1 rounded border border-neutral-300 bg-white hover:bg-neutral-100 ${currentPage === totalPages ? 'opacity-45 cursor-not-allowed' : ''}`}
            >
              <ChevronRight className="w-3.5 h-3.5 text-neutral-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Bento Area for Logic Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rule Logic Path Card */}
        <div className="lg:col-span-2 bg-white border border-neutral-300 rounded-lg p-5 relative overflow-hidden shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-neutral-800 mb-4 tracking-tight uppercase">Rule Logic Path Analysis</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3.5 bg-neutral-50 border border-neutral-250 rounded-md">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-fidelity-green-bright shrink-0"></span>
                  <span className="font-mono text-xs text-neutral-700">Customer_Type == "PREMIUM"</span>
                </div>
                <span className="font-mono text-xs text-neutral-500 font-bold">84 Hits</span>
              </div>
              <div className="flex items-center justify-between p-3.5 bg-neutral-50 border border-neutral-250 rounded-md">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-fidelity-green-bright shrink-0"></span>
                  <span className="font-mono text-xs text-neutral-700">Balance &gt; 50000.00</span>
                </div>
                <span className="font-mono text-xs text-neutral-500 font-bold">12 Hits</span>
              </div>
              <div className="flex items-center justify-between p-3.5 bg-red-50/50 border border-red-200 rounded-md">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 shrink-0"></span>
                  <span className="font-mono text-xs text-neutral-700">Account_Standing == "ACTIVE"</span>
                </div>
                <span className="font-mono text-xs text-red-600 font-bold">3 Misses (Regression)</span>
              </div>
            </div>
          </div>
          <div className="mt-5 border-t border-neutral-200/65 pt-3">
            <button 
              type="button"
              onClick={() => onSwitchTab('test-runs')}
              className="text-secondary font-bold text-xs flex items-center gap-1.5 hover:underline decoration-2 underline-offset-4 bg-transparent outline-none border-none"
            >
              Explore Logical Tree <ArrowRight className="w-3.5 h-3.5 text-secondary" />
            </button>
          </div>
        </div>

        {/* AI Audit Intelligence Card */}
        <div className="bg-primary text-white rounded-lg p-5 flex flex-col justify-between shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-15 pointer-events-none">
            <Sparkles className="w-20 h-20 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-emerald-300" />
              <span className="text-[10px] uppercase tracking-wider font-bold">AI Audit Intelligence</span>
            </div>
            <h4 className="text-lg font-bold leading-tight mb-2">Optimize nested logic in v12</h4>
            <p className="text-xs text-green-100 opacity-90 leading-relaxed">
              We've identified three redundant logical paths. Flattening these would increase execution speed by approximately <span className="font-bold underline text-white">14%</span> based on current hit patterns.
            </p>
          </div>
          <button 
            type="button"
            onClick={handleApplyOptimization}
            className="mt-6 w-full py-2.5 bg-white text-primary rounded font-bold text-xs hover:bg-green-50 transition-colors shadow-sm outline-none cursor-pointer"
          >
            Apply Optimization
          </button>
        </div>
      </div>
    </div>
  );
}
