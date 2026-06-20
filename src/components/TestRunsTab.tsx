import React, { useState, useMemo } from 'react';
import { 
  XOctagon, 
  CheckCircle, 
  AlertTriangle, 
  MinusCircle, 
  Sliders, 
  Copy, 
  ChevronDown, 
  ChevronRight, 
  Code,
  Sparkles,
  PlayCircle
} from 'lucide-react';
import { Rule, TestDataSnapshot, EvalResult } from '../types';
import { evaluateRule, operatorDisplay, isRuleRefTerm } from '../ruleEngine';

interface TestRunsTabProps {
  rule: Rule;
  allRules: Rule[];
  testData: TestDataSnapshot;
  onSwitchTab: (tab: 'overview' | 'test-data' | 'generated' | 'test-runs' | 'coverage') => void;
}

interface EvalNodeProps {
  result: EvalResult;
  depth?: number;
  activeNodeId: string | null;
  setActiveNodeId: (id: string) => void;
}

const EvalNode: React.FC<EvalNodeProps> = ({ result, depth = 0, activeNodeId, setActiveNodeId }) => {
  const [expanded, setExpanded] = useState(true);
  const nodeId = `${depth}-${result.expression}`;
  const isGroup = !!result.children;
  const isActive = activeNodeId === nodeId;

  const statusIcon = result.status === 'PASSED' ? (
    <CheckCircle className="w-4.5 h-4.5 text-fidelity-green-bright shrink-0" />
  ) : result.status === 'FAILED' ? (
    <AlertTriangle className="w-4.5 h-4.5 text-red-600 shrink-0" />
  ) : (
    <MinusCircle className="w-4.5 h-4.5 text-neutral-400 shrink-0" />
  );

  const statusColor = result.status === 'PASSED' ? 'text-fidelity-green-bright' : result.status === 'FAILED' ? 'text-red-600' : 'text-neutral-500';
  const borderColor = result.status === 'PASSED' ? 'border-fidelity-green-bright' : result.status === 'FAILED' ? 'border-red-600' : 'border-neutral-300';
  const bgColor = result.status === 'PASSED' ? 'bg-green-50/50' : result.status === 'FAILED' ? 'bg-red-50/50' : 'bg-neutral-50';

  if (isGroup) {
    return (
      <div className="flex flex-col gap-2">
        <div
          onClick={() => setExpanded(!expanded)}
          className={`flex items-center gap-2.5 py-2 px-3 ${bgColor} border-l-4 ${borderColor} rounded cursor-pointer select-none transition-colors hover:opacity-80`}
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-neutral-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-neutral-500" />
          )}
          <span className="font-bold text-neutral-800">{result.expression}</span>
          <span className={`${statusColor} font-bold ml-auto`}>[{result.status}]</span>
        </div>
        {expanded && (
          <div className="ml-5 pl-4 border-l border-neutral-300 space-y-2 pt-1">
            {result.children!.map((child, i) => (
              <EvalNode
                key={i}
                result={child}
                depth={depth + 1}
                activeNodeId={activeNodeId}
                setActiveNodeId={setActiveNodeId}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={() => setActiveNodeId(nodeId)}
      className={`relative flex items-center gap-3 p-3 rounded border transition-all cursor-pointer select-none ${
        isActive
          ? result.status === 'PASSED'
            ? 'bg-green-50/40 border-primary shadow-xs ring-1 ring-primary/10'
            : result.status === 'FAILED'
            ? 'bg-red-50/30 border-red-500 shadow-xs ring-1 ring-red-500/10'
            : 'bg-neutral-100 border-neutral-400 ring-1 ring-neutral-300'
          : result.status === 'PASSED'
          ? 'bg-neutral-50 border-neutral-200 hover:border-neutral-400'
          : result.status === 'FAILED'
          ? 'bg-red-50/10 border-red-200 hover:border-red-400'
          : 'bg-neutral-100 border-neutral-200 hover:border-neutral-400 opacity-60'
      }`}
    >
      {statusIcon}
      <div className="flex-1 flex justify-between items-center pr-1">
        <span className="font-bold text-neutral-800 text-xs">{result.expression}</span>
        <div className="flex items-center gap-4 text-[11px]">
          <span className="text-neutral-400">
            Actual: <span className={`${statusColor} font-bold`}>{JSON.stringify(result.actual)}</span>
          </span>
          <span className={`${statusColor} font-bold`}>[{result.status}]</span>
        </div>
      </div>
    </div>
  );
};

export default function TestRunsTab({
  rule,
  allRules,
  testData,
  onSwitchTab
}: TestRunsTabProps) {
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Evaluate the rule against test data
  const evalResult = useMemo(
    () => evaluateRule(rule, testData, allRules),
    [rule, testData, allRules]
  );

  // Find selected leaf node for detail panel
  const findNode = (result: EvalResult, targetId: string, depth = 0): EvalResult | null => {
    const id = `${depth}-${result.expression}`;
    if (id === targetId) return result;
    if (result.children) {
      for (let i = 0; i < result.children.length; i++) {
        const found = findNode(result.children[i], targetId, depth + 1);
        if (found) return found;
      }
    }
    return null;
  };

  const selectedNode = activeNodeId ? findNode(evalResult, activeNodeId) : null;

  const snapshotJson = JSON.stringify(testData, null, 2);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(snapshotJson);
    setIsCopied(true);
    showToast("📋 Test data snapshot copied to clipboard!");
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Count pass/fail
  const countNodes = (result: EvalResult): { passed: number; failed: number; total: number } => {
    if (!result.children) {
      return {
        passed: result.status === 'PASSED' ? 1 : 0,
        failed: result.status === 'FAILED' ? 1 : 0,
        total: 1,
      };
    }
    return result.children.reduce(
      (acc, child) => {
        const c = countNodes(child);
        return { passed: acc.passed + c.passed, failed: acc.failed + c.failed, total: acc.total + c.total };
      },
      { passed: 0, failed: 0, total: 0 }
    );
  };

  const counts = countNodes(evalResult);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-neutral-100">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-neutral-900 text-white px-5 py-3 rounded shadow-xl border border-secondary flex items-center gap-3 animate-fade-in">
          <Sparkles className="w-5 h-5 text-yellow-500 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Summary Banner */}
      <div className="p-5 bg-white border-b border-neutral-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0 shadow-xs">
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded border ${
            evalResult.status === 'PASSED'
              ? 'bg-green-100/80 text-fidelity-green-bright border-green-200'
              : 'bg-red-100/80 text-red-700 border-red-200'
          }`}>
            {evalResult.status === 'PASSED' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <XOctagon className="w-5 h-5 animate-pulse" />
            )}
            <span className="text-xs font-bold uppercase tracking-wider">{evalResult.status}</span>
          </div>
          <div>
            <h1 className="font-bold text-base text-neutral-900 leading-tight">{rule.name}</h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              {counts.passed}/{counts.total} terms passed • {counts.failed} failed
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSwitchTab('test-data')}
            className="px-3 py-1.5 text-xs font-bold border border-neutral-300 rounded bg-white hover:bg-neutral-50 flex items-center gap-1.5 transition-colors text-secondary"
          >
            <Sliders className="w-3.5 h-3.5" />
            Edit Test Data
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="flex-1 p-5 min-h-0 overflow-auto grid grid-cols-12 gap-5 font-sans">
        
        {/* Left: Evaluation Tree */}
        <section className="col-span-12 lg:col-span-7 flex flex-col min-h-0">
          <div className="bg-white border border-neutral-300 flex flex-col h-full rounded-md overflow-hidden shadow-xs">
            <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-300 flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-neutral-800 uppercase tracking-wide">Evaluation Logic Tree</span>
              <span className="text-[10px] uppercase font-bold text-neutral-400">{counts.total} Terms Evaluated</span>
            </div>
            <div className="flex-1 p-5 overflow-auto font-mono text-xs">
              <EvalNode
                result={evalResult}
                activeNodeId={activeNodeId}
                setActiveNodeId={setActiveNodeId}
              />
            </div>
          </div>
        </section>

        {/* Right: Detail + Snapshot */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-5 min-h-0 overflow-hidden">
          
          {/* Term Detail */}
          <section className="bg-white border border-neutral-300 rounded-md flex flex-col shadow-xs shrink-0">
            <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-300 flex items-center gap-2">
              <Code className="w-4 h-4 text-secondary shrink-0" />
              <span className="text-xs font-bold text-neutral-800 uppercase tracking-wide">Term Breakdown</span>
            </div>
            <div className="p-4">
              {selectedNode ? (
                <div className={`p-4 border-l-4 rounded-r ${
                  selectedNode.status === 'PASSED' ? 'border-primary bg-green-50/40' :
                  selectedNode.status === 'FAILED' ? 'border-red-600 bg-red-50/30' :
                  'border-neutral-300 bg-neutral-50/60'
                }`}>
                  <h4 className={`text-[10px] font-bold uppercase mb-1 ${
                    selectedNode.status === 'PASSED' ? 'text-primary' :
                    selectedNode.status === 'FAILED' ? 'text-red-700' :
                    'text-neutral-500'
                  }`}>
                    {selectedNode.status} TERM
                  </h4>
                  <p className="font-mono text-xs font-bold text-neutral-800 break-words">{selectedNode.expression}</p>
                  
                  <div className="grid grid-cols-2 gap-3 mt-4 text-xs font-mono">
                    <div className="p-2.5 bg-white border border-neutral-250 rounded">
                      <span className="block text-[9px] text-neutral-400 font-bold uppercase mb-1">Expected</span>
                      <span className="font-bold text-neutral-800 text-[11px]">{JSON.stringify(selectedNode.expected)}</span>
                    </div>
                    <div className={`p-2.5 border rounded ${
                      selectedNode.status === 'PASSED' ? 'bg-green-50/60 border-green-200' :
                      selectedNode.status === 'FAILED' ? 'bg-red-50/60 border-red-200' :
                      'bg-neutral-50 border-neutral-200'
                    }`}>
                      <span className={`block text-[9px] font-bold uppercase mb-1 ${
                        selectedNode.status === 'PASSED' ? 'text-primary' :
                        selectedNode.status === 'FAILED' ? 'text-red-700' :
                        'text-neutral-500'
                      }`}>Actual</span>
                      <span className={`font-bold text-[11px] ${
                        selectedNode.status === 'PASSED' ? 'text-primary' :
                        selectedNode.status === 'FAILED' ? 'text-red-700' :
                        'text-neutral-700'
                      }`}>{JSON.stringify(selectedNode.actual)}</span>
                    </div>
                  </div>

                  {selectedNode.namespace && (
                    <div className="mt-3 text-[10px] text-neutral-400">
                      Namespace: <span className="font-bold text-neutral-600">{selectedNode.namespace}</span>
                      {' • '}Attribute: <span className="font-bold text-neutral-600">{selectedNode.attribute}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-neutral-400 text-xs">
                  <PlayCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  Click a term in the tree to inspect details
                </div>
              )}
            </div>
          </section>

          {/* Data Snapshot */}
          <section className="bg-white border border-neutral-300 rounded-md flex flex-col flex-1 min-h-0 shadow-xs overflow-hidden">
            <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-300 flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-neutral-800 uppercase tracking-wide">Test Data Snapshot</span>
              <button
                type="button"
                className="text-xs font-bold text-primary hover:underline"
                onClick={handleCopyJson}
              >
                {isCopied ? 'COPIED!' : 'COPY JSON'}
              </button>
            </div>
            <div className="flex-1 p-4 bg-[#141414] text-[#d4d4d4] font-mono text-xs overflow-auto select-text leading-5">
              <pre>{snapshotJson}</pre>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
