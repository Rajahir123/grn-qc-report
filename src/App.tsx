import React, { useState, useEffect, createContext, useContext, useRef, useMemo } from 'react';
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
  X,
  Menu,
  Share2,
  Database,
  Check,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SKUS, type SKUMapping } from './lib/skus';

import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { format, parse, isBefore, isValid } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

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
  oldSku: string;
  newSku: string;
  billQtyUnit: number;
  receivedUnit: number;
  notReceivedUnit: number;
  expiredUnit: number;
  damagesRepairable: number;
  rejectNonRepairable: number;
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
  activeView: 'builder' | 'monitor' | 'dashboard';
  setActiveView: (view: 'builder' | 'monitor' | 'dashboard') => void;
  customEmbedUrls: Record<string, string>;
  setCustomEmbedUrl: (boardId: string, url: string) => void;
  logout: () => void;
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
  const [customEmbedUrls, setCustomEmbedUrls] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('custom_embed_urls') || '{}');
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('custom_embed_urls', JSON.stringify(customEmbedUrls));
  }, [customEmbedUrls]);

  useEffect(() => {
    if (token) {
      localStorage.setItem('monday_token', token);
      fetchBoards().catch(console.error);
    } else {
      localStorage.removeItem('monday_token');
      localStorage.removeItem('selected_board_id');
      setSelectedBoardId(null);
      setBoardData(null);
    }
  }, [token]);

  useEffect(() => {
    if (selectedBoardId && token) {
      localStorage.setItem('selected_board_id', selectedBoardId);
      fetchBoardDetails(selectedBoardId).catch(console.error);
    }
  }, [selectedBoardId, token]);

  const fetchBoards = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/monday/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-monday-token': token },
        body: JSON.stringify({
          query: '{ boards (limit: 500) { id name description } }'
        })
      });
      const data = await response.json();
      if (data.errors) throw new Error(data.errors[0].message);
      setBoards(data.data.boards || []);
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
  const [activeView, setActiveView] = useState<'builder' | 'monitor' | 'dashboard'>('builder');

  const logout = () => {
    setToken(null);
    setSelectedBoardId(null);
    setBoardData(null);
    localStorage.removeItem('monday_token');
    localStorage.removeItem('selected_board_id');
    localStorage.removeItem('custom_embed_urls');
    setActiveView('builder');
  };

  const submitReport = async (report: QCReport) => {
    if (!token || !selectedBoardId) return;
    setSyncStatus('syncing');
    setSyncError(null);
    try {
      const itemName = `${report.qcNo} | ${report.partyName} | ${report.state}`;
      const creationResponse = await fetch('/api/monday/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-monday-token': token },
        body: JSON.stringify({
          query: `
            mutation {
              create_item (board_id: "${selectedBoardId}", item_name: ${JSON.stringify(itemName)}) {
                id
              }
            }
          `
        })
      });
      
      if (!creationResponse.ok) {
        let errorMessage = `Creation failed (${creationResponse.status})`;
        try {
          const errorData = await creationResponse.json();
          if (errorData.error) errorMessage = errorData.error;
        } catch (e) {
          const text = await creationResponse.text();
          if (text) errorMessage += `: ${text.substring(0, 100)}`;
        }
        throw new Error(errorMessage);
      }

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

| OLD SKU | NEW SKU | BILL QTY | RECEIVED | EXPIRED | NOT RECEIVED | DMG (R) | REJ (NR) | USE | BATCH | MFG | EXP |
|---|---|---|---|---|---|---|---|---|---|---|---|
${report.rows.map(r => `| ${r.oldSku} | ${r.newSku} | ${r.billQtyUnit} | ${r.receivedUnit} | ${r.expiredUnit} | ${r.notReceivedUnit} | ${r.damagesRepairable} | ${r.rejectNonRepairable} | ${r.use} | ${r.batchCode} | ${r.mfgDate} | ${r.expDate} |`).join('\n')}

**APPROVE BY:** ${report.approvedBy}
      `;

      const updateResponse = await fetch('/api/monday/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-monday-token': token },
        body: JSON.stringify({
          query: `
            mutation {
              create_update (item_id: "${mainItemId}", body: ${JSON.stringify(tableMarkdown)}) {
                id
              }
            }
          `
        })
      });

      if (!updateResponse.ok) {
        let errorMessage = `Update failed (${updateResponse.status})`;
        try {
          const errorData = await updateResponse.json();
          if (errorData.error) errorMessage = errorData.error;
        } catch (e) {
          const text = await updateResponse.text();
          if (text) errorMessage += `: ${text.substring(0, 100)}`;
        }
        throw new Error(errorMessage);
      }

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
      setActiveView,
      customEmbedUrls,
      setCustomEmbedUrl: (boardId, url) => setCustomEmbedUrls(prev => ({ ...prev, [boardId]: url })),
      logout
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

function MondaySetup() {
  const [inputToken, setInputToken] = useState(localStorage.getItem('monday_token') || '');
  const [inputBoardId, setInputBoardId] = useState(localStorage.getItem('selected_board_id') || '');
  const { setToken, setSelectedBoardId, loading, error } = useMonday();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputToken.trim() && inputBoardId.trim()) {
      let bId = inputBoardId.trim();
      const urlMatch = bId.match(/boards\/(\d+)/);
      if (urlMatch) bId = urlMatch[1];
      
      setToken(inputToken.trim());
      setSelectedBoardId(bId);
    }
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-6 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white border-2 border-[#141414] p-8 shadow-[12px_12px_0px_0px_rgba(20,20,20,1)]"
      >
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-[#141414] flex items-center justify-center">
            <Database className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter">QC Portal Link</h1>
            <p className="text-[10px] font-bold opacity-40 uppercase italic tracking-widest">Monday.com &times; Direct Access</p>
          </div>
        </div>

        <div className="mb-8 p-4 bg-red-600 text-white space-y-2 shadow-[4px_4px_0px_0px_rgba(153,27,27,1)]">
          <h3 className="text-[10px] font-black uppercase tracking-widest">Admin Authorization</h3>
          <p className="text-[10px] leading-relaxed font-medium opacity-90">
            Authentication requires a **Personal API Token v2**. Ensure your token has permission to write updates and items.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest opacity-60">Admin API Key</label>
              <input 
                type="password"
                value={inputToken}
                onChange={(e) => setInputToken(e.target.value)}
                placeholder="Paste API v2 token..."
                className="w-full bg-[#f5f5f5] border-2 border-[#141414] p-4 font-mono text-sm focus:outline-none focus:bg-white transition-all"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest opacity-60">Target Board ID</label>
              <input 
                type="text"
                value={inputBoardId}
                onChange={(e) => setInputBoardId(e.target.value)}
                placeholder="Enter Numeric Board ID or URL..."
                className="w-full bg-[#f5f5f5] border-2 border-[#141414] p-4 font-mono text-sm focus:outline-none focus:bg-white transition-all uppercase"
                required
              />
            </div>
          </div>

          <div className="p-4 bg-gray-50 border border-dotted border-[#141414]/40 space-y-3">
             <div className="flex items-start gap-2">
                <div className="w-4 h-4 bg-green-500 flex-shrink-0 mt-0.5" />
                <p className="text-[9px] font-bold leading-tight opacity-70">
                  <span className="text-[#141414]">TOKEN:</span> Profile &rarr; Admin &rarr; API &rarr; Copy Personal Token
                </p>
             </div>
             <div className="flex items-start gap-2">
                <div className="w-4 h-4 bg-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-[9px] font-bold leading-tight opacity-70">
                  <span className="text-[#141414]">BOARD:</span> Open your board and copy the number in the URL
                </p>
             </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border-2 border-red-600 text-red-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-3">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-[#141414] text-white py-4 font-black uppercase tracking-widest text-xs hover:invert transition-all shadow-[6px_6px_0px_0px_rgba(31,31,31,0.4)] active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-50"
          >
            {loading ? 'Validating Connection...' : 'Establish System Link'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function Sidebar({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { boards, setSelectedBoardId, selectedBoardId, logout, activeView, setActiveView } = useMonday();
  const [searchTerm, setSearchTerm] = useState('');
  const [manualId, setManualId] = useState('');

  const filteredBoards = boards.filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleManualConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualId.trim()) {
      let id = manualId.trim();
      // Extract numeric ID from board URL if pasted
      const urlMatch = id.match(/boards\/(\d+)/);
      if (urlMatch) id = urlMatch[1];
      
      setSelectedBoardId(id);
      setManualId('');
      setActiveView('builder');
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop for mobile */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-[60] lg:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <div className={`
        fixed inset-y-0 left-0 z-[70] transition-transform duration-300 transform lg:relative lg:translate-x-0 lg:inset-auto
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        w-80 h-full bg-[#E4E3E0] border-r border-[#141414] flex flex-col print:hidden
      `}>
        <div className="p-6 border-b border-[#141414] flex justify-between items-center bg-white/20">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-[#141414]" />
            <span className="font-black uppercase tracking-[0.2em] text-xs">GRN System</span>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={logout} 
              className="opacity-20 hover:opacity-100 transition-opacity p-2 hover:bg-[#141414] hover:text-white rounded"
              title="Switch Account & Reset"
            >
              <LogOut size={16} />
            </button>
            <button onClick={onClose} className="lg:hidden p-2 opacity-50 hover:opacity-100">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#141414]">
          <button 
            onClick={() => { setActiveView('builder'); onClose(); }}
            className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest transition-all ${activeView === 'builder' ? 'bg-[#141414] text-white' : 'hover:bg-white'}`}
          >
            Builder
          </button>
          <button 
            onClick={() => { setActiveView('monitor'); onClose(); }}
            className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest transition-all ${activeView === 'monitor' ? 'bg-[#141414] text-white' : 'hover:bg-white'}`}
          >
            Monitor
          </button>
          <button 
            onClick={() => { setActiveView('dashboard'); onClose(); }}
            className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest transition-all ${activeView === 'dashboard' ? 'bg-[#141414] text-white' : 'hover:bg-white'}`}
          >
            Analytics
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
                  onClick={() => { setSelectedBoardId(board.id); onClose(); }}
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
          
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full border border-[#141414] flex items-center justify-center transition-colors ${selectedBoardId ? 'bg-green-500' : 'bg-red-500'}`}>
              <div className={`w-3 h-3 bg-white rounded-full ${selectedBoardId ? 'animate-pulse' : ''}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#141414]/60">
                {selectedBoardId ? 'Connected' : 'Disconnected'}
              </p>
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-mono truncate text-[#141414]/40">
                  {selectedBoardId ? `ID: ${selectedBoardId}` : 'Select a board'}
                </p>
                {selectedBoardId && (
                  <a 
                    href={`https://monday.com/boards/${selectedBoardId}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-[#141414] hover:text-red-600"
                    title="Open Board in Monday"
                  >
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function QCReportView() {
  const { submitReport, syncStatus, syncError, boardData, logout } = useMonday();
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

  const addSku = (skuMapping: SKUMapping) => {
    setReport({
      ...report,
      rows: [...report.rows, {
        oldSku: skuMapping.oldSku,
        newSku: skuMapping.newSku,
        billQtyUnit: 0,
        receivedUnit: 0,
        notReceivedUnit: 0,
        expiredUnit: 0,
        damagesRepairable: 0,
        rejectNonRepairable: 0,
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
      <div className="bg-white p-4 lg:p-6 border-b border-[#141414] flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 z-10 shrink-0 print:hidden">
        <div className="flex items-center gap-4 lg:gap-6">
          <div className="px-3 lg:px-4 py-2 bg-[#141414] text-white flex items-center gap-2 lg:gap-3">
            <FileText size={16} />
            <span className="font-black uppercase tracking-[0.2em] text-[10px] lg:text-xs">QC Engine</span>
          </div>
          <div>
            <span className="text-[9px] font-bold uppercase tracking-widest opacity-40 block">Board Context</span>
            <span className="text-[10px] lg:text-xs font-black uppercase text-[#141414] truncate max-w-[150px] block">{boardData?.name || 'Local Mode'}</span>
          </div>
        </div>
        <div className="flex gap-3 lg:gap-4">
          <button 
            onClick={handlePrint}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 lg:px-6 py-2.5 lg:py-3 border border-[#141414] font-bold uppercase tracking-widest text-[9px] lg:text-[10px] hover:bg-gray-50 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] active:translate-x-1 active:translate-y-1 active:shadow-none"
          >
            <Printer size={12} /> <span className="hidden sm:inline">Print Report</span><span className="sm:hidden">Print</span>
          </button>
          <button 
            onClick={() => submitReport(report)}
            disabled={syncStatus === 'syncing' || report.rows.length === 0}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 lg:px-8 py-2.5 lg:py-3 font-black uppercase tracking-[0.2em] text-[9px] lg:text-[10px] transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-50 ${
              syncStatus === 'success' ? 'bg-green-600 text-white' : 
              syncStatus === 'error' ? 'bg-red-600 text-white' : 
              'bg-[#141414] text-white hover:invert'
            }`}
          >
            <Save size={12} /> 
            {syncStatus === 'syncing' ? 'Syncing...' : 
             syncStatus === 'success' ? 'Synced to Monday' : 
             syncStatus === 'error' ? 'Retry Sync' : 'Sync to Monday'}
          </button>
          
          <button 
            onClick={logout}
            className="flex items-center justify-center p-2 bg-gray-100 border border-[#141414] hover:bg-gray-200 transition-all text-red-600"
            title="Reset Connection"
          >
            <LogOut size={16} />
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

      <div className="flex-1 p-4 lg:p-8 print:p-0 overflow-y-auto custom-scrollbar">
        <div className="w-full max-w-5xl mx-auto bg-white border-2 border-[#141414] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] lg:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] p-4 lg:p-12 print:border-none print:shadow-none print:p-0">
          
          {/* Header Metadata */}
          <div className="grid grid-cols-2 md:grid-cols-4 border-2 border-[#141414] mb-4 lg:mb-8 divide-x-2 divide-y-2 md:divide-y-0 divide-[#141414]">
            <div className="p-2 lg:p-3">
              <label className="text-[8px] lg:text-[9px] font-bold uppercase block opacity-50 lg:mb-1">QC.NO-</label>
              <input type="text" value={report.qcNo} onChange={e => setReport({...report, qcNo: e.target.value})} className="w-full font-mono text-xs lg:text-sm focus:outline-none" />
            </div>
            <div className="p-2 lg:p-3">
              <label className="text-[8px] lg:text-[9px] font-bold uppercase block opacity-50 lg:mb-1">LR NO-</label>
              <input type="text" value={report.lrNo} onChange={e => setReport({...report, lrNo: e.target.value})} className="w-full font-mono text-xs lg:text-sm focus:outline-none" />
            </div>
            <div className="p-2 lg:p-3 border-t-2 md:border-t-0">
              <label className="text-[8px] lg:text-[9px] font-bold uppercase block opacity-50 lg:mb-1">DATE-</label>
              <input type="date" value={report.date} onChange={e => setReport({...report, date: e.target.value})} className="w-full font-mono text-xs lg:text-sm focus:outline-none" />
            </div>
            <div className="p-2 lg:p-3 border-t-2 md:border-t-0">
              <label className="text-[8px] lg:text-[9px] font-bold uppercase block opacity-50 lg:mb-1">BOX QTY-</label>
              <input type="text" value={report.boxQty} onChange={e => setReport({...report, boxQty: e.target.value})} className="w-full font-mono text-xs lg:text-sm focus:outline-none" />
            </div>
          </div>

          <div className="text-center py-4 lg:py-6 mb-6 lg:mb-8 border-b-4 border-double border-[#141414]">
            <h1 className="text-xl lg:text-3xl font-black uppercase tracking-[0.2em] lg:tracking-[0.3em] inline-block">
              Sales Return QC Report (GRN)
            </h1>
          </div>

          <div className="flex flex-col md:grid md:grid-cols-4 border-2 border-[#141414] mb-6 divide-y-2 md:divide-y-0 md:divide-x-2 divide-[#141414]">
            <div className="md:col-span-3 p-3 lg:p-4 flex items-center gap-3 lg:gap-4">
              <label className="text-[10px] lg:text-[11px] font-bold uppercase whitespace-nowrap">Party Name:</label>
              <input type="text" value={report.partyName} onChange={e => setReport({...report, partyName: e.target.value})} className="w-full text-sm lg:text-base font-semibold focus:outline-none" />
            </div>
            <div className="p-3 lg:p-4 flex items-center gap-3 lg:gap-4">
              <label className="text-[10px] lg:text-[11px] font-bold uppercase whitespace-nowrap">State:</label>
              <input type="text" value={report.state} onChange={e => setReport({...report, state: e.target.value})} className="w-full text-sm lg:text-base font-semibold focus:outline-none" />
            </div>
          </div>

          {/* QC Table */}
          <div className="border-2 border-[#141414] overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse text-[9px] lg:text-[10px] min-w-[800px]">
              <thead>
                <tr className="bg-gray-100 font-bold uppercase border-b-2 border-[#141414]">
                  <th rowSpan={2} className="border-r-2 border-[#141414] p-2 min-w-[80px]">Old SKU</th>
                  <th rowSpan={2} className="border-r-2 border-[#141414] p-2 min-w-[100px]">New SKU</th>
                  <th className="border-r border-[#141414] p-1">Bill Qty</th>
                  <th className="border-r border-[#141414] p-1">Received</th>
                  <th className="border-r border-[#141414] p-1 text-orange-600">Expired</th>
                  <th className="border-r border-[#141414] p-1">Not Received</th>
                  <th colSpan={2} className="border-r border-[#141414] p-1">Status</th>
                  <th rowSpan={2} className="border-r border-[#141414] p-1">Use</th>
                  <th rowSpan={2} className="border-r border-[#141414] p-1 min-w-[80px]">Batch Code</th>
                  <th className="border-r border-[#141414] p-1">MFG</th>
                  <th className="p-1">EXP</th>
                </tr>
                <tr className="bg-gray-100 text-[8px] border-b-2 border-[#141414]">
                  <th className="border-r border-[#141414] p-1 uppercase opacity-60">Unit</th>
                  <th className="border-r border-[#141414] p-1 uppercase opacity-60 bg-orange-50/50">Unit</th>
                  <th className="border-r border-[#141414] p-1 uppercase opacity-60">Unit</th>
                  <th className="border-r border-[#141414] p-1 uppercase opacity-60">Unit</th>
                  <th className="border-r border-[#141414] p-1 uppercase opacity-60 bg-green-50/50">Repairable</th>
                  <th className="border-r border-[#141414] p-1 uppercase opacity-60 bg-red-50/50">Non Repairable</th>
                  <th className="border-r border-[#141414] p-1 uppercase opacity-40">Date</th>
                  <th className="uppercase opacity-40">Date</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.length > 0 ? (
                  report.rows.map((row, idx) => (
                    <tr key={idx} className="border-b border-[#141414] hover:bg-black/5 group">
                      <td className="p-2 border-r-2 border-[#141414] font-bold uppercase relative bg-gray-50/30">
                        {row.oldSku}
                        <button onClick={() => removeRow(idx)} className="absolute right-1 top-1/2 -translate-y-1/2 text-red-500 opacity-0 group-hover:opacity-100 print:hidden p-1">
                          <Trash2 size={12} />
                        </button>
                      </td>
                      <td className="border-r-2 border-[#141414] font-mono text-[9px] uppercase">{row.newSku}</td>
                      <td className="border-r border-[#141414] p-0"><input type="number" value={row.billQtyUnit || ''} onChange={e => updateRow(idx, { billQtyUnit: parseInt(e.target.value) || 0 })} className="w-full p-2 text-center focus:outline-none" /></td>
                      <td className="border-r border-[#141414] p-0"><input type="number" value={row.receivedUnit || ''} onChange={e => updateRow(idx, { receivedUnit: parseInt(e.target.value) || 0 })} className="w-full p-2 text-center focus:outline-none" /></td>
                      <td className="border-r border-[#141414] p-0 bg-orange-50/20"><input type="number" value={row.expiredUnit || ''} onChange={e => updateRow(idx, { expiredUnit: parseInt(e.target.value) || 0 })} className="w-full p-2 text-center focus:outline-none bg-transparent font-bold text-orange-700" /></td>
                      <td className="border-r border-[#141414] p-0"><input type="number" value={row.notReceivedUnit || ''} onChange={e => updateRow(idx, { notReceivedUnit: parseInt(e.target.value) || 0 })} className="w-full p-2 text-center focus:outline-none" /></td>
                      <td className="border-r border-[#141414] p-0 bg-green-50/20"><input type="number" value={row.damagesRepairable || ''} onChange={e => updateRow(idx, { damagesRepairable: parseInt(e.target.value) || 0 })} className="w-full p-2 text-center focus:outline-none bg-transparent" /></td>
                      <td className="border-r border-[#141414] p-0 bg-red-50/20"><input type="number" value={row.rejectNonRepairable || ''} onChange={e => updateRow(idx, { rejectNonRepairable: parseInt(e.target.value) || 0 })} className="w-full p-2 text-center focus:outline-none bg-transparent" /></td>
                      <td className="border-r border-[#141414] p-0"><input type="text" value={row.use} onChange={e => updateRow(idx, { use: e.target.value })} className="w-full p-2 text-center focus:outline-none uppercase" /></td>
                      <td className="border-r border-[#141414] p-0"><input type="text" value={row.batchCode} onChange={e => updateRow(idx, { batchCode: e.target.value })} className="w-full p-2 text-center font-mono focus:outline-none uppercase" /></td>
                      <td className="border-r border-[#141414] p-0"><input type="text" placeholder="MM/YY" value={row.mfgDate} onChange={e => updateRow(idx, { mfgDate: e.target.value })} className="w-full p-2 text-center text-[9px] focus:outline-none" /></td>
                      <td className="p-0"><input type="text" placeholder="MM/YY" value={row.expDate} onChange={e => updateRow(idx, { expDate: e.target.value })} className="w-full p-2 text-center text-[9px] focus:outline-none" /></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={12} className="p-12 text-center text-gray-400 italic font-serif">Add SKUs using the selector bottom right &rarr;</td>
                  </tr>
                )}
                {/* Visual padding rows */}
                {Array.from({ length: Math.max(0, 10 - report.rows.length) }).map((_, i) => (
                  <tr key={`empty-${i}`} className="h-10 border-b border-[#141414]/10">
                    <td className="border-r-2 border-[#141414]"></td>
                    <td className="border-r-2 border-[#141414]"></td>
                    <td className="border-r border-[#141414]"></td>
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

          <div className="mt-8 flex flex-col sm:flex-row justify-between items-stretch sm:items-end border-t-2 border-[#141414] pt-8 gap-6">
            <div className="flex border-2 border-[#141414] divide-x-2 divide-[#141414]">
              <div className="p-3 lg:p-4 w-32 lg:w-48 bg-gray-50 flex flex-col justify-between min-h-[70px] lg:min-h-[80px]">
                <span className="text-[8px] lg:text-[9px] font-bold uppercase opacity-50">Approve By</span>
                <span className="text-[8px] lg:text-[9px] font-bold uppercase opacity-50">Signature</span>
              </div>
              <div className="p-3 lg:p-4 flex-1 sm:w-64 flex flex-col justify-between min-h-[70px] lg:min-h-[80px]">
                <input type="text" value={report.approvedBy} onChange={e => setReport({...report, approvedBy: e.target.value})} className="font-serif italic text-base lg:text-lg focus:outline-none w-full" />
                <div className="border-t border-dotted border-[#141414]/20 pt-1 text-[8px] lg:text-[10px] font-mono opacity-20">SYSTEM_SIGN_OFF</div>
              </div>
            </div>
            <div className="text-right sm:text-right">
              <p className="text-[8px] lg:text-[10px] font-mono opacity-20 uppercase tracking-[0.2em]">Sales Return GRN Module</p>
              <p className="text-[7px] lg:text-[9px] font-mono opacity-10 uppercase tracking-tighter">Powered by Industrial QC System</p>
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
                {SKUS.map(sku => (
                  <button 
                    key={sku.oldSku} 
                    onClick={() => addSku(sku)}
                    className="w-full p-3 border border-[#141414]/10 hover:border-[#141414] hover:bg-[#141414] hover:text-white group transition-all"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-tight">{sku.oldSku}</span>
                      <ChevronRight size={12} className="opacity-0 group-hover:opacity-100" />
                      <span className="text-[9px] font-mono opacity-40 group-hover:opacity-60">{sku.newSku}</span>
                    </div>
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!token || !selectedBoardId) {
    return <MondaySetup />;
  }

  return (
    <div className="flex h-screen bg-[#E4E3E0] font-sans text-[#141414] print:block print:h-auto overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden bg-[#141414] text-white p-4 flex items-center justify-between sticky top-0 z-50">
          <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-white/10 rounded transition-colors">
            <Menu size={20} />
          </button>
          <span className="font-black uppercase tracking-[0.2em] text-[10px]">GRN System</span>
          <div className="w-8 h-8" /> {/* Spacer */}
        </header>

        {!selectedBoardId ? (
          <div className="flex-1 bg-white flex flex-col items-center justify-center p-8 lg:p-12 text-center relative overflow-hidden">
            <div className="w-20 h-20 lg:w-24 lg:h-24 border-4 border-[#141414] flex items-center justify-center mb-8 mx-auto shadow-[12px_12px_0px_0px_rgba(0,0,0,0.05)]">
              <Layout size={32} className="opacity-20 lg:size-[40]" />
            </div>
            <h2 className="font-serif italic text-2xl lg:text-3xl mb-4">QC System Standby</h2>
            <p className="text-[9px] lg:text-sm font-mono uppercase tracking-[0.2em] opacity-40 max-w-xs leading-relaxed">
              Please select a target repository from the workspace sidebar to initialize the GRN QC reporting flow.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            {activeView === 'builder' ? (
              <QCReportView />
            ) : activeView === 'monitor' ? (
              <BoardLiveMonitor />
            ) : (
              <Dashboard />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Dashboard() {
  const { boardData, token, selectedBoardId } = useMonday();
  const [analyticsData, setAnalyticsData] = useState<QCReport[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedQc, setSelectedQc] = useState<QCReport | null>(null);

  const fetchDetailedData = async () => {
    if (!token || !selectedBoardId) return;
    setIsDataLoading(true);
    try {
      const response = await fetch('/api/monday/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-monday-token': token },
        body: JSON.stringify({
          query: `
            query {
              boards (ids: [${selectedBoardId}]) {
                items_page (limit: 500) {
                  items {
                    id
                    name
                    updates (limit: 1) {
                      body
                    }
                  }
                }
              }
            }
          `
        })
      });
      const result = await response.json();
      const items = result.data.boards[0]?.items_page?.items || [];
      
      const parsedReports: QCReport[] = items.map((item: any) => {
        const updateBody = item.updates[0]?.body || '';
        const rows: QCRow[] = [];
        const lines = updateBody.split('\n');
        
        const qcNoMatch = updateBody.match(/\*\*QC NO:\*\*\s*(QC-\d+)/);
        const partyMatch = updateBody.match(/\*\*PARTY:\*\*\s*([^\n|]+)/);
        const stateMatch = updateBody.match(/\*\*STATE:\*\*\s*([^\n|]+)/);
        const dateMatch = updateBody.match(/\*\*DATE:\*\*\s*(\d{4}-\d{2}-\d{2})/);
        const boxMatch = updateBody.match(/\*\*BOX QTY:\*\*\s*(\d+)/);
        const lrMatch = updateBody.match(/\*\*LR NO:\*\*\s*([^\n|]+)/);

        lines.forEach((line: string) => {
          const parts = line.split('|').map(s => s.trim());
          if (parts.length >= 13 && parts[1] !== 'OLD SKU' && !parts[1].includes('---')) {
            rows.push({
              oldSku: parts[1],
              newSku: parts[2],
              billQtyUnit: parseFloat(parts[3]) || 0,
              receivedUnit: parseFloat(parts[4]) || 0,
              expiredUnit: parseFloat(parts[5]) || 0,
              notReceivedUnit: parseFloat(parts[6]) || 0,
              damagesRepairable: parseFloat(parts[7]) || 0,
              rejectNonRepairable: parseFloat(parts[8]) || 0,
              use: parts[9],
              batchCode: parts[10],
              mfgDate: parts[11],
              expDate: parts[12]
            });
          }
        });

        return {
          qcNo: qcNoMatch?.[1]?.trim() || item.name || 'Unknown',
          partyName: partyMatch?.[1]?.trim() || 'Unknown',
          state: stateMatch?.[1]?.trim() || 'Unknown',
          date: dateMatch?.[1] || '',
          rows,
          approvedBy: '',
          lrNo: lrMatch?.[1]?.trim() || '',
          boxQty: boxMatch?.[1] || ''
        };
      }).filter((r: QCReport) => r.rows.length > 0);

      setAnalyticsData(parsedReports);
      setLastSyncTime(new Date());
    } catch (err) {
      console.error("Dashboard Fetch Error:", err);
    } finally {
      setIsDataLoading(false);
    }
  };

  useEffect(() => {
    fetchDetailedData();
  }, [selectedBoardId]);

  const istNow = toZonedTime(new Date(), 'Asia/Kolkata');
  
  const filteredReports = useMemo(() => {
    if (!searchQuery) return analyticsData;
    return analyticsData.filter(r => 
      r.qcNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.partyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.state.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [analyticsData, searchQuery]);

  const skuRtvStats = useMemo(() => {
    const stats: Record<string, number> = {};
    analyticsData.forEach(report => {
      report.rows.forEach(row => {
        if (!stats[row.newSku]) stats[row.newSku] = 0;
        stats[row.newSku] += (row.notReceivedUnit + row.rejectNonRepairable + row.expiredUnit);
      });
    });
    return Object.entries(stats)
      .map(([sku, value]) => ({ name: sku, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [analyticsData]);

  const partyLocationStats = useMemo(() => {
    const stats: Record<string, number> = {};
    analyticsData.forEach(report => {
      const key = `${report.partyName} (${report.state})`;
      const rtv = report.rows.reduce((acc, row) => acc + row.notReceivedUnit + row.rejectNonRepairable + row.expiredUnit, 0);
      stats[key] = (stats[key] || 0) + rtv;
    });
    return Object.entries(stats)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [analyticsData]);

  const expiredSkus = useMemo(() => {
    const expired: any[] = [];
    analyticsData.forEach(report => {
      report.rows.forEach(row => {
        if (row.expDate) {
          try {
            let expD: Date | null = null;
            if (row.expDate.includes('/')) {
              const parts = row.expDate.split('/');
              if (parts.length === 2) {
                expD = parse(row.expDate, 'MM/yy', new Date());
              } else if (parts.length === 3) {
                expD = parse(row.expDate, 'dd/MM/yy', new Date());
              }
            }
            
            if (expD && isValid(expD) && isBefore(expD, istNow)) {
              expired.push({
                sku: row.newSku,
                party: report.partyName,
                expDate: row.expDate,
                qcNo: report.qcNo
              });
            }
          } catch (e) {}
        }
      });
    });
    return expired;
  }, [analyticsData, istNow]);

  if (selectedQc) {
    return (
      <div className="flex-1 bg-white h-full overflow-y-auto custom-scrollbar p-6 lg:p-10 font-sans">
        <div className="max-w-6xl mx-auto">
          <button 
            onClick={() => setSelectedQc(null)}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest mb-8 hover:translate-x-[-4px] transition-all"
          >
            <ArrowLeft size={16} /> Back to Insights
          </button>

          <div className="bg-white border-4 border-[#141414] p-8 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10 border-b-2 border-[#141414] pb-6">
              <div className="space-y-4">
                <div className="inline-block bg-[#141414] text-white px-3 py-1 text-[10px] font-black uppercase tracking-widest italic animate-pulse">
                  Detailed Audit Log
                </div>
                <div>
                  <h1 className="text-4xl font-black uppercase tracking-tighter leading-none">{selectedQc.qcNo}</h1>
                  <p className="text-xl font-medium opacity-60">Audit performed on {selectedQc.date}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-8 text-[10px] items-center">
                <div className="space-y-1">
                  <p className="font-black uppercase tracking-wider opacity-40">Party Name</p>
                  <p className="font-bold text-sm uppercase">{selectedQc.partyName}</p>
                </div>
                <div className="space-y-1">
                  <p className="font-black uppercase tracking-wider opacity-40">State/Location</p>
                  <p className="font-bold text-sm uppercase">{selectedQc.state}</p>
                </div>
                <div className="space-y-1">
                  <p className="font-black uppercase tracking-wider opacity-40">LR Number</p>
                  <p className="font-bold text-sm uppercase">{selectedQc.lrNo || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="font-black uppercase tracking-wider opacity-40">Box Quantity</p>
                  <p className="font-bold text-sm uppercase">{selectedQc.boxQty || '0'}</p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[10px] border-collapse">
                <thead>
                  <tr className="bg-[#141414] text-white uppercase tracking-widest">
                    <th className="p-4 font-black">SKU Detail</th>
                    <th className="p-4 font-black text-center">Bill</th>
                    <th className="p-4 font-black text-center">Recv</th>
                    <th className="p-4 font-black text-center text-orange-400">Exp</th>
                    <th className="p-4 font-black text-center text-red-400">RTV</th>
                    <th className="p-4 font-black text-center">Batch</th>
                    <th className="p-4 font-black text-center">Use</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedQc.rows.map((row, i) => (
                    <tr key={i} className="border-b-2 border-[#141414]/10 hover:bg-gray-50 transition-colors">
                      <td className="p-4">
                        <div className="font-black text-xs">{row.newSku}</div>
                        <div className="text-[8px] opacity-40 font-mono">{row.oldSku}</div>
                      </td>
                      <td className="p-4 text-center font-bold">{row.billQtyUnit}</td>
                      <td className="p-4 text-center font-bold text-green-600">{row.receivedUnit}</td>
                      <td className="p-4 text-center font-bold text-orange-600">{row.expiredUnit}</td>
                      <td className="p-4 text-center font-bold text-red-600">{row.notReceivedUnit + row.rejectNonRepairable}</td>
                      <td className="p-4 text-center font-mono">
                         <div className="opacity-80">{row.batchCode}</div>
                         <div className="text-[8px] opacity-40">E: {row.expDate}</div>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest ${row.use === 'FRESH' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {row.use}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white h-full overflow-y-auto custom-scrollbar p-6 lg:p-10 font-sans relative">
       <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 border-b-4 border-[#141414] pb-8">
          <div className="space-y-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-black uppercase tracking-tighter">QC Intelligence</h1>
              <div className="bg-red-600 text-white text-[8px] font-black px-2 py-1 uppercase tracking-widest animate-pulse">Alpha v2</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold bg-[#141414] text-white px-2 py-0.5 uppercase tracking-widest italic">GRN Audit Systems</span>
              <span className="text-[10px] font-mono opacity-40">Location: Mumbai, India (IST) | Time: {format(istNow, 'HH:mm')}</span>
            </div>
          </div>

          <div className="flex-1 max-w-md w-full relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={16} />
            <input 
              type="text"
              placeholder="Search QC No, Party, or State..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#141414]/5 border-2 border-[#141414] p-4 pl-12 text-xs font-bold uppercase tracking-widest focus:outline-none focus:bg-white transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
            />
            {searchQuery && (
              <div className="absolute top-full left-0 right-0 bg-white border-2 border-[#141414] mt-2 z-50 max-h-[300px] overflow-y-auto shadow-2xl custom-scrollbar border-t-0">
                {filteredReports.map(r => (
                  <button 
                    key={r.qcNo}
                    onClick={() => { setSelectedQc(r); setSearchQuery(''); }}
                    className="w-full text-left p-4 hover:bg-gray-50 border-b border-[#141414]/10 last:border-0 flex justify-between items-center group"
                  >
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-wider group-hover:text-red-600 transition-colors">{r.qcNo}</div>
                      <div className="text-[8px] opacity-40 uppercase font-medium">{r.partyName} | {r.state}</div>
                    </div>
                    <ArrowLeft className="rotate-180 opacity-0 group-hover:opacity-100 transition-all" size={14} />
                  </button>
                ))}
                {filteredReports.length === 0 && (
                  <div className="p-6 text-center text-[10px] opacity-30 italic uppercase">No Audit Found</div>
                )}
              </div>
            )}
          </div>

          <button 
            onClick={fetchDetailedData}
            disabled={isDataLoading}
            className="flex-shrink-0 bg-white border-4 border-[#141414] px-6 py-4 text-[10px] font-black uppercase tracking-widest flex items-center gap-3 hover:bg-gray-50 transition-all shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-50"
          >
            <RefreshCw size={14} className={isDataLoading ? 'animate-spin' : ''} /> Synchronize Audit Data
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white border-4 border-[#141414] p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] group hover:-translate-y-1 transition-transform">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#141414]/40 mb-1">Total QC Audits</p>
            <p className="text-5xl font-black tracking-tighter group-hover:text-red-600 transition-colors">{analyticsData.length}</p>
          </div>
          <div className="bg-white border-4 border-[#141414] p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] group hover:-translate-y-1 transition-transform">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#141414]/40 mb-1">RTV Potential (Units)</p>
            <p className="text-5xl font-black tracking-tighter text-red-600">
              {analyticsData.reduce((acc, r) => acc + r.rows.reduce((ra, row) => ra + row.notReceivedUnit + row.rejectNonRepairable + row.expiredUnit, 0), 0)}
            </p>
          </div>
          <div className="bg-white border-4 border-[#141414] p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] group hover:-translate-y-1 transition-transform">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#141414]/40 mb-1">Critical Expiry Count</p>
            <p className="text-5xl font-black tracking-tighter text-orange-600">{expiredSkus.length}</p>
          </div>
          <div className="bg-[#141414] border-4 border-[#141414] p-6 shadow-[8px_8px_0px_0px_rgba(31,31,31,0.5)]">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Current Repository</p>
            <p className="text-lg font-black text-white truncate leading-tight uppercase tracking-tighter">{boardData?.name || 'Monday'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="bg-white border-4 border-[#141414] p-8 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center justify-between mb-8 border-b-2 border-[#141414] pb-4">
              <h3 className="text-sm font-black uppercase tracking-widest">Worst Performing SKUs</h3>
              <span className="text-[8px] font-mono opacity-40 uppercase tracking-widest">Unit Sum (RTV + Exp)</span>
            </div>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={skuRtvStats} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={120} fontSize={8} fontWeight="900" tick={{ fill: '#141414' }} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(0,0,0,0.05)' }} 
                    contentStyle={{ border: '4px solid #141414', borderRadius: '0px', padding: '12px' }}
                    itemStyle={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }}
                  />
                  <Bar dataKey="value" fill="#141414" barSize={20}>
                    {skuRtvStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index < 3 ? '#dc2626' : '#141414'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border-4 border-[#141414] p-8 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center justify-between mb-8 border-b-2 border-[#141414] pb-4">
              <h3 className="text-sm font-black uppercase tracking-widest">Party RETURN Heatmap</h3>
              <span className="text-[8px] font-mono opacity-40 uppercase tracking-widest">Top Return Origins</span>
            </div>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={partyLocationStats}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={7} angle={-30} textAnchor="end" height={80} fontWeight="bold" />
                  <YAxis fontSize={9} fontWeight="bold" />
                  <Tooltip contentStyle={{ border: '4px solid #141414', borderRadius: '0px' }} />
                  <Bar dataKey="value" fill="#141414">
                    {partyLocationStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#141414', '#444444', '#777777', '#aaaaaa'][index % 4]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-[#141414] p-8 border-4 border-[#141414] shadow-[12px_12px_0px_0px_rgba(0,0,0,0.5)]">
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
              <h3 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-3">
                <AlertCircle className="text-red-600 animate-pulse" size={24} /> 
                System Critical Alerts
              </h3>
              <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
                <div className="flex items-center gap-2 text-orange-500">
                  <div className="w-2 h-2 bg-orange-500 rounded-full" /> HIGH EXPIRY RISK
                </div>
                <div className="flex items-center gap-2 text-red-500">
                  <div className="w-2 h-2 bg-red-500 rounded-full" /> IMMEDIATE RTV
                </div>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-6 space-y-4 shadow-[6px_6px_0px_0px_rgba(255,255,255,0.1)]">
                <h4 className="text-[10px] font-black uppercase tracking-widest border-b border-[#141414]/10 pb-2 flex justify-between">
                  <span>Expiry Violations</span>
                  <span className="text-red-600">{expiredSkus.length}</span>
                </h4>
                <div className="space-y-3 max-h-[250px] overflow-y-auto custom-scrollbar pr-2">
                  {expiredSkus.map((item, i) => (
                    <div key={i} className="border-l-4 border-orange-500 pl-3 py-1 bg-orange-50">
                      <div className="text-[10px] font-black truncate">{item.sku}</div>
                      <div className="text-[8px] opacity-40 uppercase font-medium">{item.party} • Exp: {item.expDate}</div>
                    </div>
                  ))}
                  {expiredSkus.length === 0 && <p className="text-[9px] opacity-20 italic">No violations detected</p>}
                </div>
              </div>

              <div className="md:col-span-2 bg-white p-6 shadow-[6px_6px_0px_0px_rgba(255,255,255,0.1)]">
                 <h4 className="text-[10px] font-black uppercase tracking-widest border-b border-[#141414]/10 pb-2 mb-4">Recursive Return Logic (SKU Origins)</h4>
                 <div className="overflow-x-auto">
                    <table className="w-full text-left text-[9px]">
                      <thead>
                        <tr className="opacity-40 uppercase font-black tracking-widest border-b border-[#141414]/5">
                          <th className="py-2">Problem SKU</th>
                          <th className="py-2">Major Origin</th>
                          <th className="py-2">State</th>
                          <th className="py-2 text-right">RTV Count</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#141414]/5">
                        {skuRtvStats.slice(0, 5).map((skuStat, i) => {
                          const worstPartyForSku = analyticsData.reduce((acc: any, report) => {
                            const skuRtv = report.rows
                              .filter(r => r.newSku === skuStat.name)
                              .reduce((ra, row) => ra + row.notReceivedUnit + row.rejectNonRepairable + row.expiredUnit, 0);
                            if (skuRtv > acc.count) return { name: report.partyName, state: report.state, count: skuRtv };
                            return acc;
                          }, { name: 'Multiple', state: '-', count: 0 });

                          return (
                            <tr key={i}>
                              <td className="py-3 font-black text-[#141414]">{skuStat.name}</td>
                              <td className="py-3 font-medium uppercase">{worstPartyForSku.name}</td>
                              <td className="py-3 font-medium uppercase opacity-50">{worstPartyForSku.state}</td>
                              <td className="py-3 font-black text-red-600 text-right">{skuStat.value}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}


function BoardLiveMonitor() {
  const { selectedBoardId, boardData, customEmbedUrls, setCustomEmbedUrl } = useMonday();
  const [isEditingEmbed, setIsEditingEmbed] = useState(false);
  const [tempUrl, setTempUrl] = useState('');
  
  const currentEmbedUrl = (selectedBoardId && customEmbedUrls[selectedBoardId]) 
    ? customEmbedUrls[selectedBoardId]
    : `https://view.monday.com/embed/${selectedBoardId}`;

  const handleUpdateEmbed = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedBoardId && tempUrl.trim()) {
      // Extract URL from iframe if they pasted the whole block
      let url = tempUrl.trim();
      const match = url.match(/src="([^"]+)"/);
      if (match) url = match[1];
      
      setCustomEmbedUrl(selectedBoardId, url);
      setIsEditingEmbed(false);
      setTempUrl('');
    }
  };

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
        <div className="flex items-center gap-3">
          <a 
            href={`https://monday.com/boards/${selectedBoardId}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-[#141414] text-white text-[10px] font-bold uppercase tracking-widest hover:invert transition-all"
          >
            <ExternalLink size={14} /> Edit in Monday
          </a>
          <button 
            onClick={() => {
              setTempUrl(customEmbedUrls[selectedBoardId || ''] || '');
              setIsEditingEmbed(!isEditingEmbed);
            }}
            className="flex items-center gap-2 px-4 py-2 border border-[#141414] text-[10px] font-bold uppercase tracking-widest hover:bg-gray-50 transition-all"
          >
            <Settings size={14} /> {isEditingEmbed ? 'Settings' : 'Update View'}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {!isEditingEmbed && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="bg-orange-50 border-b border-orange-200 p-2 text-center"
          >
            <p className="text-[9px] font-bold text-orange-800 uppercase tracking-widest flex items-center justify-center gap-2">
              <AlertCircle size={10} /> Note: The view below is a read-only mirror. Use the "Edit in Monday" button above for full board access.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isEditingEmbed && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-[#141414] text-white overflow-hidden"
          >
            <form onSubmit={handleUpdateEmbed} className="p-6 flex gap-4 items-end">
              <div className="flex-1 space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Paste Share Embed Link or Iframe Code</label>
                <input 
                  type="text"
                  value={tempUrl}
                  onChange={(e) => setTempUrl(e.target.value)}
                  placeholder="https://view.monday.com/embed/..."
                  className="w-full bg-white/10 border border-white/20 p-3 text-xs font-mono focus:outline-none focus:bg-white/20"
                />
              </div>
              <button type="submit" className="bg-white text-[#141414] px-8 py-3 font-black uppercase text-[10px] tracking-widest hover:invert transition-all h-[46px]">
                Save Link
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 p-8">
        <div className="w-full h-full bg-white border-2 border-[#141414] shadow-[12px_12px_0px_0px_rgba(0,0,0,0.1)] overflow-hidden">
          <iframe 
            key={currentEmbedUrl} // Force reload on URL change
            src={currentEmbedUrl}
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
