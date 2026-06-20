import React, { useState } from 'react';
import { 
  XOctagon, 
  CheckCircle, 
  HelpCircle, 
  AlertTriangle, 
  MinusCircle, 
  ListRestart, 
  Sliders, 
  Copy, 
  ChevronDown, 
  ChevronRight, 
  Code,
  Sparkles
} from 'lucide-react';
import { EvaluationNode } from '../types';

interface TestRunsTabProps {
  selectedTestCaseId: string | null;
  onSwitchTab: (tab: 'overview' | 'test-data' | 'generated' | 'test-runs' | 'coverage') => void;
}

// Interactive nodes schema details
const LOGIC_NODES: Record<string, {
  title: string;
  expression: string;
  expected: string;
  actual: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
}> = {
  'age': {
    title: 'customer.age >= 18',
    expression: 'customer.age >= 18',
    expected: '>= 18',
    actual: '25',
    status: 'PASSED'
  },
  'tags': {
    title: 'customer.tags contains VIP',
    expression: 'customer.tags contains VIP',
    expected: 'contains "VIP"',
    actual: '["VIP", "LOYALTY"]',
    status: 'PASSED'
  },
  'balance': {
    title: 'accounts.balance > 20000',
    expression: 'accounts.balance > 20000',
    expected: '> 20000.00',
    actual: '15000.00',
    status: 'FAILED'
  },
  'orders': {
    title: 'orders.pending exists',
    expression: 'orders.pending exists',
    expected: 'exists == true',
    actual: 'null (short-circuited)',
    status: 'SKIPPED'
  }
};

export default function TestRunsTab({
  selectedTestCaseId,
  onSwitchTab
}: TestRunsTabProps) {
  const [activeNodeId, setActiveNodeId] = useState<string>('balance');
  const [isTreeExpanded, setIsTreeExpanded] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const activeNodeInfo = LOGIC_NODES[activeNodeId] || LOGIC_NODES['balance'];

  const rawJsonSnapshot = `{
  "customer": {
    "id": "CUST-8821",
    "age": 25,
    "tags": ["VIP", "LOYALTY"]
  },
  "accounts": [
    {
      "type": "CHECKING",
      "balance": 15000.00,
      "currency": "USD"
    }
  ],
  "orders": {
    "pending": null,
    "total_count": 12
  },
  "timestamp": "2023-11-24T10:15:30Z"
}`;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(rawJsonSnapshot);
    setIsCopied(true);
    showToast("📋 Log Snapshot JSON copied to clipboard!");
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-neutral-100">
      {/* Toast Alert Feedback */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-neutral-900 text-white px-5 py-3 rounded shadow-xl border border-secondary flex items-center gap-3 animate-fade-in">
          <Sparkles className="w-5 h-5 text-yellow-500 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Summary Failure Banner Bar */}
      <div className="p-5 bg-white border-b border-neutral-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-red-550 bg-red-100/80 text-red-700 px-4 py-2.5 rounded border border-red-200">
            <XOctagon className="w-5 h-5 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider">FAILED</span>
          </div>
          <div>
            <h1 className="font-bold text-base text-neutral-900 leading-tight">CrossSellCampaignEligibility</h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Reason: <span className="font-bold text-red-600">Account balance failed to meet minimum threshold</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            type="button"
            onClick={() => showToast("Parsing full execution trace history (1,248 instructions)...")}
            className="px-3 py-1.5 text-xs font-bold border border-neutral-300 rounded bg-white hover:bg-neutral-50 flex items-center gap-1.5 transition-colors text-secondary"
          >
            <ListRestart className="w-3.5 h-3.5" />
            Trace History
          </button>
          <button 
            type="button"
            onClick={() => {
              onSwitchTab('test-data');
              showToast("Opened rule logic data manager to customize rule equations.");
            }}
            className="px-3 py-1.5 text-xs font-bold border border-neutral-300 rounded bg-white hover:bg-neutral-50 flex items-center gap-1.5 transition-colors text-secondary"
          >
            <Sliders className="w-3.5 h-3.5" />
            Edit Logic
          </button>
        </div>
      </div>

      {/* Main Debug Workspace Grid */}
      <div className="flex-1 p-5 min-h-0 overflow-auto grid grid-cols-12 gap-5 font-sans">
        
        {/* Left Tree Panel (Col 7) */}
        <section className="col-span-12 lg:col-span-7 flex flex-col min-h-0">
          <div className="bg-white border border-neutral-300 flex flex-col h-full rounded-md overflow-hidden shadow-xs">
            <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-300 flex items-center justify-between z-10 shrink-0">
              <span className="text-xs font-bold text-neutral-800 uppercase tracking-wide">Evaluation Logic Tree</span>
              <span className="text-[10px] uppercase font-bold text-neutral-400">4 Nodes Evaluated</span>
            </div>

            {/* Tree Workspace container */}
            <div className="flex-1 p-5 overflow-auto font-mono text-xs">
              <div className="flex flex-col gap-3">
                
                {/* Parent AND Rule Group */}
                <div 
                  onClick={() => setIsTreeExpanded(!isTreeExpanded)}
                  className="flex items-center gap-2.5 py-2 px-3 bg-red-50/50 border-l-4 border-red-600 rounded cursor-pointer select-none transition-colors hover:bg-red-50"
                >
                  {isTreeExpanded ? (
                    <ChevronDown className="w-4 h-4 text-red-600" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-red-600" />
                  )}
                  <span className="font-bold text-neutral-800">AND Group</span>
                  <span className="text-red-600 font-bold ml-auto">[FAILED]</span>
                </div>

                {isTreeExpanded && (
                  <div className="ml-5 pl-4 border-l border-neutral-300 space-y-3 pt-2 relative">
                    
                    {/* Node 1: Passed age limit */}
                    <div 
                      onClick={() => setActiveNodeId('age')}
                      className={`relative flex items-center gap-3 p-3 rounded border transition-all cursor-pointer select-none ${activeNodeId === 'age' ? 'bg-green-50/40 border-primary shadow-xs ring-1 ring-primary/10' : 'bg-neutral-50 border-neutral-200 hover:border-neutral-400'}`}
                    >
                      <CheckCircle className="w-4.5 h-4.5 text-fidelity-green-bright shrink-0" />
                      <div className="flex-1 flex justify-between items-center pr-1">
                        <span className="font-bold text-neutral-800">customer.age &gt;= 18</span>
                        <div className="flex items-center gap-4 text-[11px]">
                          <span className="text-neutral-400">Actual: <span className="text-fidelity-green-bright font-bold">25</span></span>
                          <span className="text-fidelity-green-bright font-bold">[PASSED]</span>
                        </div>
                      </div>
                    </div>

                    {/* Node 2: Passed vip tag */}
                    <div 
                      onClick={() => setActiveNodeId('tags')}
                      className={`relative flex items-center gap-3 p-3 rounded border transition-all cursor-pointer select-none ${activeNodeId === 'tags' ? 'bg-green-50/40 border-primary shadow-xs ring-1 ring-primary/10' : 'bg-neutral-50 border-neutral-200 hover:border-neutral-400'}`}
                    >
                      <CheckCircle className="w-4.5 h-4.5 text-fidelity-green-bright shrink-0" />
                      <div className="flex-1 flex justify-between items-center pr-1">
                        <span className="font-bold text-neutral-800">customer.tags contains VIP</span>
                        <div className="flex items-center gap-4 text-[11px]">
                          <span className="text-neutral-400">Actual: <span className="text-fidelity-green-bright font-bold">["VIP", "LOYALTY"]</span></span>
                          <span className="text-fidelity-green-bright font-bold">[PASSED]</span>
                        </div>
                      </div>
                    </div>

                    {/* Node 3: Failed Balance restriction */}
                    <div 
                      onClick={() => setActiveNodeId('balance')}
                      className={`relative flex items-center gap-3 p-3 rounded border transition-all cursor-pointer select-none ${activeNodeId === 'balance' ? 'bg-red-50/30 border-red-500 shadow-xs ring-1 ring-red-500/10' : 'bg-red-50/10 border-red-200 hover:border-red-400'}`}
                    >
                      <AlertTriangle className="w-4.5 h-4.5 text-red-600 shrink-0" />
                      <div className="flex-1 flex justify-between items-center pr-1">
                        <span className="font-bold text-neutral-900">accounts.balance &gt; 20000</span>
                        <div className="flex items-center gap-4 text-[11px]">
                          <span className="text-neutral-500">Actual: <span className="text-red-600 font-bold">15000</span></span>
                          <span className="text-red-600 font-bold">[FAILED]</span>
                        </div>
                      </div>
                    </div>

                    {/* Node 4: Skipped (due to short-circuiting) */}
                    <div 
                      onClick={() => setActiveNodeId('orders')}
                      className={`relative flex items-center gap-3 p-3 rounded border opacity-50 transition-all cursor-pointer select-none ${activeNodeId === 'orders' ? 'bg-neutral-100 border-neutral-400 ring-1 ring-neutral-300' : 'bg-neutral-100 border-neutral-200 hover:border-neutral-400'}`}
                    >
                      <MinusCircle className="w-4.5 h-4.5 text-neutral-400 shrink-0" />
                      <div className="flex-1 flex justify-between items-center pr-1">
                        <span className="text-neutral-600">orders.pending exists</span>
                        <div className="flex items-center gap-4 text-[11px]">
                          <span className="italic text-neutral-500">Short-circuited</span>
                          <span className="text-neutral-500 font-bold">[SKIPPED]</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Right Detail Panel (Col 5) */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-5 min-h-0 overflow-hidden">
          
          {/* Term Breakdown Card */}
          <section className="bg-white border border-neutral-300 rounded-md flex flex-col shadow-xs shrink-0">
            <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-300 flex items-center gap-2">
              <Code className="w-4 h-4 text-secondary shrink-0" />
              <span className="text-xs font-bold text-neutral-800 uppercase tracking-wide">Term Breakdown</span>
            </div>
            <div className="p-4 space-y-4">
              <div className={`p-4 border-l-4 rounded-r ${activeNodeInfo.status === 'PASSED' ? 'border-primary bg-green-50/40' : activeNodeInfo.status === 'FAILED' ? 'border-red-600 bg-red-50/30' : 'border-neutral-300 bg-neutral-50/60'}`}>
                <h4 className={`text-[10px] font-bold uppercase mb-1 ${activeNodeInfo.status === 'PASSED' ? 'text-primary' : activeNodeInfo.status === 'FAILED' ? 'text-red-700' : 'text-neutral-500'}`}>
                  {activeNodeInfo.status} TERM
                </h4>
                <p className="font-mono text-xs font-bold text-neutral-800 break-words">{activeNodeInfo.expression}</p>
                
                <div className="grid grid-cols-2 gap-3 mt-4 text-xs font-mono">
                  <div className="p-2.5 bg-white border border-neutral-250 rounded">
                    <span className="block text-[9px] text-neutral-400 font-bold uppercase mb-1">Expected</span>
                    <span className="font-bold text-neutral-800 text-[11px]">{activeNodeInfo.expected}</span>
                  </div>
                  <div className={`p-2.5 border rounded ${activeNodeInfo.status === 'PASSED' ? 'bg-green-50/60 border-green-200' : activeNodeInfo.status === 'FAILED' ? 'bg-red-50/60 border-red-200' : 'bg-neutral-50 border-neutral-200'}`}>
                    <span className={`block text-[9px] font-bold uppercase mb-1 ${activeNodeInfo.status === 'PASSED' ? 'text-primary' : activeNodeInfo.status === 'FAILED' ? 'text-red-700' : 'text-neutral-500'}`}>Actual</span>
                    <span className={`font-bold text-[11px] ${activeNodeInfo.status === 'PASSED' ? 'text-primary' : activeNodeInfo.status === 'FAILED' ? 'text-red-700' : 'text-neutral-700'}`}>{activeNodeInfo.actual}</span>
                  </div>
                </div>
              </div>
              <button 
                type="button"
                className="w-full py-2 border border-secondary text-secondary hover:bg-neutral-50 text-xs font-bold transition-all rounded"
                onClick={() => {
                  showToast("Rendering full unified pipeline AST breakdown traces...");
                }}
              >
                VIEW FULL TRACE LOGS
              </button>
            </div>
          </section>

          {/* Data Snapshot Card */}
          <section className="bg-white border border-neutral-300 rounded-md flex flex-col flex-1 min-h-0 shadow-xs overflow-hidden">
            <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-300 flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-neutral-800 uppercase tracking-wide">Data Snapshot</span>
              <button 
                type="button"
                className="text-xs font-bold text-primary hover:underline"
                onClick={handleCopyJson}
              >
                {isCopied ? 'COPIED!' : 'COPY JSON'}
              </button>
            </div>

            {/* Dark editor mock */}
            <div className="flex-1 p-4 bg-[#141414] text-[#d4d4d4] font-mono text-xs overflow-auto select-text leading-6">
              <pre><code>{`{
  `}<span className="text-emerald-400">"customer"</span>: {`{
    `}<span className="text-emerald-400">"id"</span>: <span className="text-amber-300">"CUST-8821"</span>,
    <span className="text-emerald-400">"age"</span>: <span className="text-teal-400">25</span>,
    <span className="text-emerald-400">"tags"</span>: [<span className="text-amber-300">"VIP"</span>, <span className="text-amber-300">"LOYALTY"</span>]
  {`},
  `}<span className="text-emerald-400">"accounts"</span>: {`[
    {
      `}<span className="text-emerald-400">"type"</span>: <span className="text-amber-300">"CHECKING"</span>,
      <span className="text-emerald-400">"balance"</span>: <span className="text-teal-400">15000.00</span>,
      <span className="text-emerald-400">"currency"</span>: <span className="text-amber-300">"USD"</span>
    {`}
  ],
  `}<span className="text-emerald-400">"orders"</span>: {`{
    `}<span className="text-emerald-400">"pending"</span>: <span className="text-neutral-500">null</span>,
    <span className="text-emerald-400">"total_count"</span>: <span className="text-teal-400">12</span>
  {`},
  `}<span className="text-emerald-400">"timestamp"</span>: <span className="text-amber-300">"2023-11-24T10:15:30Z"</span>
{`}`}</code></pre>
            </div>
          </section>

        </div>

      </div>
    </div>
  );
}
