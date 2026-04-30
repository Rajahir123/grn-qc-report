import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { 
  BarChart3, 
  Settings, 
  Layout, 
  Search, 
  Plus, 
  ChevronRight, 
  User, 
  Calendar, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  RefreshCw,
  MoreVertical,
  LogOut,
  Trello,
  Printer,
  Save,
  Trash2,
  FileText,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SKUS } from './lib/skus';

// --- Types ---

interface Column {
  id: string;
  title: string;
  type: string;
}

interface Item {
  id: string;
  name: string;
  column_values: {
    id: string;
    text: string;
    value: string;
    column: {
      id: string;
      title: string;
    };
  }[];
}

interface Board {
  id: string;
  name: string;
  description: string;
  items_page?: {
    items: Item[];
  };
  columns?: Column[];
}

interface QCRow {
  sku: string;
  billQty: number;
  received: number;
  notReceived: number;
  reject: number;
  damages: string;
  use: string;
  batchCode: string;
  mfgDate: string;
  expDate: string;
}

interface QCReport {
  qcNo: string;
  lrNo: string;
  date: string;
  boxQty: string;
  partyName: string;
  state: string;
  rows: QCRow[];
  approvedBy: string;
}

interface MondayContextType {
  token: string | null;
  setToken: (token: string | null) => void;
  boards: Board[];
  loading: boolean;
  error: string | null;
  fetchBoards: () => Promise<void>;
  selectedBoardId: string | null;
  setSelectedBoardId: (id: string | null) => void;
  boardData: Board | null;
  fetchBoardDetails: (id: string) => Promise<void>;
  submitReport: (report: QCReport) => Promise<void>;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  syncError: string | null;
  activeView: 'builder' | 'monitor';
  setActiveView: (view: 'builder' | 'monitor') => void;
}

const MondayContext = createContext<MondayContextType | undefined>(undefined);

// --- Provider ---

export function MondayProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('monday_token'));
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(localStorage.getItem('selected_board_id'));
  const [boardData, setBoardData] = useState<Board | null>(null);

  useEffect(() => {
    if (token) {
      localStorage.setItem('monday_token', token);
      fetchBoards();
    } else {
      localStorage.removeItem('monday_token');
      localStorage.removeItem('selected_board_id');
      setSelectedBoardId(null);
      setBoardData(null);
    }
  }, [token]);

  useEffect(() => {
    if (selectedBoardId) {
      localStorage.setItem('selected_board_id', selectedBoardId);
    }
  }, [selectedBoardId]);

  const fetchBoards = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/monday/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-monday-token': token },
        body: JSON.stringify({
          query: '{ boards (limit: 200) { id name description } }'
        })
      });
      const data = await response.json();
      if (data.errors) throw new Error(data.errors[0].message);
      setBoards(data.data.boards);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchBoardDetails = async (id: string) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/monday/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-monday-token': token },
        body: JSON.stringify({
          query: `
            query {
              boards (ids: [${id}]) {
                id
                name
                description
                columns { id title type }
                items_page (limit: 50) {
                  items {
                    id
                    name
                    column_values {
                      id
                      text
                      value
                      column { id title }
                    }
                  }
                }
              }
            }
          `
        })
      });
      const data = await response.json();
      if (data.errors) throw new Error(data.errors[0].message);
      setBoardData(data.data.boards[0]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'builder' | 'monitor'>('builder');

  const submitReport = async (report: QCReport) => {
    if (!token || !selectedBoardId) return;
    setSyncStatus('syncing');
    setSyncError(null);
    try {
      const itemName = `QC Report: ${report.qcNo} - ${report.partyName}`;
      const creationResponse = await fetch('/api/monday/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-monday-token': token },
        body: JSON.stringify({
          query: `
            mutation {
              create_item (board_id: ${selectedBoardId}, item_name: ${JSON.stringify(itemName)}) {
                id
              }
            }
          `
        })
      });
      
      const creationData = await creationResponse.json();
      
      if (creationData.errors) {
        throw new Error(creationData.errors.map((e: any) => e.message).join(', '));
      }
      
      if (!creationData.data?.create_item?.id) {
        throw new Error("Failed to create item. Check if the Board ID exists and your token has write access.");
      }
      
      const mainItemId = creationData.data.create_item.id;

      const tableMarkdown = `
# SALES RETURN QC REPORT (GRN)
**QC NO:** ${report.qcNo} | **LR NO:** ${report.lrNo}
**DATE:** ${report.date} | **BOX QTY:** ${report.boxQty}
**PARTY:** ${report.partyName} | **STATE:** ${report.state}

| SKU | BILL QTY | REC | NOT REC | REJ | DMG | USE | BATCH | MFG | EXP |
|---|---|---|---|---|---|---|---|---|---|
${report.rows.map(r => `| ${r.sku} | ${r.billQty} | ${r.received} | ${r.notReceived} | ${r.reject} | ${r.damages} | ${r.use} | ${r.batchCode} | ${r.mfgDate} | ${r.expDate} |`).join('\n')}

**APPROVE BY:** ${report.approvedBy}
      `;

      const updateResponse = await fetch('/api/monday/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-monday-token': token },
        body: JSON.stringify({
          query: `
            mutation {
              create_update (item_id: ${mainItemId}, body: ${JSON.stringify(tableMarkdown)}) {
                id
              }
            }
          `
        })
      });

      const updateData = await updateResponse.json();
      if (updateData.errors) {
        throw new Error("Item created, but failed to add details: " + updateData.errors[0].message);
      }

      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 5000);
    } catch (err: any) {
      setSyncStatus('error');
      setSyncError(err.message);
      console.error("Sync Error:", err);
    }
  };

  return (
    <MondayContext.Provider value={{ 
      token, setToken, boards, loading, error, fetchBoards, 
      selectedBoardId, setSelectedBoardId, boardData, fetchBoardDetails,
      submitReport,
      syncStatus,
      syncError,
      activeView,
      setActiveView
    }}>
      {children}
    </MondayContext.Provider>
  );
}

function useMonday() {
  const context = useContext(MondayContext);
  if (!context) throw new Error('useMonday must be used within MondayProvider');
  return context;
}

// --- Components ---

function TokenEntry() {
  const [inputToken, setInputToken] = useState('');
  const { setToken, loading, error } = useMonday();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputToken.trim()) setToken(inputToken.trim());
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-6 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white border border-[#141414] p-8 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]"
      >
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-[#141414] flex items-center justify-center">
            <Trello className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold uppercase tracking-tight">Monday Connect</h1>
            <p className="text-xs font-mono opacity-50 uppercase italic">v1.1.0 — System Init</p>
          </div>
        </div>

        <div className="mb-8 p-4 bg-[#F9F9F8] border-l-4 border-[#141414] space-y-2">
          <h3 className="text-[10px] font-bold uppercase tracking-widest">Configuration Guide</h3>
          <p className="text-xs leading-relaxed text-gray-600">
            To connect, you need your **Personal API Token**. Go to your Monday.com avatar → <span className="font-bold">Developers</span> → <span className="font-bold">My Tokens</span> to copy it.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="font-serif italic text-xs uppercase opacity-60 tracking-wider">Authentication Token</label>
            <div className="relative">
              <input 
                type="password"
                value={inputToken}
                onChange={(e) => setInputToken(e.target.value)}
                placeholder="Paste v2 token here..."
                className="w-full bg-[#f5f5f5] border border-[#141414] p-3 font-mono text-sm focus:outline-none focus:bg-white transition-colors pr-10"
                required
              />
              <Trello className="absolute right-3 top-1/2 -translate-y-1/2 opacity-20" size={16} />
            </div>
          </div>

          <div className="p-4 bg-gray-50 border border-dotted border-[#141414]/20 space-y-2">
            <span className="text-[9px] font-black uppercase block tracking-widest text-[#141414]">How to get your token:</span>
            <div className="text-[9px] font-mono leading-relaxed opacity-60">
              1. Monday.com &rarr; Profile (Top Right)<br/>
              2. Administration &rarr; API &rarr; Copy Personal Token
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-500 text-red-600 text-xs font-mono flex items-center gap-2">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-[#141414] text-white py-3 font-bold uppercase tracking-widest text-sm hover:invert transition-all disabled:opacity-50"
          >
            {loading ? 'Validating...' : 'Initialize Connection'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function SettingsModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { token, setToken } = useMonday();
  const [newToken, setNewToken] = useState(token || '');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#141414]/80 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white border border-[#141414] w-full max-w-lg overflow-hidden shadow-[12px_12px_0px_0px_rgba(0,0,0,0.5)]"
      >
        <div className="p-6 border-b border-[#141414] flex justify-between items-center bg-[#F9F9F8]">
          <h2 className="font-serif italic text-xl">Connection Settings</h2>
          <button onClick={onClose} className="p-1 hover:bg-[#141414]/10 transition-colors">
            <Plus size={20} className="rotate-45" />
          </button>
        </div>
        
        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest block">Update API Token</label>
            <p className="text-xs text-gray-500 mb-4">Enter a new monday.com API token to change the connected account.</p>
            <input 
              type="password"
              value={newToken}
              onChange={(e) => setNewToken(e.target.value)}
              className="w-full bg-[#f5f5f5] border border-[#141414] p-3 font-mono text-sm focus:outline-none"
              placeholder="Paste new token..."
            />
          </div>

          <div className="flex gap-4">
            <button 
              onClick={() => {
                setToken(newToken);
                onClose();
              }}
              className="flex-1 bg-[#141414] text-white py-3 font-bold uppercase tracking-widest text-xs hover:invert transition-all"
            >
              Save Changes
            </button>
            <button 
              onClick={onClose}
              className="flex-1 border border-[#141414] py-3 font-bold uppercase tracking-widest text-xs hover:bg-[#141414] hover:text-white transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Sidebar() {
  const { boards, setSelectedBoardId, selectedBoardId, setToken, activeView, setActiveView } = useMonday();
  const [searchTerm, setSearchTerm] = useState('');
  const [manualId, setManualId] = useState('');

  const filteredBoards = boards.filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleManualConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualId.trim()) {
      setSelectedBoardId(manualId.trim());
      setManualId('');
      setActiveView('builder');
    }
  };

  return (
    <div className="w-72 bg-[#E4E3E0] border-r border-[#141414] flex flex-col h-screen print:hidden">
      <div className="p-6 border-b border-[#141414] flex justify-between items-center bg-white/20">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-[#141414]" />
          <span className="font-black uppercase tracking-[0.2em] text-xs">GRN System</span>
        </div>
        <button 
          onClick={() => setToken(null)} 
          className="opacity-20 hover:opacity-100 transition-opacity"
        >
          <LogOut size={14} />
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-[#141414]">
        <button 
          onClick={() => setActiveView('builder')}
          className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest transition-all ${activeView === 'builder' ? 'bg-[#141414] text-white' : 'hover:bg-white'}`}
        >
          Form Builder
        </button>
        <button 
          onClick={() => setActiveView('monitor')}
          className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest transition-all ${activeView === 'monitor' ? 'bg-[#141414] text-white' : 'hover:bg-white'}`}
        >
          Live Monitor
        </button>
      </div>

      <div className="p-4 border-b border-[#141414]/10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" size={14} />
          <input 
            type="text"
            placeholder="Filter boards..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/50 border border-[#141414] py-2 pl-9 pr-4 text-xs focus:outline-none focus:bg-white transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="space-y-px">
          {filteredBoards.length > 0 ? (
            filteredBoards.map(board => (
              <button
                key={board.id}
                onClick={() => setSelectedBoardId(board.id)}
                className={`w-full flex items-center gap-3 px-6 py-4 text-left transition-all border-b border-[#141414]/10 group 
                  ${selectedBoardId === board.id ? 'bg-[#141414] text-white' : 'hover:bg-white/40'}`}
              >
                <Layout size={16} className={selectedBoardId === board.id ? 'text-white' : 'opacity-40'} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate uppercase tracking-tight">{board.name}</p>
                  <p className={`text-[10px] font-mono truncate opacity-40 ${selectedBoardId === board.id ? 'text-white/60' : ''}`}>
                    ID: {board.id}
                  </p>
                </div>
                <ChevronRight size={14} className={`opacity-0 group-hover:opacity-100 transition-all ${selectedBoardId === board.id ? 'text-white opacity-40' : ''}`} />
              </button>
            ))
          ) : (
            <div className="p-12 text-center">
              <p className="text-[10px] font-mono uppercase opacity-30">{searchTerm ? 'No matches' : 'No boards found'}</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="p-4 bg-[#DEDCD7] border-t border-[#141414] space-y-4">
        {/* Manual Connect */}
        <form onSubmit={handleManualConnect} className="relative">
          <input 
            type="text"
            placeholder="Direct Board ID..."
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            className="w-full bg-white/50 border border-[#141414] py-2 pl-3 pr-10 text-[10px] uppercase font-bold focus:outline-none focus:bg-white"
          />
          <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-[#141414]/10">
            <ExternalLink size={12} />
          </button>
        </form>
        <div className="px-1 text-[8px] font-mono opacity-40 leading-tight">
          Board ID is the number at the end of your browser URL<br/>
          (e.g., .../boards/<span className="text-black font-bold">5028054300</span>)
        </div>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-500 border border-[#141414] flex items-center justify-center">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#141414]/60">Connected</p>
            <p className="text-[10px] font-mono truncate text-[#141414]/40">Active Session</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function QCReportView() {
  const { submitReport, syncStatus, syncError, boardData } = useMonday();
  const [report, setReport] = useState<QCReport>({
    qcNo: 'QC-' + Math.floor(1000 + Math.random() * 9000),
    lrNo: '',
    date: new Date().toISOString().split('T')[0],
    boxQty: '',
    partyName: '',
    state: '',
    rows: [],
    approvedBy: 'Alpino / Yuvraj'
  });

  const [isSkuPickerOpen, setIsSkuPickerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const addSku = (sku: string) => {
    if (report.rows.some(r => r.sku === sku)) return;
    setReport({
      ...report,
      rows: [...report.rows, {
        sku,
        billQty: 0,
        received: 0,
        notReceived: 0,
        reject: 0,
        damages: '',
        use: '',
        batchCode: '',
        mfgDate: '',
        expDate: ''
      }]
    });
    setIsSkuPickerOpen(false);
  };

  const updateRow = (idx: number, updates: Partial<QCRow>) => {
    const newRows = [...report.rows];
    newRows[idx] = { ...newRows[idx], ...updates };
    setReport({ ...report, rows: newRows });
  };

  const removeRow = (idx: number) => {
    const newRows = report.rows.filter((_, i) => i !== idx);
    setReport({ ...report, rows: newRows });
  };

  const handlePrint = () => {
    try {
      window.print();
    } catch (e) {
      alert("Please open the application in a new tab to use the print feature.");
    }
  };

  return (
    <div className="flex-1 bg-[#F5F5F5] flex flex-col h-screen overflow-hidden font-sans print:block print:h-auto print:overflow-visible">
      {/* Action Header */}
      <div className="bg-white p-6 border-b border-[#141414] flex justify-between items-center z-10 shrink-0 print:hidden">
        <div className="flex items-center gap-6">
          <div className="px-4 py-2 bg-[#141414] text-white flex items-center gap-3">
            <FileText size={18} />
            <span className="font-black uppercase tracking-[0.2em] text-xs">QC Engine</span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-40 block">Board Context</span>
            <span className="text-xs font-black uppercase text-[#141414]">{boardData?.name || 'Local Mode'}</span>
          </div>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-6 py-3 border border-[#141414] font-bold uppercase tracking-widest text-[10px] hover:bg-gray-50 transition-all shadow-[6px_6px_0px_0px_rgba(0,0,0,0.1)] active:translate-x-1 active:translate-y-1 active:shadow-none"
          >
            <Printer size={14} /> Print Report
          </button>
          <button 
            onClick={() => submitReport(report)}
            disabled={syncStatus === 'syncing' || report.rows.length === 0}
            className={`flex items-center gap-2 px-8 py-3 font-black uppercase tracking-[0.2em] text-[10px] transition-all shadow-[6px_6px_0px_0px_rgba(0,0,0,0.2)] active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-50 ${
              syncStatus === 'success' ? 'bg-green-600 text-white' : 
              syncStatus === 'error' ? 'bg-red-600 text-white' : 
              'bg-[#141414] text-white hover:invert'
            }`}
          >
            <Save size={14} /> 
            {syncStatus === 'syncing' ? 'Syncing...' : 
             syncStatus === 'success' ? 'Synced!' : 
             syncStatus === 'error' ? 'Retry Sync' : 'Sync to Monday'}
          </button>
        </div>
      </div>

      {syncError && (
        <div className="bg-red-500 text-white px-6 py-2 text-[10px] font-bold uppercase tracking-widest flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} />
            <span>Sync Failed: {syncError}</span>
          </div>
          <button onClick={() => submitReport(report)} className="underline hover:no-underline">Try Again Now</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-12 custom-scrollbar bg-[#F5F5F5] print:p-0 print:bg-white flex flex-col items-center print:block print:overflow-visible">
        {/* Printable Report Layout */}
        <div className="w-full max-w-[1100px] bg-white border border-[#141414] shadow-2xl p-12 print:border-none print:shadow-none print:p-0">
          
          {/* Header Metadata */}
          <div className="grid grid-cols-4 border-2 border-[#141414] mb-8 divide-x-2 divide-[#141414]">
            <div className="p-3">
              <label className="text-[9px] font-bold uppercase block opacity-50 mb-1">QC.NO-</label>
              <input type="text" value={report.qcNo} onChange={e => setReport({...report, qcNo: e.target.value})} className="w-full font-mono text-sm focus:outline-none" />
            </div>
            <div className="p-3">
              <label className="text-[9px] font-bold uppercase block opacity-50 mb-1">LR NO-</label>
              <input type="text" value={report.lrNo} onChange={e => setReport({...report, lrNo: e.target.value})} className="w-full font-mono text-sm focus:outline-none" />
            </div>
            <div className="p-3">
              <label className="text-[9px] font-bold uppercase block opacity-50 mb-1">DATE-</label>
              <input type="date" value={report.date} onChange={e => setReport({...report, date: e.target.value})} className="w-full font-mono text-sm focus:outline-none" />
            </div>
            <div className="p-3">
              <label className="text-[9px] font-bold uppercase block opacity-50 mb-1">BOX QTY-</label>
              <input type="text" value={report.boxQty} onChange={e => setReport({...report, boxQty: e.target.value})} className="w-full font-mono text-sm focus:outline-none" />
            </div>
          </div>

          <div className="text-center py-6 mb-8 border-b-4 border-double border-[#141414]">
            <h1 className="text-3xl font-black uppercase tracking-[0.3em] inline-block">
              Sales Return QC Report (GRN)
            </h1>
          </div>

          <div className="grid grid-cols-4 border-2 border-[#141414] mb-6 divide-x-2 divide-[#141414]">
            <div className="col-span-3 p-4 flex items-center gap-4">
              <label className="text-[11px] font-bold uppercase whitespace-nowrap">Party Name:</label>
              <input type="text" value={report.partyName} onChange={e => setReport({...report, partyName: e.target.value})} className="w-full text-base font-semibold focus:outline-none" />
            </div>
            <div className="p-4 flex items-center gap-4">
              <label className="text-[11px] font-bold uppercase whitespace-nowrap">State:</label>
              <input type="text" value={report.state} onChange={e => setReport({...report, state: e.target.value})} className="w-full text-base font-semibold focus:outline-none" />
            </div>
          </div>

          {/* QC Table */}
          <div className="border-2 border-[#141414] overflow-hidden">
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="bg-gray-100 font-bold uppercase border-b-2 border-[#141414]">
                  <th rowSpan={2} className="border-r-2 border-[#141414] p-2 min-w-[120px]">SKU</th>
                  <th className="border-r border-[#141414] p-1">Bill Qty</th>
                  <th className="border-r border-[#141414] p-1">Received</th>
                  <th className="border-r border-[#141414] p-1">Not Received</th>
                  <th className="border-r border-[#141414] p-1">Reject(Expire)</th>
                  <th rowSpan={2} className="border-r border-[#141414] p-1">Damages</th>
                  <th rowSpan={2} className="border-r border-[#141414] p-1">Use</th>
                  <th rowSpan={2} className="border-r border-[#141414] p-1 min-w-[80px]">Batch Code</th>
                  <th className="border-r border-[#141414] p-1">MFG</th>
                  <th className="p-1">EXP</th>
                </tr>
                <tr className="bg-gray-100 text-[8px] border-b-2 border-[#141414]">
                  <th className="border-r border-[#141414] p-1 uppercase opacity-60">Unit</th>
                  <th className="border-r border-[#141414] p-1 uppercase opacity-60">Unit</th>
                  <th className="border-r border-[#141414] p-1 uppercase opacity-60">Unit</th>
                  <th className="border-r border-[#141414] p-1 uppercase opacity-60">Unit</th>
                  <th className="border-r border-[#141414] p-1 uppercase opacity-40">Date</th>
                  <th className="uppercase opacity-40">Date</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.length > 0 ? (
                  report.rows.map((row, idx) => (
                    <tr key={idx} className="border-b border-[#141414] hover:bg-black/5 group">
                      <td className="p-2 border-r-2 border-[#141414] font-bold uppercase relative">
                        {row.sku}
                        <button onClick={() => removeRow(idx)} className="absolute right-1 top-1/2 -translate-y-1/2 text-red-500 opacity-0 group-hover:opacity-100 print:hidden p-1">
                          <Trash2 size={12} />
                        </button>
                      </td>
                      <td className="border-r border-[#141414] p-0"><input type="number" value={row.billQty || ''} onChange={e => updateRow(idx, { billQty: parseInt(e.target.value) || 0 })} className="w-full p-2 text-center focus:outline-none" /></td>
                      <td className="border-r border-[#141414] p-0"><input type="number" value={row.received || ''} onChange={e => updateRow(idx, { received: parseInt(e.target.value) || 0 })} className="w-full p-2 text-center focus:outline-none" /></td>
                      <td className="border-r border-[#141414] p-0"><input type="number" value={row.notReceived || ''} onChange={e => updateRow(idx, { notReceived: parseInt(e.target.value) || 0 })} className="w-full p-2 text-center focus:outline-none" /></td>
                      <td className="border-r border-[#141414] p-0"><input type="number" value={row.reject || ''} onChange={e => updateRow(idx, { reject: parseInt(e.target.value) || 0 })} className="w-full p-2 text-center focus:outline-none" /></td>
                      <td className="border-r border-[#141414] p-0"><input type="text" value={row.damages} onChange={e => updateRow(idx, { damages: e.target.value })} className="w-full p-2 text-center focus:outline-none" /></td>
                      <td className="border-r border-[#141414] p-0"><input type="text" value={row.use} onChange={e => updateRow(idx, { use: e.target.value })} className="w-full p-2 text-center focus:outline-none" /></td>
                      <td className="border-r border-[#141414] p-0"><input type="text" value={row.batchCode} onChange={e => updateRow(idx, { batchCode: e.target.value })} className="w-full p-2 text-center font-mono focus:outline-none" /></td>
                      <td className="border-r border-[#141414] p-0"><input type="text" placeholder="MM/YY" value={row.mfgDate} onChange={e => updateRow(idx, { mfgDate: e.target.value })} className="w-full p-2 text-center text-[9px] focus:outline-none" /></td>
                      <td className="p-0"><input type="text" placeholder="MM/YY" value={row.expDate} onChange={e => updateRow(idx, { expDate: e.target.value })} className="w-full p-2 text-center text-[9px] focus:outline-none" /></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="p-12 text-center text-gray-400 italic font-serif">Add SKUs using the selector bottom right &rarr;</td>
                  </tr>
                )}
                {/* Visual padding rows */}
                {Array.from({ length: Math.max(0, 12 - report.rows.length) }).map((_, i) => (
                  <tr key={`empty-${i}`} className="h-10 border-b border-[#141414]/10">
                    <td className="border-r-2 border-[#141414]"></td>
                    <td className="border-r border-[#141414]"></td>
                    <td className="border-r border-[#141414]"></td>
                    <td className="border-r border-[#141414]"></td>
                    <td className="border-r border-[#141414]"></td>
                    <td className="border-r border-[#141414]"></td>
                    <td className="border-r border-[#141414]"></td>
                    <td className="border-r border-[#141414]"></td>
                    <td className="border-r border-[#141414]"></td>
                    <td></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 flex justify-between items-end border-t-2 border-[#141414] pt-8">
            <div className="flex border-2 border-[#141414] divide-x-2 divide-[#141414]">
              <div className="p-4 w-48 bg-gray-50 flex flex-col justify-between min-h-[80px]">
                <span className="text-[9px] font-bold uppercase opacity-50">Approve By</span>
                <span className="text-[9px] font-bold uppercase opacity-50">Signature</span>
              </div>
              <div className="p-4 w-64 flex flex-col justify-between min-h-[80px]">
                <input type="text" value={report.approvedBy} onChange={e => setReport({...report, approvedBy: e.target.value})} className="font-serif italic text-lg focus:outline-none" />
                <div className="border-t border-dotted border-[#141414]/20 pt-1 text-[10px] font-mono opacity-20">SYSTEM_SIGN_OFF</div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-mono opacity-20 uppercase tracking-[0.2em]">Sales Return GRN Module</p>
              <p className="text-[9px] font-mono opacity-10 uppercase tracking-tighter">Powered by Industrial QC System</p>
            </div>
          </div>
        </div>
      </div>

      {/* SKU Floating Picker */}
      <div className="fixed bottom-12 right-12 z-20 flex flex-col items-end gap-4 print:hidden">
        <AnimatePresence>
          {isSkuPickerOpen && (
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="bg-white border-2 border-[#141414] p-6 shadow-2xl w-80 max-h-[400px] flex flex-col"
            >
              <h3 className="text-xs font-black uppercase tracking-widest mb-4 flex items-center justify-between">
                Inventory Picker
                <X size={14} className="cursor-pointer" onClick={() => setIsSkuPickerOpen(false)} />
              </h3>
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                {SKUS.filter(s => !report.rows.some(r => r.sku === s)).map(sku => (
                  <button 
                    key={sku} 
                    onClick={() => addSku(sku)}
                    className="w-full p-2 border border-[#141414]/10 hover:border-[#141414] hover:bg-[#141414] hover:text-white text-[10px] uppercase font-bold text-left transition-all"
                  >
                    {sku}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <button 
          onClick={() => setIsSkuPickerOpen(!isSkuPickerOpen)}
          className="w-16 h-16 bg-[#141414] text-white flex items-center justify-center shadow-2xl hover:bg-black transition-all ring-offset-4 ring-[#141414] focus:ring-2"
        >
          <Plus size={32} className={`transition-transform duration-300 ${isSkuPickerOpen ? 'rotate-45' : ''}`} />
        </button>
      </div>
    </div>
  );
}


function renderValue(val: any, col: Column) {
  if (!val) return <span className="text-[10px] font-mono opacity-20">EMPTY</span>;

  // Simple rendering based on type
  if (col.type === 'status') {
    return (
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${val.text ? 'bg-blue-500' : 'bg-gray-200'}`} />
        <span className="text-xs font-mono uppercase">{val.text || 'N/A'}</span>
      </div>
    );
  }

  if (col.type === 'person') {
    return (
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 bg-[#141414] flex items-center justify-center text-[10px] text-white font-mono">
          {val.text ? val.text[0].toUpperCase() : '?'}
        </div>
        <span className="text-xs font-mono">{val.text || 'Unassigned'}</span>
      </div>
    );
  }

  return <span className="text-xs font-mono">{val.text || '-'}</span>;
}

// --- Main App ---

function AppContent() {
  const { token, selectedBoardId, loading, activeView } = useMonday();

  if (!token) {
    return <TokenEntry />;
  }

  return (
    <div className="flex h-screen bg-[#E4E3E0] font-sans text-[#141414] print:block print:h-auto">
      <Sidebar />
      {!selectedBoardId ? (
        <div className="flex-1 bg-white flex flex-col items-center justify-center p-12 text-center relative overflow-hidden">
          <div className="w-24 h-24 border-4 border-[#141414] flex items-center justify-center mb-8 mx-auto shadow-[12px_12px_0px_0px_rgba(0,0,0,0.05)]">
            <Layout size={40} className="opacity-20" />
          </div>
          <h2 className="font-serif italic text-3xl mb-4">QC System Standby</h2>
          <p className="text-sm font-mono uppercase tracking-[0.2em] opacity-40 max-w-xs leading-relaxed">
            Please select a target repository from the workspace sidebar to initialize the GRN QC reporting flow.
          </p>
        </div>
      ) : (
        activeView === 'builder' ? <QCReportView /> : <BoardLiveMonitor />
      )}
    </div>
  );
}

function BoardLiveMonitor() {
  const { selectedBoardId, boardData } = useMonday();
  
  // Use the user-provided embed code if it matches the current board ID
  const embedUrl = selectedBoardId === "5028054300" 
    ? "https://view.monday.com/embed/5028054300-cbb49652489fffc0fed23c233bdc54f9?r=apse2"
    : `https://view.monday.com/embed/${selectedBoardId}`;

  return (
    <div className="flex-1 bg-[#F5F5F5] flex flex-col h-screen overflow-hidden print:hidden">
      <div className="bg-white p-6 border-b border-[#141414] flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-green-500 text-white flex items-center justify-center rounded shadow-lg">
            <BarChart3 size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest">{boardData?.name || 'Monday Board'}</h2>
            <p className="text-[10px] font-mono opacity-40 uppercase">Live Synchronization View</p>
          </div>
        </div>
      </div>
      <div className="flex-1 p-8">
        <div className="w-full h-full bg-white border-2 border-[#141414] shadow-[12px_12px_0px_0px_rgba(0,0,0,0.1)] overflow-hidden">
          <iframe 
            src={embedUrl}
            width="100%" 
            height="100%" 
            style={{ border: 0 }}
            title="Monday Board Monitor"
          />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <MondayProvider>
      <AppContent />
    </MondayProvider>
  );
}
