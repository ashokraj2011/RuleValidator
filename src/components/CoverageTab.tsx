import React, { useState } from 'react';
import { 
  BarChart2, 
  HelpCircle, 
  Layers, 
  FileWarning, 
  AlertOctagon, 
  Activity, 
  ChevronRight, 
  Zap,
  Sparkles,
  Award
} from 'lucide-react';
import { CoverageItem } from '../types';

interface CoverageTabProps {
  aggregateCoverage: number;
  setAggregateCoverage: (cov: number) => void;
  isOptimized: boolean;
}

const INITIAL_GRID_ROWS = 96;

// Sample custom nodes details mapped on random click indices
const CUSTOM_NODES_MAP: Record<number, { name: string; calls: number; coverage: number; status: string }> = {
  4: { name: "rule.eligibility.VIP_check", calls: 8940, coverage: 100, status: 'PASSED' },
  12: { name: "rule.bounds.age_max_limit", calls: 4120, coverage: 100, status: 'PASSED' },
  24: { name: "rule.failure.api_timeout", calls: 0, coverage: 0, status: 'CRITICAL GAP' },
  35: { name: "rule.calculations.scoring_tree", calls: 12040, coverage: 85, status: 'PASSED' },
  48: { name: "rule.exceptions.null_reference", calls: 140, coverage: 12, status: 'WARNING' },
  72: { name: "rule.eligibility.balance_scoring", calls: 3410, coverage: 90, status: 'PASSED' }
};

export default function CoverageTab({
  aggregateCoverage,
  setAggregateCoverage,
  isOptimized
}: CoverageTabProps) {
  const [activeCellIndex, setActiveCellIndex] = useState<number>(12);
  const [activeBreakdownTab, setActiveBreakdownTab] = useState<'namespace' | 'operator'>('namespace');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Uncovered scenarios list inside state to support deletion/resolve
  const [scenarios, setScenarios] = useState([
    {
      id: 'UN-042',
      risk: 'HIGH RISK' as const,
      title: 'API timeout for session namespace',
      description: 'System behavior is undefined when the cross-sell API returns a 408 response code.'
    },
    {
      id: 'UN-115',
      risk: 'MEDIUM' as const,
      title: 'Negative balance overflow handling',
      description: 'Validation logic for edge-case integer overflow on legacy account types.'
    },
    {
      id: 'UN-089',
      risk: 'MEDIUM' as const,
      title: 'Currency mismatch in multi-tenant mode',
      description: 'No test data exists for tenants where base currency differs from reporting currency.'
    }
  ]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCellClick = (idx: number) => {
    setActiveCellIndex(idx);
    const customNode = CUSTOM_NODES_MAP[idx];
    if (customNode) {
      showToast(`Selected compiled logic node: ${customNode.name}`);
    } else {
      showToast(`Inspecting logic block hash 0x${idx.toString(16).toUpperCase()}`);
    }
  };

  const handleAutoGenerateAll = () => {
    if (scenarios.length === 0) {
      showToast("All uncovered edge-cases are already covered by valid synthetic test cases!");
      return;
    }
    showToast("⚙️ Injecting automated coverage cases to clear gaps...");
    setTimeout(() => {
      setScenarios([]);
      setAggregateCoverage(99.1);
      showToast("✨ Auto-generated 3 coverage regressions. Aggregated Coverage successfully boosted to 99.1%!");
    }, 1500);
  };

  // Get current selected cell information
  const cellDetails = CUSTOM_NODES_MAP[activeCellIndex] || {
    name: `rule.internal_block.0x${activeCellIndex.toString(16).toUpperCase().padStart(4, '0')}`,
    calls: activeCellIndex * 120 + 20,
    coverage: activeCellIndex % 3 === 0 ? 100 : activeCellIndex % 5 === 0 ? 40 : 85,
    status: activeCellIndex % 5 === 0 ? 'WARNING' : 'PASSED'
  };

  return (
    <div className="space-y-6">
      {/* Toast feedback messages */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-neutral-900 text-white px-5 py-3 rounded shadow-xl border border-secondary flex items-center gap-3 animate-fade-in">
          <Zap className="w-5 h-5 text-yellow-400 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Header section identical to layout visual design */}
      <div className="mb-0 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Coverage Analysis</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Comprehensive breakdown of rule logic execution and edge-case validation.
          </p>
        </div>
        <div className="shrink-0">
          <div className="bg-neutral-50 px-5 py-2.5 border border-neutral-300 rounded-lg flex flex-col items-end shadow-xs">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Aggregate Coverage</span>
            <span className="text-3xl font-extrabold text-primary select-all leading-tight">
              {isOptimized ? '92.4%' : '82.4%'}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Bento Grid identical to mock picture */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Operator Coverage Card */}
        <div className="bg-white border border-neutral-300 p-4.5 rounded-lg flex flex-col justify-between hover:border-secondary transition-all cursor-default shadow-xs h-28">
          <div className="flex justify-between items-start">
            <Layers className="w-5 h-5 text-secondary" />
            <span className="text-[10px] font-mono text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded font-bold">80%</span>
          </div>
          <div>
            <div className="text-xs font-semibold text-neutral-400">Operator Coverage</div>
            <div className="text-xl font-bold text-neutral-900 mt-0.5">12 / 15</div>
          </div>
        </div>

        {/* Namespace Coverage Card */}
        <div className="bg-white border border-neutral-300 p-4.5 rounded-lg flex flex-col justify-between hover:border-secondary transition-all cursor-default shadow-xs h-28">
          <div className="flex justify-between items-start">
            <Activity className="w-5 h-5 text-secondary" />
            <span className="text-[10px] font-mono text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded font-bold">83%</span>
          </div>
          <div>
            <div className="text-xs font-semibold text-neutral-400">Namespace Coverage</div>
            <div className="text-xl font-bold text-neutral-900 mt-0.5">5 / 6</div>
          </div>
        </div>

        {/* Boundary Case Coverage Card */}
        <div className="bg-white border border-neutral-300 p-4.5 rounded-lg flex flex-col justify-between hover:border-secondary transition-all cursor-default shadow-xs h-28">
          <div className="flex justify-between items-start">
            <Award className="w-5 h-5 text-secondary" />
            <span className="text-[10px] font-mono text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded font-bold">80%</span>
          </div>
          <div>
            <div className="text-xs font-semibold text-neutral-400">Boundary Case Coverage</div>
            <div className="text-xl font-bold text-neutral-900 mt-0.5">8 / 10</div>
          </div>
        </div>

        {/* Failure Path Coverage Card */}
        <div className="bg-white border border-neutral-300 p-4.5 rounded-lg flex flex-col justify-between hover:border-secondary transition-all cursor-default shadow-xs h-28">
          <div className="flex justify-between items-start">
            <AlertOctagon className="w-5 h-5 text-red-500 animate-pulse" />
            <span className="text-[10px] font-mono text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded font-bold">66%</span>
          </div>
          <div>
            <div className="text-xs font-semibold text-neutral-400">Failure Path Coverage</div>
            <div className="text-xl font-bold text-neutral-900 mt-0.5">6 / 9</div>
          </div>
        </div>

      </div>

      {/* Main visual Heatmap and right panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Rule Logic Heatmap pane */}
        <div className="lg:col-span-2 bg-white border border-neutral-300 p-5 rounded-lg shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5 select-none">
              <h3 className="font-bold text-sm text-neutral-800">Rule Logic Heatmap</h3>
              <div className="flex items-center gap-4 text-[10px] font-semibold text-neutral-500">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-red-100 border border-red-200 rounded"></span>
                  <span>0%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-primary rounded"></span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            {/* Heatmap Visual Matrix cells */}
            <div className="grid grid-cols-8 sm:grid-cols-12 gap-[6px] select-none">
              {Array.from({ length: INITIAL_GRID_ROWS }, (_, i) => {
                let cellClass = "bg-primary opacity-90";
                if (i === 12 || i === 4 || i === 72) {
                  cellClass = "bg-[#368727] opacity-100 ring-2 ring-emerald-500/30";
                } else if (i === 24) {
                  cellClass = "bg-red-200 border border-red-300";
                } else if (i % 7 === 0) {
                  cellClass = "bg-rose-100 border border-rose-300";
                } else if (i % 3 === 0) {
                  cellClass = "bg-primary opacity-45";
                } else if (i % 5 === 0) {
                  cellClass = "bg-primary opacity-75";
                }

                const isActive = activeCellIndex === i;

                return (
                  <div 
                    key={i}
                    onClick={() => handleCellClick(i)}
                    className={`${cellClass} aspect-square rounded-[3px] cursor-pointer hover:scale-115 hover:z-20 transition-all ${isActive ? 'ring-2 ring-neutral-900 ring-offset-1 scale-110' : ''}`}
                    title={CUSTOM_NODES_MAP[i] ? CUSTOM_NODES_MAP[i].name : `Logic Node Block 0x${i.toString(16).toUpperCase()}`}
                  />
                );
              })}
            </div>
          </div>

          {/* Expanded Selected Node Inspector details (from first screen footer) */}
          <div className="mt-8 border-t border-neutral-200/80 pt-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-bold text-neutral-800 mb-2.5 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-fidelity-green-bright shrink-0"></span>
                  Most Accessed Node (Constant hit)
                </h4>
                <div className="font-mono text-xs bg-neutral-50 p-3 rounded border border-neutral-250 leading-relaxed">
                  <span className="text-primary font-bold">rule.eligibility.age_check</span>
                  <div className="mt-1.5 text-neutral-500 text-[11px]">Calls: 14,290 | Coverage: 100%</div>
                </div>
              </div>
              
              <div>
                <h4 className="text-xs font-bold text-neutral-800 mb-2.5 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 shrink-0"></span>
                  Active Node Inspector (Focused block)
                </h4>
                <div className={`font-mono text-xs p-3 rounded border leading-relaxed ${cellDetails.status === 'CRITICAL GAP' || cellDetails.coverage < 20 ? 'bg-red-50 border-red-200' : 'bg-neutral-50 border-neutral-250'}`}>
                  <span className={`${cellDetails.status === 'CRITICAL GAP' || cellDetails.coverage < 20 ? 'text-red-600 font-bold' : 'text-primary font-bold'}`}>
                    {cellDetails.name}
                  </span>
                  <div className="mt-1.5 text-neutral-500 text-[11px]">
                    Calls: {cellDetails.calls.toLocaleString()} | Coverage: {cellDetails.coverage}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Scenarios Side Card */}
        <div className="bg-white border border-neutral-300 flex flex-col justify-between shadow-xs rounded-lg overflow-hidden">
          <div>
            <div className="p-5 border-b border-neutral-200 bg-neutral-50">
              <h3 className="font-bold text-sm text-neutral-800 leading-none">Uncovered Scenarios</h3>
              <p className="text-[10px] font-semibold text-neutral-400 mt-1 uppercase tracking-wide">
                Prioritized risk vectors lacking logical test cases
              </p>
            </div>
            
            <div className="divide-y divide-neutral-200 overflow-y-auto max-h-96">
              {scenarios.length === 0 ? (
                <div className="p-6 text-center text-xs text-neutral-400 font-medium">
                  ✨ Excellent work! Zero uncovered test paths detected. Coverage is saturated.
                </div>
              ) : (
                scenarios.map((scen) => (
                  <div key={scen.id} className="p-4 hover:bg-neutral-50/50 transition-colors">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`px-2 py-0.5 text-[9px] font-bold rounded ${scen.risk === 'HIGH RISK' ? 'bg-red-550 bg-red-100 text-red-700 font-semibold' : 'bg-neutral-100 text-neutral-600'}`}>
                        {scen.risk}
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">ID: {scen.id}</span>
                    </div>
                    <div className="font-semibold text-xs text-neutral-850 leading-snug mb-1">{scen.title}</div>
                    <p className="text-[11px] text-neutral-400 leading-normal">{scen.description}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-4 bg-neutral-50 border-t border-neutral-200">
            <button 
              type="button"
              onClick={handleAutoGenerateAll}
              className="w-full py-2 bg-secondary text-white font-bold text-xs rounded hover:opacity-95 transition-all outline-none cursor-pointer"
            >
              Auto-Generate Tests for All
            </button>
          </div>
        </div>

      </div>

      {/* Detailed Coverage Tables breakdown identical to layout design screenshot 5 */}
      <section className="bg-white border border-neutral-300 rounded-lg overflow-hidden shadow-xs mt-4">
        <div className="p-4.5 border-b border-neutral-300 flex justify-between items-center bg-neutral-50 shrink-0 select-none">
          <h3 className="font-bold text-sm text-neutral-800 leading-tight">Detailed Breakdown</h3>
          <div className="flex border border-neutral-300 rounded p-0.5 bg-neutral-200/50 gap-0.5">
            <button 
              type="button" 
              onClick={() => {
                setActiveBreakdownTab('namespace');
                showToast("Breakdown: Grouping by logical namespace.");
              }}
              className={`px-3 py-1 font-semibold text-xs rounded leading-none transition-all outline-none cursor-pointer ${activeBreakdownTab === 'namespace' ? 'bg-white text-neutral-800' : 'text-neutral-500 hover:text-neutral-900'}`}
            >
              By Namespace
            </button>
            <button 
              type="button" 
              onClick={() => {
                setActiveBreakdownTab('operator');
                showToast("Breakdown: Grouping by logical operators.");
              }}
              className={`px-3 py-1 font-semibold text-xs rounded leading-none transition-all outline-none cursor-pointer ${activeBreakdownTab === 'operator' ? 'bg-white text-neutral-800' : 'text-neutral-500 hover:text-neutral-900'}`}
            >
              By Operator
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-250 text-xs text-neutral-500 font-semibold uppercase tracking-wider">
                <th className="p-4 pl-6">{activeBreakdownTab === 'namespace' ? 'Namespace' : 'Logical Operator'}</th>
                <th className="p-4">Rules Count</th>
                <th className="p-4">Paths Executed</th>
                <th className="p-4 w-72">Coverage Status</th>
                <th className="p-4 pr-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="text-xs text-neutral-700 divide-y divide-neutral-200 font-sans">
              
              {activeBreakdownTab === 'namespace' ? (
                <>
                  <tr className="hover:bg-neutral-50/50">
                    <td className="p-4 pl-6 font-mono font-bold text-neutral-800">user.profile</td>
                    <td className="p-4">12</td>
                    <td className="p-4">48 / 48</td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-neutral-150 bg-neutral-200 rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: '100%' }}></div>
                        </div>
                        <span className="font-bold text-neutral-905 w-10 text-right">100%</span>
                      </div>
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <button type="button" onClick={() => showToast("Inspecting child nodes in user.profile namespace.")} className="text-secondary hover:underline font-bold text-xs bg-transparent border-none">View Nodes</button>
                    </td>
                  </tr>

                  <tr className="hover:bg-neutral-50/50">
                    <td className="p-4 pl-6 font-mono font-bold text-neutral-800">campaign.metadata</td>
                    <td className="p-4">24</td>
                    <td className="p-4">82 / 96</td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-neutral-150 bg-neutral-200 rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: '85%' }}></div>
                        </div>
                        <span className="font-bold text-neutral-905 w-10 text-right">85%</span>
                      </div>
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <button type="button" onClick={() => showToast("Inspecting child nodes in campaign.metadata namespace.")} className="text-secondary hover:underline font-bold text-xs bg-transparent border-none">View Nodes</button>
                    </td>
                  </tr>

                  <tr className="hover:bg-neutral-50/50">
                    <td className="p-4 pl-6 font-mono font-bold text-neutral-800">transaction.history</td>
                    <td className="p-4">18</td>
                    <td className="p-4">12 / 54</td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-neutral-150 bg-neutral-200 rounded-full overflow-hidden">
                          <div className="h-full bg-red-600" style={{ width: '22%' }}></div>
                        </div>
                        <span className="font-bold text-red-600 w-10 text-right">22%</span>
                      </div>
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <button type="button" onClick={() => showToast("Error log: AST mapping lacks transaction coverage. Expand required branch.")} className="text-secondary hover:underline font-bold text-xs bg-transparent border-none">View Nodes</button>
                    </td>
                  </tr>
                </>
              ) : (
                <>
                  <tr className="hover:bg-neutral-50/50">
                    <td className="p-4 pl-6 font-mono font-bold text-neutral-800">Inclusion (==, &gt;=, contains)</td>
                    <td className="p-4 font-semibold">14</td>
                    <td className="p-4">42 / 45</td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-neutral-150 bg-neutral-200 rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: '93.3%' }}></div>
                        </div>
                        <span className="font-bold text-neutral-905 w-10 text-right">93%</span>
                      </div>
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <button type="button" onClick={() => showToast("Inspecting equality operation nodes.")} className="text-secondary hover:underline font-bold text-xs bg-transparent border-none">View Nodes</button>
                    </td>
                  </tr>

                  <tr className="hover:bg-neutral-50/50">
                    <td className="p-4 pl-6 font-mono font-bold text-neutral-800">Exclusion (!=, not)</td>
                    <td className="p-4 font-semibold">6</td>
                    <td className="p-4">4 / 8</td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-neutral-150 bg-neutral-200 rounded-full overflow-hidden">
                          <div className="h-full bg-red-600" style={{ width: '50%' }}></div>
                        </div>
                        <span className="font-bold text-red-600 w-10 text-right">50%</span>
                      </div>
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <button type="button" onClick={() => showToast("Inspecting exclusive operation nodes.")} className="text-secondary hover:underline font-bold text-xs bg-transparent border-none">View Nodes</button>
                    </td>
                  </tr>
                </>
              )}

            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
