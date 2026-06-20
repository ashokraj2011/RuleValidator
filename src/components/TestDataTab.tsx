import React, { useState } from 'react';
import { 
  Code, 
  TableProperties, 
  Database, 
  Upload, 
  Save, 
  Sparkles, 
  CheckCircle, 
  PlusCircle, 
  Edit3, 
  ChevronRight,
  Info
} from 'lucide-react';
import { Dataset } from '../types';

interface TestDataTabProps {
  dataset: Dataset;
  setDataset: React.Dispatch<React.SetStateAction<Dataset>>;
  onSwitchTab: (tab: 'overview' | 'test-data' | 'generated' | 'test-runs' | 'coverage') => void;
  setRuleStatus: (status: string) => void;
}

export default function TestDataTab({
  dataset,
  setDataset,
  onSwitchTab,
  setRuleStatus
}: TestDataTabProps) {
  const [viewMode, setViewMode] = useState<'json' | 'table'>('json');
  const [source, setSource] = useState('Production Snapshot (Latest)');
  const [rawJsonText, setRawJsonText] = useState(JSON.stringify(dataset, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Sync edits from JSON string to state
  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setRawJsonText(text);

    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && parsed.customer) {
        setDataset(parsed as Dataset);
        setJsonError(null);
      } else {
        setJsonError("Invalid schema format. Must contain a root 'customer' object.");
      }
    } catch (err: any) {
      setJsonError(`JSON Syntax Error: ${err.message}`);
    }
  };

  // Sync edits from form inputs back to JSON text in state
  const updateField = (path: string, val: any) => {
    const updated = { ...dataset };
    if (path === 'id') updated.customer.id = val;
    else if (path === 'age') updated.customer.age = Number(val);
    else if (path === 'status') updated.customer.status = val;
    
    setDataset(updated);
    setRawJsonText(JSON.stringify(updated, null, 2));
    
    // Check if status is INACTIVE and age is < 30 (triggers validation failure risk dynamically!)
    if (updated.customer.status === 'INACTIVE' && updated.customer.age < 30) {
      setRuleStatus("Degraded (Validation Risk Detected)");
    } else {
      setRuleStatus("Active");
    }
  };

  const handleFixDataPattern = () => {
    // Automatically optimize: change status to ACTIVE or set age to 35
    const updated = { ...dataset };
    updated.customer.age = 32;
    updated.customer.status = 'ACTIVE';
    setDataset(updated);
    setRawJsonText(JSON.stringify(updated, null, 2));
    setRuleStatus("Active");
    showToast("✨ Applied AI Fix: Adjusted customer status to 'ACTIVE' and age to '32' to clear validation errors!");
  };

  const handleSave = () => {
    if (jsonError) {
      showToast("❌ Unable to save. Please resolve schema errors first.");
      return;
    }
    showToast("💾 Test case 'customer.json' successfully saved to Workspace Sandbox-01.");
  };

  const handleUploadSample = () => {
    const sample: Dataset = {
      customer: {
        id: "USR-9941-K",
        age: 41,
        status: "ACTIVE",
        tags: ["VIP", "LOYALTY_PROGRAM", "HIGH_VALUE"],
        last_login: new Date().toISOString()
      }
    };
    setDataset(sample);
    setRawJsonText(JSON.stringify(sample, null, 2));
    setJsonError(null);
    showToast("Uploaded and pre-loaded sample customer JSON case.");
  };

  const handleGenerateSynthetic = () => {
    const randomId = `USR-${Math.floor(1000 + Math.random() * 9000)}-XYZ`;
    const randomAge = Math.floor(18 + Math.random() * 85);
    const statuses = ['ACTIVE', 'INACTIVE', 'PROSPECT'];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    
    const synthetic: Dataset = {
      customer: {
        id: randomId,
        age: randomAge,
        status: randomStatus,
        tags: ["SYNTHETIC", randomStatus === 'ACTIVE' ? 'VIP' : 'PROBATION'],
        last_login: new Date().toISOString()
      }
    };
    setDataset(synthetic);
    setRawJsonText(JSON.stringify(synthetic, null, 2));
    setJsonError(null);
    showToast(`✨ Generated synthetic test case ${randomId} successfully.`);
    if (randomStatus === 'INACTIVE' && randomAge < 30) {
      setRuleStatus("Degraded (Validation Risk Detected)");
    } else {
      setRuleStatus("Active");
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white border border-neutral-300 rounded-lg overflow-hidden shadow-sm">
      {/* Toast Alert Feedback */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-neutral-900 text-white px-5 py-3 rounded bg-amber-950 font-sans shadow-xl border border-primary flex items-center gap-3 animate-fade-in">
          <Sparkles className="w-5 h-5 text-yellow-500 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Toolbar Headers */}
      <div className="h-14 flex items-center justify-between px-5 border-b border-neutral-300 bg-neutral-50 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex bg-neutral-200/80 rounded-md p-0.5 border border-neutral-300 gap-0.5">
            <button 
              type="button"
              className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all outline-none cursor-pointer ${viewMode === 'json' ? 'bg-white shadow-xs text-neutral-800' : 'text-neutral-500 hover:text-neutral-900'}`}
              onClick={() => setViewMode('json')}
            >
              <Code className="w-3.5 h-3.5" />
              JSON Editor
            </button>
            <button 
              type="button"
              className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all outline-none cursor-pointer ${viewMode === 'table' ? 'bg-white shadow-xs text-neutral-800' : 'text-neutral-500 hover:text-neutral-900'}`}
              onClick={() => setViewMode('table')}
            >
              <TableProperties className="w-3.5 h-3.5" />
              Table View
            </button>
          </div>
          <div className="h-5 w-px bg-neutral-300"></div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">SOURCE:</span>
            <select 
              value={source} 
              onChange={(e) => {
                setSource(e.target.value);
                showToast(`Switched source to ${e.target.value}`);
              }}
              className="bg-transparent border-none text-xs font-bold text-primary focus:ring-0 cursor-pointer p-0 select-none outline-none"
            >
              <option>Production Snapshot (Latest)</option>
              <option>Development Mirror</option>
              <option>Manual Override</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={handleUploadSample}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-300 rounded text-xs font-semibold bg-white hover:bg-neutral-50 transition-colors"
          >
            <Database className="w-3.5 h-3.5 text-neutral-500" />
            Use Database Data
          </button>
          <button 
            type="button"
            onClick={handleGenerateSynthetic}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-primary text-primary rounded text-xs font-semibold bg-white hover:bg-green-50 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            Generate Synthetic
          </button>
          <button 
            type="button"
            onClick={() => {
              showToast("JSON Import wizard activated. Choose a valid .json config file.");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-300 rounded text-xs font-semibold bg-white hover:bg-neutral-50 transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-neutral-500" />
            Upload JSON
          </button>
          <button 
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded text-xs font-semibold hover:shadow-xs transition-all"
          >
            <Save className="w-3.5 h-3.5" />
            Save Test Case
          </button>
        </div>
      </div>

      {/* Main split canvas */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left Side Content (JSON or TABLE) */}
        <div className="flex-1 min-h-0 flex flex-col bg-white">
          <div className="flex items-center justify-between px-6 py-2 bg-neutral-100 border-b border-neutral-300">
            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500">
              <Code className="w-3.5 h-3.5" />
              customer.json
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold text-neutral-400">
              <span>Lines: {rawJsonText.split('\n').length}</span>
              <span>UTF-8</span>
            </div>
          </div>

          {/* Conditional View Area */}
          <div className="flex-1 overflow-auto p-0 flex flex-col">
            {viewMode === 'json' ? (
              <div className="flex-1 flex min-h-0 relative">
                {/* Simulated line counts */}
                <div className="w-12 bg-neutral-50 border-r border-neutral-350 text-right pr-3 pt-4 text-neutral-400 font-mono text-xs select-none">
                  {rawJsonText.split('\n').map((_, index) => (
                    <div key={index} className="leading-6">{index + 1}</div>
                  ))}
                </div>
                {/* Live edit text area */}
                <textarea
                  className="flex-1 p-4 bg-white text-neutral-800 font-mono text-sm leading-6 outline-none focus:outline-none border-none resize-none ring-0 focus:ring-0 whitespace-pre"
                  value={rawJsonText}
                  onChange={handleJsonChange}
                  spellCheck="false"
                />
                
                {jsonError && (
                  <div className="absolute bottom-4 left-16 right-4 bg-red-50 text-red-700 text-xs py-2 px-3 border border-red-200 rounded flex items-center gap-2 font-mono">
                    <Info className="w-4 h-4 shrink-0" />
                    <span>{jsonError}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6">
                <table className="w-full border border-neutral-300 border-collapse rounded">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-300 text-xs font-semibold text-neutral-600">
                      <th className="px-4 py-2 text-left border-r border-neutral-300">Field Path</th>
                      <th className="px-4 py-2 text-left border-r border-neutral-300">Type</th>
                      <th className="px-4 py-2 text-left">Value</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs font-mono text-neutral-800 divide-y divide-neutral-250">
                    <tr className="hover:bg-neutral-50">
                      <td className="px-4 py-3 border-r border-neutral-300 text-primary font-bold">customer.id</td>
                      <td className="px-4 py-3 border-r border-neutral-300">
                        <span className="px-2 py-0.5 rounded bg-neutral-200 text-[10px] uppercase font-bold text-neutral-600">String</span>
                      </td>
                      <td className="px-4 py-2">
                        <input 
                          type="text" 
                          value={dataset.customer.id} 
                          onChange={(e) => updateField('id', e.target.value)}
                          className="w-full border-none p-0 focus:ring-0 text-xs font-bold font-mono outline-none text-neutral-900 bg-transparent"
                        />
                      </td>
                    </tr>
                    <tr className="hover:bg-neutral-50">
                      <td className="px-4 py-3 border-r border-neutral-300 text-primary font-bold">customer.age</td>
                      <td className="px-4 py-3 border-r border-neutral-300">
                        <span className="px-2 py-0.5 rounded bg-neutral-200 text-[10px] uppercase font-bold text-neutral-600">Number</span>
                      </td>
                      <td className="px-4 py-2">
                        <input 
                          type="number" 
                          value={dataset.customer.age} 
                          onChange={(e) => updateField('age', e.target.value)}
                          className="w-full border-none p-0 focus:ring-0 text-xs font-bold font-mono outline-none text-neutral-900 bg-transparent"
                        />
                      </td>
                    </tr>
                    <tr className="hover:bg-neutral-50">
                      <td className="px-4 py-3 border-r border-neutral-300 text-primary font-bold">customer.status</td>
                      <td className="px-4 py-3 border-r border-neutral-300">
                        <span className="px-2 py-0.5 rounded bg-neutral-200 text-[10px] uppercase font-bold text-neutral-600">Enum</span>
                      </td>
                      <td className="px-4 py-1.5">
                        <select 
                          value={dataset.customer.status} 
                          onChange={(e) => updateField('status', e.target.value)}
                          className="w-full border-none p-0 focus:ring-0 text-xs font-bold font-mono outline-none text-neutral-900 bg-transparent cursor-pointer"
                        >
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="INACTIVE">INACTIVE</option>
                          <option value="PENDING">PENDING</option>
                        </select>
                      </td>
                    </tr>
                    <tr className="hover:bg-neutral-50">
                      <td className="px-4 py-3 border-r border-neutral-300 text-primary font-bold">customer.tags</td>
                      <td className="px-4 py-3 border-r border-neutral-300">
                        <span className="px-2 py-0.5 rounded bg-neutral-200 text-[10px] uppercase font-bold text-neutral-600">Array</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-neutral-500">
                        {`[${dataset.customer.tags.map(t => `"${t}"`).join(', ')}]`}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div className="mt-4 flex justify-center">
                  <button 
                    type="button"
                    onClick={() => showToast("Add row form is loaded in sandbox namespace limits.")}
                    className="flex justify-center items-center gap-1.5 text-neutral-500 hover:text-primary transition-colors text-xs font-bold"
                  >
                    <PlusCircle className="w-4 h-4 text-neutral-400" />
                    Add New Data Row
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer Status Bar with mock metadata */}
          <div className="h-8 bg-neutral-100 border-t border-neutral-300 flex items-center px-6 justify-between shrink-0 font-sans text-[10px] text-neutral-500">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-fidelity-green-bright shrink-0"></span>
                <span className="font-bold text-neutral-600 uppercase tracking-wider">Validation Ready</span>
              </div>
              <div className="h-3 w-px bg-neutral-300"></div>
              <span>JSON Schema Match: <b className="text-fidelity-green-bright font-bold">100%</b></span>
            </div>
            <div className="flex items-center gap-4 font-semibold text-neutral-600">
              <span>Namespace: <b>customer</b></span>
              <span>Primary Key: <b className="text-primary">id</b></span>
              <span>Workspace: <b>sandbox-01</b></span>
            </div>
          </div>
        </div>

        {/* Right Side Inspector Panel */}
        <aside className="w-80 border-l border-neutral-300 bg-neutral-50 p-5 hidden xl:block overflow-y-auto">
          <h3 className="font-bold text-sm text-neutral-800 mb-4 uppercase tracking-tight">Schema Guide</h3>
          
          <button 
            type="button"
            onClick={() => showToast("Define Schema popup triggers schema field editor modal.")}
            className="w-full mb-4 flex items-center justify-between px-3 py-2 bg-neutral-100 border border-neutral-300 rounded text-xs font-bold text-neutral-600 hover:border-primary hover:text-primary transition-all"
          >
            <span className="flex items-center gap-1.5">
              <Edit3 className="w-4 h-4 text-neutral-400" />
              Define Schema &amp; PK
            </span>
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="space-y-4">
            <div className="p-4 rounded bg-white border border-neutral-300">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-primary font-mono">customer.status</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-250 uppercase font-bold text-neutral-600">Enum</span>
              </div>
              <p className="text-xs text-neutral-500 mb-2.5">
                Defines the current eligibility status of the customer record.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {['ACTIVE', 'INACTIVE', 'PROSPECT'].map((s) => (
                  <span key={s} className={`px-2 py-0.5 rounded text-[10px] font-mono border font-semibold ${dataset.customer.status === s ? 'bg-primary border-primary text-white' : 'bg-neutral-100 text-neutral-500 border-neutral-250'}`}>
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-4 rounded bg-white border border-neutral-300">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-primary font-mono">customer.age</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-250 uppercase font-bold text-neutral-600">Integer</span>
              </div>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Must be between 18 and 120. Used in validation Rule: <code className="bg-neutral-105 font-mono text-[10px] text-neutral-600 px-1 py-0.5 border border-neutral-200">Eligibility_V4.3</code>
              </p>
            </div>

            {/* Glowing AI Insights Widget Card */}
            <div className="relative mt-6 group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-fidelity-green-bright rounded-lg blur-xs opacity-25 group-hover:opacity-40 transition duration-300"></div>
              <div className="relative bg-white border border-neutral-250 p-4 rounded-lg">
                <div className="flex items-center gap-1.5 mb-2 text-primary font-bold text-xs uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse" />
                  <span>AI Insights</span>
                </div>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Based on your rule history, <span className="font-bold">"status": "INACTIVE"</span> with <span className="font-bold">"age" &lt; 30</span> triggers validation errors in the active Eligibility validation tree.
                </p>
                <div className="mt-3 pt-1">
                  <button 
                    type="button"
                    onClick={handleFixDataPattern}
                    className="w-full py-1.5 text-xs font-bold border border-primary text-primary rounded hover:bg-primary hover:text-white transition-all bg-transparent cursor-pointer"
                  >
                    Fix Data Pattern
                  </button>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
