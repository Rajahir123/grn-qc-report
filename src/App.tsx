import React, { useState, useEffect, createContext, useContext, useRef, useMemo } from 'react';
import { 
  BarChart3, 
  Settings, 
  Layout, 
  Search, 
  Plus, 
  ChevronRight, 
  ChevronDown,
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
  ArrowLeft,
  History,
  Download,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import * as htmlToImage from 'html-to-image';
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

import * as XLSX from 'xlsx';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  getDocFromServer, 
  deleteDoc, 
  serverTimestamp,
  Timestamp,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  writeBatch,
  onSnapshot,
  addDoc
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(firebaseApp);

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", 
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", 
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", 
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", 
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", 
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", 
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

const INDIAN_CITIES_BY_STATE: Record<string, string[]> = {
  "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Kurnool", "Rajahmundry", "Tirupati", "Kakinada", "Kadapa", "Anantapur", "Eluru", "Ongole"],
  "Arunachal Pradesh": ["Itanagar", "Naharlagun", "Pasighat", "Tawang"],
  "Assam": ["Guwahati", "Dibrugarh", "Silchar", "Jorhat", "Nagaon", "Tinsukia", "Tezpur"],
  "Bihar": ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Purnia", "Darbhanga", "Arrah", "Bihar Sharif"],
  "Chhattisgarh": ["Raipur", "Bhilai", "Bilaspur", "Korba", "Rajnandgaon", "Jagdalpur"],
  "Goa": ["Panaji", "Margao", "Vasco da Gama", "Mapusa"],
  "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar", "Junagadh", "Gandhinagar", "Anand", "Morbi", "Vapi", "Valsad", "Bharuch"],
  "Haryana": ["Faridabad", "Gurgaon", "Panipat", "Ambala", "Yamunanagar", "Rohtak", "Hisar", "Karnal", "Sonipat", "Panchkula"],
  "Himachal Pradesh": ["Shimla", "Dharamshala", "Solan", "Mandi", "Kullu"],
  "Jharkhand": ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro Steel City", "Deoghar", "Hazaribagh"],
  "Karnataka": ["Bangalore", "Hubli-Dharwad", "Mysore", "Mangalore", "Belgaum", "Davanagere", "Bellary", "Gulbarga", "Shimoga", "Tumkur", "Udupi"],
  "Kerala": ["Thiruvananthapuram", "Kochi", "Kozhikode", "Kollam", "Thrissur", "Alappuzha", "Palakkad", "Kannur", "Kottayam"],
  "Madhya Pradesh": ["Indore", "Bhopal", "Jabalpur", "Gwalior", "Ujjain", "Sagar", "Dewas", "Satna", "Ratlam"],
  "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Thane", "Pimpri-Chinchwad", "Nashik", "Kalyan-Dombivli", "Vasai-Virar", "Aurangabad", "Navi Mumbai", "Solapur", "Mira-Bhayandar", "Bhiwandi", "Amravati", "Nanded", "Kolhapur", "Sangli", "Jalgaon", "Akola"],
  "Manipur": ["Imphal"],
  "Meghalaya": ["Shillong"],
  "Mizoram": ["Aizawl"],
  "Nagaland": ["Kohima", "Dimapur"],
  "Odisha": ["Bhubaneswar", "Cuttack", "Rourkela", "Berhampur", "Sambalpur", "Puri", "Balasore"],
  "Punjab": ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda", "Mohali", "Hoshiarpur", "Pathankot"],
  "Rajasthan": ["Jaipur", "Jodhpur", "Kota", "Bikaner", "Ajmer", "Udaipur", "Bhilwara", "Alwar", "Sikar", "Sri Ganganagar"],
  "Sikkim": ["Gangtok"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Trichy", "Salem", "Tiruppur", "Erode", "Vellore", "Thoothukudi", "Nagercoil", "Thanjavur"],
  "Telangana": ["Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Ramagundam", "Khammam"],
  "Tripura": ["Agartala"],
  "Uttar Pradesh": ["Lucknow", "Kanpur", "Ghaziabad", "Agra", "Meerut", "Varanasi", "Prayagraj", "Bareilly", "Aligarh", "Moradabad", "Saharanpur", "Gorakhpur", "Noida", "Greater Noida", "Firozabad", "Jhansi", "Muzaffarnagar", "Mathura", "Ayodhya"],
  "Uttarakhand": ["Dehradun", "Haridwar", "Haldwani", "Roorkee", "Rudrapur", "Kashipur", "Rishikesh"],
  "West Bengal": ["Kolkata", "Howrah", "Siliguri", "Asansol", "Durgapur", "Bardhaman", "Malda", "Baharampur", "Kharagpur"],
  "Andaman and Nicobar Islands": ["Port Blair"],
  "Chandigarh": ["Chandigarh"],
  "Dadra and Nagar Haveli and Daman and Diu": ["Silvassa", "Daman", "Diu"],
  "Delhi": ["New Delhi", "Delhi", "Dwarka", "Rohini"],
  "Jammu and Kashmir": ["Srinagar", "Jammu", "Anantnag"],
  "Ladakh": ["Leh", "Kargil"],
  "Lakshadweep": ["Kavaratti"],
  "Puducherry": ["Pondicherry", "Karaikal", "Mahe", "Yanam"]
};

const ALL_INDIAN_CITIES = Array.from(new Set(Object.values(INDIAN_CITIES_BY_STATE).flat())).sort();

const TRANSPORTERS = [
  "Flipkart",
  "Safexpress",
  "XPEED",
  "Shree Maruti",
  "v- xpress",
  "Metropolis logisticss",
  "GATI",
  "LALJI MULJI",
  "DELHIVERY",
  "XPRESS BEES",
  "All cargo"
];

const INITIAL_PARTIES = [
  "Hands on trades", "Scootsy", "Flipkart", "Amazon", "Reliance", "WAL-MART INDIA PVT",
  "NATURES BASKET", "1 is one marketing", "More retail pvt", "GenRikTail enterprises",
  "Innovative retail", "BIC NELAMANGLA", "Retail market KR puram", "Fitholic Raw pvt ltd",
  "Hyuga E-commerce venture pvt", "heera impex", "Metro cash carry India pvt", "Bigbasket",
  "Anand bharti", "Fit factory", "metrocash and carry india LTD", "kasana brothers",
  "Khera trading", "MORE RETAIL PVT", "PAREKH ENTERPRISE", "MAA KALKA TRADERS",
  "ANAND ENTERPRISES", "KAMLA ENTERPRISE", "GUNJAN SALES", "Shree balajee enterprises",
  "AG Nutrition", "Niteeka Enterprises", "Nutrition XP", "Zepto", "Apollo Health co ltd",
  "Omkara globallog B2B", "Aastha Traders shop", "Supreme sales corporation",
  "Melons & moons pvt ltd", "Ritesh distributers", "Classic craft", "Nutrabay retail pvt ltd",
  "B-fit boss nutrition", "patil enterprises", "Kasana brothers", "Vijin Enterprise",
  "Genriktail enterprises", "Anand Enterprises", "AJFAN International",
  "Indian food & Beverages", "Shiv Kripa Trading Co.", "Shubh laxmi enterprise", "Rakesh Distributor"
];

const DOCUMENTATION_MARKDOWN = `# 🛠️ Developer Manifesto: Monday Board Connect

This document is a technical post-mortem and developer guide for the **Monday Board Connect (QC Sync)** application. It outlines how the app was built from scratch, the design decisions made, and the prompts used to generate the logic.

---

## 🏗️ The Build Flow (Mental Model)

The app was built using a **Modular Iteration** approach:

1.  **UI Skeleton**: Initialized the dashboard with a "Brutalist" design aesthetic (heavy borders, high contrast).
2.  **API Bridge**: Built a Node.js Express proxy to solve two problems: **CORS limitations** and **Security of API Secrets**.
3.  **Authentication Layer**: Implemented a dynamic token system where users enter their Personal API token once, which is then stored in local storage for subsequent sessions.
4.  **Sync Logic**: Developed a two-stage GraphQL mutation (Create Item -> Update Columns) to handle the complex structure of Monday.com items.
5.  **Multi-Region Support**: Added a region-aware routing system to toggle between \`.monday.com\` and \`.monday-eu.com\` gateways.
6.  **Vercel Optimization**: Created a dedicated \`api/index.ts\` to support Vercel's Serverless Function architectural needs.

---

## 📜 Developer Prompts (Chronological History)

Here are the core prompts used to instruct the AI during development:

1.  **Initialization**: *"Create a React 19 app with Vite and Tailwind v4. The design should be brutalist (black/white, thick borders). I need a dashboard to manage Quality Control reports."*
2.  **Monday Integration**: *"Implement a proxy server in express to handle Monday.com GraphQL requests. Use headers for the API token. Support global and EU regions."*
3.  **Data Schema**: *"Create a QC Report builder UI that captures QC No, Party Name, and State. Sync these to a Monday.com board using mutations."*
4.  **Vercel Deployment**: *"Build a vercel.json and a standalone serverless function in /api/index.ts that mirrors the logic in server.ts but is optimized for cloud hosting."*
5.  **Security Protocol**: *"Create an AGENTS.md file that mandates an 'Approval Protocol' before any major changes. AI must provide Pros and Cons for every update."*

---

## 🧩 Component Breakdown

### 1. The Proxy (Backend)
-   **File**: \`api/index.ts\` & \`server.ts\`
-   **Logic**: Uses \`axios\` to relay POST requests. It strips problematic trailing slashes and dynamically sets the \`Authorization\` and \`API-Version\` headers.

### 2. The Context Provider (State Manager)
-   **File**: \`src/App.tsx\` -> \`MondayProvider\`
-   **Logic**: Wraps the app in a logic layer that refreshes Monday Board data every time the API token or Region changes.

### 3. The Sync Engine
-   **Function**: \`submitReport\`
-   **Logic**: 
    - \`Mutation 1\`: Creates the item with just the name. 
    - \`Mutation 2\`: Stringifies a JSON object of column values (using Monday's \`change_multiple_column_values\` API) and applies them to the newly created ID.

---

## 🚀 Guidelines for Future Developers

-   **Adding Columns**: To sync a new piece of data, you must add it to the \`QCReport\` interface in \`App.tsx\` and then update the GraphQL JSON payload in the \`change_multiple_column_values\` mutation.
-   **Regional Gateway**: If you get a 404, check the headers on the proxy. The \`x-monday-region\` header must be correctly set to \`eu\` to talk to the European servers.
-   **Local Development**: Run the app using \`tsx server.ts\` to ensure the proxy and frontend run on the same port (3000).

---
*Documentation Version: 2.0.0*
*For: denyteny123@gmail.com*`;
// These define the structure of the data used throughout the application.

interface Column {
  id: string;
  title: string;
  type: string;
}

/**
 * Representation of a Monday.com Item
 */
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
  rtvNoPoNo: string;
  dnDate: string;
  rtvAmount: string;
  transporter: string;
  noteNarration: string;
  partyName: string;
  state: string;
  city: string;
  rows: QCRow[];
  approvedBy: string;
}

interface MondayContextType {
  token: string | null;
  setToken: (token: string | null) => void;
  region: 'global' | 'eu';
  setRegion: (region: 'global' | 'eu') => void;
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
  const [region, setRegion] = useState<'global' | 'eu'>((localStorage.getItem('monday_region') as 'global' | 'eu') || 'global');
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(localStorage.getItem('selected_board_id'));
  const [boardData, setBoardData] = useState<Board | null>(null);
  const [customEmbedUrls, setCustomEmbedUrls] = useState<Record<string, string>>({});

  // Fetch board configs from Firestore when selected board changes
  useEffect(() => {
    async function fetchBoardConfig() {
      if (!selectedBoardId || !auth.currentUser) return;
      try {
        const configDoc = await getDoc(doc(db, 'boardConfigs', selectedBoardId));
        if (configDoc.exists()) {
          const data = configDoc.data();
          if (data.embedUrl) {
            setCustomEmbedUrls(prev => ({ ...prev, [selectedBoardId]: data.embedUrl }));
          }
        } else if (selectedBoardId === '18411045763') {
          // Provision the specific requested URL for this board if no config exists
          const defaultUrl = 'https://view.monday.com/embed/18411045763-24887a6c5d50e8a633ae45bfb9b812c2?r=use1';
          setCustomEmbedUrl(selectedBoardId, defaultUrl);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `boardConfigs/${selectedBoardId}`);
      }
    }
    
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) fetchBoardConfig();
    });
    if (auth.currentUser) fetchBoardConfig();
    return () => unsubscribe();
  }, [selectedBoardId]);

  const setCustomEmbedUrl = async (boardId: string, url: string) => {
    setCustomEmbedUrls(prev => ({ ...prev, [boardId]: url }));
    if (!auth.currentUser) return;
    try {
      await setDoc(doc(db, 'boardConfigs', boardId), {
        boardId,
        embedUrl: url,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser.uid
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `boardConfigs/${boardId}`);
    }
  };

  useEffect(() => {
    if (token) {
      localStorage.setItem('monday_token', token);
      localStorage.setItem('monday_region', region);
      fetchBoards().catch(console.error);
    } else {
      localStorage.removeItem('monday_token');
      localStorage.removeItem('monday_region');
      localStorage.removeItem('selected_board_id');
      setSelectedBoardId(null);
      setBoardData(null);
    }
  }, [token, region]);

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
        headers: { 
          'Content-Type': 'application/json', 
          'x-monday-token': token,
          'x-monday-region': region 
        },
        body: JSON.stringify({
          query: '{ boards (limit: 500) { id name description } }'
        })
      });
      const data = await response.json();
      if (response.status === 401 || JSON.stringify(data || {}).includes("Not Authenticated")) {
        logout();
        const t = token ? (token.substring(0,5) + '...') : 'None';
        setError(`Access Denied (401). Region: ${region}, Token: ${t}. Please check Vercel Environment Variables (Admin_API_Key, MONDAY_REGION).`);
        return;
      }
      if (data.error) throw new Error(data.error);
      if (data.errors) throw new Error(data.errors[0].message || data.errors[0]);
      setBoards(data.data?.boards || []);
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
        headers: { 
          'Content-Type': 'application/json', 
          'x-monday-token': token,
          'x-monday-region': region
        },
        body: JSON.stringify({
          query: `
            query {
              boards (ids: [${id}]) {
                id
                name
                description
                columns { id title type settings_str }
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
      if (response.status === 401 || JSON.stringify(data || {}).includes("Not Authenticated") || data.proxy_status === 401) {
        logout();
        const t = token ? (token.substring(0,5) + '...') : 'None';
        setError(`Access Denied (401). Region: ${region}, Token: ${t}. Please check Vercel Environment Variables (Admin_API_Key, MONDAY_REGION).`);
        return;
      }
      if (data.error) throw new Error(data.error);
      if (data.errors) throw new Error(data.errors[0].message || data.errors[0]);
      setBoardData(data.data?.boards?.[0] || null);
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

  /**
   * Submits a Quality Control report to Monday.com.
   * This involves two steps:
   * 1. Creating the item (the main report header).
   * 2. Updating column values (the detailed QC data).
   */
  const submitReport = async (report: QCReport) => {
    if (!token || !selectedBoardId) return;
    setSyncStatus('syncing');
    setSyncError(null);
    try {
      // Logic to find Status, State and Transporter columns
      const statusCol = boardData?.columns?.find(c => {
        const title = c.title.toLowerCase();
        let settings: any = {};
        try {
          settings = c.settings_str ? JSON.parse(c.settings_str) : {};
        } catch (e) { }
        const labels = settings.labels || (settings.labels_positions_v2 ? Object.values(settings.labels_positions_v2) : []);
        const isStatusType = c.type === 'status';
        const hasCorrectTitle = title === 'status' || title.includes('qc') || title.includes('process');
        const notOwner = !title.includes('owner') && !title.includes('party') && !title.includes('people');
        if (isStatusType && notOwner) {
          const hasReceived = Object.values(labels).some((l: any) => 
            typeof l === 'string' && (l.toLowerCase().includes('received') || l.toLowerCase().includes('done'))
          );
          if (hasReceived || hasCorrectTitle) return true;
        }
        return false;
      }) || boardData?.columns?.find(c => {
        const title = c.title.toLowerCase();
        return (c.type === 'status' || title.includes('status')) && !title.includes('owner') && !title.includes('party');
      });

      const stateCol = boardData?.columns?.find(c => {
        const title = c.title.toLowerCase();
        return title.includes('state') && c.type !== 'people' && c.type !== 'multiple-person' && !title.includes('owner');
      });

      const transporterCol = boardData?.columns?.find(c => {
        const title = c.title.toLowerCase();
        return title.includes('transporter') && c.type !== 'people' && c.type !== 'multiple-person' && !title.includes('owner');
      });

      const partyCol = boardData?.columns?.find(c => {
        const title = c.title.toLowerCase();
        return (title.includes('party') || title.includes('client')) && title !== 'party owner' && c.type !== 'people' && c.type !== 'multiple-person';
      });

      const requestDateCol = boardData?.columns?.find(c => {
        const title = c.title.toLowerCase();
        return title === 'request date';
      }) || boardData?.columns?.find(c => {
        const title = c.title.toLowerCase();
        return (title.includes('request date') || title.includes('date')) && !title.includes('dispatch') && c.type !== 'people' && c.type !== 'multiple-person';
      });

      const invoiceCol = boardData?.columns?.find(c => {
        const title = c.title.toLowerCase();
        return title === 'invoice, lr, qc' || title === 'invoice, lr, qc column';
      }) || boardData?.columns?.find(c => {
        const title = c.title.toLowerCase();
        return (title.includes('invoice') || title.includes('lr') || title.includes('qc')) && !title.includes('status') && c.type !== 'status' && c.type !== 'people';
      });

      const boxQtyCol = boardData?.columns?.find(c => {
        const title = c.title.toLowerCase();
        return title.includes('number of box') || 
               title.includes('no of box') || 
               title.includes('no. of box') || 
               title.includes('box qty') || 
               title.includes('box quantity') || 
               title.includes('number of boxes') || 
               title.includes('no. of boxes') || 
               title.includes('no of boxes');
      }) || boardData?.columns?.find(c => {
        const title = c.title.toLowerCase();
        return title.includes('box') && !title.includes('category') && c.type !== 'status' && c.type !== 'dropdown';
      });

      const lrNoCol = boardData?.columns?.find(c => {
        const title = c.title.toLowerCase();
        return title === 'lr number' || 
               title === 'lr no' || 
               title === 'lr_no' || 
               title === 'lrno' || 
               title === 'lr';
      }) || boardData?.columns?.find(c => {
        const title = c.title.toLowerCase();
        return (title.includes('lr number') || title.includes('lr no') || title.includes('lr_no') || title.includes('lrno')) && 
               !title.includes('invoice') && !title.includes('status') && c.type !== 'status' && c.type !== 'people';
      });

      const noteCol = boardData?.columns?.find(c => {
        const title = c.title.toLowerCase();
        return title === 'narration' || 
               title === 'note' || 
               title === 'notes' || 
               title === 'remark' || 
               title === 'remarks' || 
               title === 'note & narration' ||
               title === 'note/narration' ||
               title === 'notes & narration';
      }) || boardData?.columns?.find(c => {
        const title = c.title.toLowerCase();
        return (title.includes('narration') || title.includes('note') || title.includes('remark') || title.includes('comment')) &&
               c.type !== 'people' && c.type !== 'multiple-person' && !title.includes('owner');
      });

      const itemName = `${report.qcNo || 'QC-'} | ${report.partyName || ''}`.substring(0, 250);
      
      const columnValues: Record<string, any> = {};
      
      const setColValue = (col: any, value: any) => {
        if (!col || value === undefined || value === null || value === '') return;
        const skipTypes = [
          'formula', 'lookup', 'mirror', 'progress', 'dependency', 
          'color_picker', 'people', 'multiple-person', 'link', 
          'creation_log', 'last_updated', 'file', 'subtasks', 'button', 'tags'
        ];
        if (skipTypes.includes(col.type)) return;

        if (col.type === 'status') {
          columnValues[col.id] = { label: String(value) };
        } else if (col.type === 'dropdown') {
          columnValues[col.id] = { labels: [String(value)] };
        } else if (col.type === 'numbers') {
          const cleanNum = String(value).replace(/[^0-9.-]/g, '');
          if (cleanNum !== '') {
            columnValues[col.id] = cleanNum;
          }
        } else if (col.type === 'date') {
          columnValues[col.id] = { date: String(value) };
        } else if (col.type === 'long_text' || col.type === 'long-text') {
          columnValues[col.id] = { text: String(value) };
        } else {
          columnValues[col.id] = String(value);
        }
      };

      // Update Status to "Received" if column found. 
      if (statusCol) {
        let settings: any = {};
        try {
          settings = statusCol.settings_str ? JSON.parse(statusCol.settings_str) : {};
        } catch (e) {
          console.error("Error parsing statusCol settings:", e);
        }
        const labelsMap = settings.labels || {};
        const labels = Object.values(labelsMap).map((l: any) => typeof l === 'string' ? l.toLowerCase() : '');
        
        if (labels.includes('received')) {
          columnValues[statusCol.id] = { label: "Received" };
        } else if (labels.includes('qc done')) {
          columnValues[statusCol.id] = { label: "QC Done" };
        } else if (labels.includes('done')) {
          columnValues[statusCol.id] = { label: "Done" };
        }
      }
      
      // Sync State
      if (stateCol && report.state) {
        if (stateCol.type === 'status') {
          let settings: any = {};
          try {
            settings = stateCol.settings_str ? JSON.parse(stateCol.settings_str) : {};
          } catch (e) { }
          const labelsMap = settings.labels || {};
          const labels = Object.values(labelsMap) as string[];
          const matchedLabel = labels.find(l => l && l.toUpperCase().includes((report.state || "").toUpperCase()));
          if (matchedLabel) {
            columnValues[stateCol.id] = { label: matchedLabel };
          } else {
            columnValues[stateCol.id] = { label: report.state };
          }
        } else {
          setColValue(stateCol, report.state);
        }
      }

      // Sync others using helper
      setColValue(transporterCol, report.transporter);
      setColValue(partyCol, `${report.qcNo || 'QC-'} | ${report.partyName || ''}`);
      
      if (requestDateCol && report.date && requestDateCol.type === 'date') {
        columnValues[requestDateCol.id] = { date: report.date };
      }

      const skipTypes = ['formula', 'lookup', 'mirror', 'progress', 'dependency'];
      if (invoiceCol && report.lrNo && !skipTypes.includes(invoiceCol.type)) {
        setColValue(invoiceCol, report.lrNo);
      }

      if (lrNoCol && report.lrNo && !skipTypes.includes(lrNoCol.type)) {
        setColValue(lrNoCol, report.lrNo);
      }

      if (boxQtyCol && report.boxQty) {
        setColValue(boxQtyCol, report.boxQty);
      }

      if (noteCol && report.noteNarration) {
        setColValue(noteCol, report.noteNarration);
      }

      const mutation = `
        mutation($boardId: ID!, $itemName: String!, $columnValues: JSON) {
          create_item (
            board_id: $boardId, 
            item_name: $itemName,
            column_values: $columnValues
          ) {
            id
          }
        }
      `;

      // Monday 2024-04 JSON scalar expects a STRING representation of the JSON object
      const columnValuesVariable = Object.keys(columnValues).length > 0 ? JSON.stringify(columnValues) : "{}";

      const creationResponse = await fetch('/api/monday/proxy', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'x-monday-token': token || '',
          'x-monday-region': region 
        },
        body: JSON.stringify({
          query: mutation,
          variables: {
            boardId: String(selectedBoardId),
            itemName: itemName,
            columnValues: columnValuesVariable
          }
        })
      });
      
      const responseContentType = creationResponse.headers.get('content-type') || '';
      const responseText = await creationResponse.text();
      
      if (responseContentType.includes('text/html') || responseText.trim().startsWith('<!')) {
        throw new Error(`Sync Error: Proxy returned HTML instead of JSON (${creationResponse.status}). This usually means the API route was not found or the server is starting up. Details: ${responseText.substring(0, 100)}...`);
      }

      let creationData;
      try {
        creationData = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Invalid response from proxy (${creationResponse.status}): ${responseText.substring(0, 100)}`);
      }
      
      if (creationResponse.status === 401 || JSON.stringify(creationData || {}).includes("Not Authenticated") || creationData.proxy_status === 401) {
        logout();
        setSyncStatus('error');
        const t = token ? (token.substring(0,5) + '...') : 'None';
        setSyncError(`Access Denied (401). Region: ${region}, Token: ${t}. Please check Vercel Environment Variables.`);
        return;
      }
      
      if (!creationResponse.ok) {
        const backendError = creationData.error || creationData.message || creationData.error_message;
        const mappedErrors = creationData.errors ? creationData.errors.map((e: any) => e.message).join(', ') : null;
        const debugInfo = JSON.stringify(creationData).substring(0, 200);
        throw new Error(backendError || mappedErrors || `Creation failed (${creationResponse.status}): ${debugInfo}`);
      }
      
      if (creationData.errors) {
        throw new Error(creationData.errors.map((e: any) => e.message).join(', '));
      }
      
      if (!creationData.data?.create_item?.id) {
        throw new Error("Failed to create item. Check if the Board ID exists and your token has write access.");
      }
      
      const mainItemId = creationData.data.create_item.id;

      const skuCards = report.rows.map((r, i) => `
SKU #${i + 1}: ${r.newSku} ${r.oldSku ? `(Old Ref: ${r.oldSku})` : ''}
  Quantities & Status:
    Bill Qty: ${r.billQtyUnit} Units
    Received: ${r.receivedUnit} Units
    Not Received: ${r.notReceivedUnit} Units
    Expired Qty: ${r.expiredUnit} Units
    Damaged (Repairable): ${r.damagesRepairable} Units
    Rejected (Non-Repairable): ${r.rejectNonRepairable} Units
  Quality Parameters:
    Batch Code: ${r.batchCode || 'N/A'}
    MFG Date: ${r.mfgDate || 'N/A'}
    EXP Date: ${r.expDate || 'N/A'}
    Action/Usage: ${r.use || 'N/A'}
`).join('\n---\n');

      const tableMarkdown = `
SALES RETURN QC REPORT (GRN)
QC NO: ${report.qcNo} | LR NO: ${report.lrNo}
DATE: ${report.date} | BOX QTY: ${report.boxQty}
PARTY: ${report.partyName} | STATE: ${report.state} | CITY: ${report.city || 'N/A'}
NOTE & NARRATION: ${report.noteNarration || 'N/A'}

---

SKU-WISE QC BREAKDOWN
${skuCards}

---

APPROVE BY: ${report.approvedBy}

---

SYSTEM COMPATIBILITY TABLE (DO NOT REMOVE)
| OLD SKU | NEW SKU | BILL QTY | RECEIVED | EXPIRED | NOT RECEIVED | DMG (R) | REJ (NR) | USE | BATCH | MFG | EXP |
|---|---|---|---|---|---|---|---|---|---|---|---|
${report.rows.map(r => `| ${r.oldSku} | ${r.newSku} | ${r.billQtyUnit} | ${r.receivedUnit} | ${r.expiredUnit} | ${r.notReceivedUnit} | ${r.damagesRepairable} | ${r.rejectNonRepairable} | ${r.use} | ${r.batchCode} | ${r.mfgDate} | ${r.expDate} |`).join('\n')}
      `;

      const updateMutation = `
        mutation($itemId: ID!, $body: String!) {
          create_update (item_id: $itemId, body: $body) {
            id
          }
        }
      `;

      const updateResponse = await fetch('/api/monday/proxy', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'x-monday-token': token,
          'x-monday-region': region
        },
        body: JSON.stringify({
          query: updateMutation,
          variables: {
            itemId: mainItemId,
            body: tableMarkdown
          }
        })
      });

      const updateResponseText = await updateResponse.text();
      let updateData;
      try {
        updateData = JSON.parse(updateResponseText);
      } catch (e) {
        throw new Error(`Item created (v${mainItemId}), but details failed. Invalid response (${updateResponse.status})`);
      }

      if (updateResponse.status === 401 || JSON.stringify(updateData || {}).includes("Not Authenticated") || updateData.proxy_status === 401) {
        logout();
        setSyncStatus('error');
        setSyncError("Session expired or invalid token while adding details. Please log in again.");
        return;
      }

      if (!updateResponse.ok) {
        const updateDebug = JSON.stringify(updateData).substring(0, 200);
        throw new Error(`Item created, but failed to add details (v${mainItemId}): ${updateData.error || updateData.message || updateResponse.status}. Debug: ${updateDebug}`);
      }

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
      token, setToken, region, setRegion, boards, loading, error, fetchBoards, 
      selectedBoardId, setSelectedBoardId, boardData, fetchBoardDetails,
      submitReport,
      syncStatus,
      syncError,
      activeView,
      setActiveView,
      customEmbedUrls,
      setCustomEmbedUrl,
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
  const [mode, setMode] = useState<'password' | 'manual'>('password');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [inputToken, setInputToken] = useState(localStorage.getItem('monday_token') || '');
  const [inputBoardId, setInputBoardId] = useState(localStorage.getItem('selected_board_id') || '');
  const { setToken, setSelectedBoardId, region, setRegion, loading, error } = useMonday();

  const downloadDocs = () => {
    const blob = new Blob([DOCUMENTATION_MARKDOWN], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Monday_Board_Connect_Documentation.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!password) return;

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (data.success && data.mondayToken && data.boardId) {
        const extractedBoardId = data.boardId.replace(/[^0-9]/g, '');
        if (!extractedBoardId) {
          setLoginError('Invalid Target_Board_ID format. Must contain digits.');
          return;
        }
        setToken(data.mondayToken);
        setRegion(data.region === 'eu' ? 'eu' : 'global');
        setSelectedBoardId(extractedBoardId);
      } else if (data.success) {
        setLoginError('Setup needed: Please configure Admin_API_Key and Target_Board_ID in the settings menu.');
      } else {
        setLoginError(data.error || 'Invalid password or system unconfigured.');
      }
    } catch (err) {
      setLoginError('Server error.');
    }
  };

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
        className="w-full max-w-md bg-white border-2 border-[#141414] p-8 shadow-[12px_12px_0px_0px_rgba(20,20,20,1)] flex flex-col"
      >
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-[#141414] flex items-center justify-center shrink-0">
            <Database className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter">QC Portal Link</h1>
            <p className="text-[10px] font-bold opacity-40 uppercase italic tracking-widest">Monday.com &times; Direct Access</p>
          </div>
        </div>

        {mode === 'password' ? (
          <>
            <div className="mb-8 p-4 bg-[#141414] text-white space-y-2 shadow-[4px_4px_0px_0px_rgba(100,100,100,1)]">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-[#E4E3E0]">Quick Access</h3>
              <p className="text-[10px] leading-relaxed font-medium opacity-90">
                Enter your 4-digit system password to automatically authenticate and link the platform.
              </p>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest opacity-60">System PIN / Password</label>
                <input 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="&bull;&bull;&bull;&bull;"
                  maxLength={4}
                  className="w-full bg-[#f5f5f5] border-2 border-[#141414] p-4 font-mono text-center text-4xl tracking-[0.5em] focus:outline-none focus:bg-white transition-all placeholder:text-[#ccc]"
                  required
                />
              </div>

              {loginError && (
                <div className="p-4 bg-red-50 border-2 border-red-600 text-red-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-3">
                  <AlertCircle size={16} />
                  {loginError}
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-50 border-2 border-red-600 text-red-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-3">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 px-8 bg-[#141414] text-white text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-all shadow-[6px_6px_0px_0px_rgba(20,20,20,0.3)] active:shadow-none active:translate-x-[6px] active:translate-y-[6px]"
              >
                {loading ? 'Authenticating...' : 'Enter System'} <ChevronRight className="w-4 h-4" />
              </button>

              <div className="pt-4 text-center">
                <button
                  type="button"
                  onClick={() => setMode('manual')}
                  className="text-[10px] font-bold opacity-40 uppercase tracking-widest border-b-2 border-transparent hover:border-[#141414] hover:opacity-100 transition-all pb-1"
                >
                  Configure Manually &rarr;
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
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

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-60">Account Region</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRegion('global')}
                      className={`py-2 px-3 text-[10px] font-bold border-2 transition-all ${region === 'global' ? 'border-[#141414] bg-[#141414] text-white' : 'border-[#141414]/20 bg-white text-[#141414]'}`}
                    >
                      GLOBAL (.com)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegion('eu')}
                      className={`py-2 px-3 text-[10px] font-bold border-2 transition-all ${region === 'eu' ? 'border-[#141414] bg-[#141414] text-white' : 'border-[#141414]/20 bg-white text-[#141414]'}`}
                    >
                      EUROPE (-eu.com)
                    </button>
                  </div>
                  <p className="text-[8px] font-bold opacity-40 mt-1 italic">
                    * Choose Europe if your Monday URL ends in .monday-eu.com
                  </p>
                </div>

                <button
                  type="button"
                  onClick={downloadDocs}
                  className="w-full py-4 px-4 bg-white border-2 border-[#141414] text-[#141414] text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-gray-50 transition-all shadow-[4px_4px_0px_0px_rgba(20,20,20,0.1)] active:shadow-none active:translate-x-1 active:translate-y-1"
                >
                  <FileText size={14} />
                  Download Full Documentation
                </button>
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

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setMode('password')}
                  className="text-[10px] font-bold opacity-40 uppercase tracking-widest border-b-2 border-transparent hover:border-[#141414] hover:opacity-100 transition-all pb-1"
                >
                  &larr; Back to Quick Login
                </button>
              </div>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}

const SIDEBAR_TRANSITION = { type: "tween", duration: 0.2, ease: "circOut" };

function Sidebar({ 
  isOpen, 
  onClose, 
  isMinimized, 
  onToggleMinimize 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  isMinimized: boolean; 
  onToggleMinimize: () => void;
}) {
  const { boards, setSelectedBoardId, selectedBoardId, logout, activeView, setActiveView } = useMonday();
  const [searchTerm, setSearchTerm] = useState('');
  const [manualId, setManualId] = useState('');

  const filteredBoards = boards.filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleManualConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualId.trim()) {
      let id = manualId.trim();
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

      <motion.div 
        animate={{ 
          width: isMinimized ? 72 : 320,
        }}
        transition={SIDEBAR_TRANSITION}
        className={`fixed inset-y-0 left-0 z-[70] lg:relative lg:translate-x-0 lg:inset-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          h-full bg-[#E4E3E0] border-r border-[#141414] flex flex-col print:hidden overflow-hidden`}
        style={{ willChange: 'width' }}
      >
        <div className={`border-b border-[#141414] bg-white/20 flex ${isMinimized ? 'flex-col items-center py-4 gap-4' : 'p-6 justify-between items-center'} min-h-[73px]`}>
          <motion.div 
            layout="position"
            transition={SIDEBAR_TRANSITION}
            className="flex items-center gap-2 overflow-hidden"
          >
            <div className={`shrink-0 bg-[#141414] flex items-center justify-center transition-all duration-100 ${isMinimized ? 'w-8 h-8' : 'w-4 h-4'}`}>
              {isMinimized ? <Database size={14} className="text-white" /> : null}
            </div>
            
            {!isMinimized && (
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-black uppercase tracking-[0.2em] text-xs whitespace-nowrap"
              >
                GRN System
              </motion.span>
            )}
          </motion.div>
          
          <div className={`flex items-center gap-1 ${isMinimized ? 'w-full flex justify-center border-t border-[#141414]/5 pt-4' : ''}`}>
            <motion.button 
              layout
              animate={{ rotate: isMinimized ? 180 : 0 }}
              transition={SIDEBAR_TRANSITION}
              onClick={onToggleMinimize}
              className="hidden lg:block opacity-40 hover:opacity-100 p-2 hover:bg-[#141414] hover:text-white rounded"
              title="Toggle Panel"
            >
              <ArrowLeft size={16} />
            </motion.button>
            <AnimatePresence>
              {!isMinimized && (
                <motion.button 
                  key="logout-btn"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 0.2, scale: 1 }}
                  whileHover={{ opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={SIDEBAR_TRANSITION}
                  onClick={logout} 
                  className="p-2 text-red-600 hover:bg-[#141414] hover:text-white rounded"
                  title="Switch Account & Reset"
                >
                  <LogOut size={16} />
                </motion.button>
              )}
            </AnimatePresence>
            <button onClick={onClose} className="lg:hidden p-2 opacity-50 hover:opacity-100">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex flex-col shrink-0">
          <TabButton 
            active={activeView === 'builder'} 
            onClick={() => { setActiveView('builder'); onClose(); }}
            isMinimized={isMinimized}
            icon={<Layout />}
            label="Builder"
          />
          <TabButton 
            active={activeView === 'monitor'} 
            onClick={() => { setActiveView('monitor'); onClose(); }}
            isMinimized={isMinimized}
            icon={<RefreshCw />}
            label="Monitor"
          />
          <TabButton 
            active={activeView === 'dashboard'} 
            onClick={() => { setActiveView('dashboard'); onClose(); }}
            isMinimized={isMinimized}
            icon={<BarChart3 />}
            label="Analytics"
          />
          <TabButton 
            active={activeView === 'history'} 
            onClick={() => { setActiveView('history'); onClose(); }}
            isMinimized={isMinimized}
            icon={<History />}
            label="History"
          />
        </div>

        <div className={`flex-1 flex flex-col overflow-hidden transition-opacity duration-200 ${isMinimized ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          {activeView === 'builder' ? (
            <>
              <div className="p-4 border-b border-[#141414]/10 bg-white/10">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" size={14} />
                  <input 
                    type="text"
                    placeholder="Filter boards..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white/50 border border-[#141414] py-2 pl-9 pr-4 text-xs focus:outline-none focus:bg-white transition-all shadow-sm"
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
                          ${selectedBoardId === board.id ? 'bg-[#141414] text-white shadow-inner' : 'hover:bg-white/40'}`}
                      >
                        <Layout size={16} className={selectedBoardId === board.id ? 'text-white' : 'opacity-40'} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium uppercase tracking-tight truncate">{board.name}</p>
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
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    const blob = new Blob([DOCUMENTATION_MARKDOWN], { type: 'text/markdown' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'Monday_Board_Connect_Documentation.md';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-[#141414] text-[9px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all shadow-[4px_4px_0px_0px_rgba(20,20,20,0.1)] active:shadow-none active:translate-x-1 active:translate-y-1"
                >
                  <FileText size={12} /> Download Docs
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 opacity-20 space-y-4">
              <div className="w-16 h-16 border-2 border-[#141414] flex items-center justify-center rounded-2xl rotate-3">
                {activeView === 'monitor' ? <RefreshCw size={32} /> : 
                 activeView === 'dashboard' ? <BarChart3 size={32} /> : 
                 <History size={32} />}
              </div>
              <div className="text-center">
                <p className="text-[12px] font-black uppercase tracking-[0.2em]">{activeView}</p>
                <p className="text-[9px] font-bold uppercase opacity-60">System Ready</p>
              </div>
            </div>
          )}
        </div>

        {isMinimized && (
          <div className="mt-auto p-4 bg-[#DEDCD7] border-t border-[#141414] flex flex-col items-center gap-2">
            <button 
              onClick={logout}
              className="p-3 text-red-600 hover:bg-red-50 transition-all rounded"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        )}
      </motion.div>
    </>
  );
}

function TabButton({ active, onClick, isMinimized, icon, label }: any) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-4 transition-all duration-200 
        ${isMinimized ? 'justify-center py-6 border-b border-[#141414]/5' : 'px-8 py-4 justify-start border-b border-[#141414]/10'}
        ${active ? 'bg-[#141414] text-white' : 'hover:bg-white/60 text-[#141414]/60 hover:text-[#141414]'}`}
      title={isMinimized ? label : ""}
    >
      <div className={`${active ? 'text-white' : 'opacity-40'}`}>
        {React.cloneElement(icon as React.ReactElement, { size: isMinimized ? 20 : 18 })}
      </div>
      {!isMinimized && (
        <span className="text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap">
          {label}
        </span>
      )}
    </button>
  );
}


function QCReportView() {
  const { submitReport, syncStatus, syncError, boardData, logout, selectedBoardId } = useMonday();
  const [report, setReport] = useState<QCReport>({
    qcNo: 'QC-',
    lrNo: '',
    date: new Date().toISOString().split('T')[0],
    boxQty: '',
    rtvNoPoNo: '',
    dnDate: '',
    rtvAmount: '',
    transporter: '',
    noteNarration: '',
    partyName: '',
    state: '',
    city: '',
    rows: [],
    approvedBy: 'Alpino / Yuvraj'
  });

  const [parties, setParties] = useState<string[]>(INITIAL_PARTIES);
  const [partySearch, setPartySearch] = useState('');
  const [showPartyMenu, setShowPartyMenu] = useState(false);
  const [showTransporterMenu, setShowTransporterMenu] = useState(false);
  const [showStateMenu, setShowStateMenu] = useState(false);
  const [stateSearch, setStateSearch] = useState('');
  const [showCityMenu, setShowCityMenu] = useState(false);
  const [citySearch, setCitySearch] = useState('');

  const getAvailableCities = () => {
    if (report.state && INDIAN_CITIES_BY_STATE[report.state]) {
      return INDIAN_CITIES_BY_STATE[report.state];
    }
    return ALL_INDIAN_CITIES;
  };

  const getFilteredCities = () => {
    const list = getAvailableCities();
    return list.filter(c => c.toLowerCase().includes(citySearch.toLowerCase()));
  };

  // Persistent Parties Logic
  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(collection(db, 'masterParties'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const customParties = snapshot.docs.map(doc => doc.data().name as string);
      // Deduplicate against initial parties
      const combined = Array.from(new Set([...INITIAL_PARTIES, ...customParties])).sort();
      setParties(combined);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'masterParties');
    });
    return () => unsubscribe();
  }, [auth.currentUser]);

  const addNewParty = async (name: string) => {
    if (!name.trim()) return;
    try {
      await addDoc(collection(db, 'masterParties'), {
        name: name.trim(),
        createdAt: serverTimestamp(),
        addedBy: auth.currentUser?.uid || 'anonymous'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'masterParties');
    }
  };

  const [isSkuPickerOpen, setIsSkuPickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const skipNextSave = useRef(false);

  // Load draft on mount or board change
  useEffect(() => {
    async function loadDraft() {
      if (!selectedBoardId || !auth.currentUser) return;
      const draftPath = `qcDrafts/${selectedBoardId}`;
      try {
        const draftDoc = await getDoc(doc(db, draftPath));
        if (draftDoc.exists()) {
          const data = draftDoc.data();
          // Extract only the fields that belong to QCReport to avoid pollution
          const cleanReport: QCReport = {
            qcNo: data.qcNo || '',
            lrNo: data.lrNo || '',
            date: data.date || '',
            boxQty: data.boxQty || '',
            rtvNoPoNo: data.rtvNoPoNo || '',
            dnDate: data.dnDate || '',
            rtvAmount: data.rtvAmount || '',
            transporter: data.transporter || '',
            noteNarration: data.noteNarration || '',
            partyName: data.partyName || '',
            state: data.state || '',
            city: data.city || '',
            rows: data.rows || [],
            approvedBy: data.approvedBy || ''
          };
          skipNextSave.current = true;
          setReport(cleanReport);
        }
      } catch (error) {
        console.error("Error loading draft:", error);
      }
    }
    
    // Create an auth listener specifically for this view to trigger loading when auth happens
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) loadDraft();
    });

    if (auth.currentUser) {
      loadDraft();
    }
    
    return () => unsubscribe();
  }, [selectedBoardId]);

  // Save draft whenever report changes
  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    const timer = setTimeout(async () => {
      if (!selectedBoardId || !auth.currentUser) return;
      setIsSaving(true);
      const draftPath = `qcDrafts/${selectedBoardId}`;
      try {
        await setDoc(doc(db, draftPath), {
          qcNo: report.qcNo,
          lrNo: report.lrNo,
          date: report.date,
          boxQty: report.boxQty,
          rtvNoPoNo: report.rtvNoPoNo,
          dnDate: report.dnDate,
          rtvAmount: report.rtvAmount,
          transporter: report.transporter,
          noteNarration: report.noteNarration,
          partyName: report.partyName,
          state: report.state,
          city: report.city || '',
          rows: report.rows,
          approvedBy: report.approvedBy,
          boardId: selectedBoardId,
          updatedAt: serverTimestamp(),
          userId: auth.currentUser.uid
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, draftPath);
      } finally {
        setIsSaving(false);
      }
    }, 1000); // Debounce saves

    return () => clearTimeout(timer);
  }, [report, selectedBoardId]);

  // Save to permanent storage and Clear draft on successful sync
  useEffect(() => {
    if (syncStatus === 'success') {
      savePermanently();
      clearReport();
    }
  }, [syncStatus]);

  const savePermanently = async () => {
    if (!selectedBoardId || !auth.currentUser) return;
    // We use qcNo as the ID for easy lookup, or we can use a composite ID
    // User requested "access by QC number", so using qcNo as ID is good if it's unique
    const reportPath = `qcReports/${report.qcNo}`;
    try {
      await setDoc(doc(db, reportPath), {
        qcNo: report.qcNo,
        lrNo: report.lrNo,
        date: report.date,
        boxQty: report.boxQty,
        rtvNoPoNo: report.rtvNoPoNo,
        dnDate: report.dnDate,
        rtvAmount: report.rtvAmount,
        transporter: report.transporter,
        noteNarration: report.noteNarration,
        partyName: report.partyName,
        state: report.state,
        city: report.city || '',
        rows: report.rows,
        approvedBy: report.approvedBy,
        boardId: selectedBoardId,
        syncedAt: serverTimestamp(),
        userId: auth.currentUser.uid
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, reportPath);
    }
  };

  const clearReport = async () => {
    if (!selectedBoardId) return;
    const draftPath = `qcDrafts/${selectedBoardId}`;
    try {
      await deleteDoc(doc(db, draftPath));
      setReport({
        qcNo: 'QC-',
        lrNo: '',
        date: new Date().toISOString().split('T')[0],
        boxQty: '',
        rtvNoPoNo: '',
        dnDate: '',
        rtvAmount: '',
        transporter: '',
        noteNarration: '',
        partyName: '',
        state: '',
        city: '',
        rows: [],
        approvedBy: 'Alpino / Yuvraj'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, draftPath);
    }
  };

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

  const generatePdf = async (): Promise<{ blob: Blob; base64: string; filename: string } | null> => {
    const reportElement = document.getElementById('report-to-pdf');
    if (!reportElement) return null;

    // Save current status of the element to restore cleanly
    const originalWidth = reportElement.style.width;
    const originalMinWidth = reportElement.style.minWidth;
    const originalMaxWidth = reportElement.style.maxWidth;
    const hadIsGeneratingPdf = reportElement.classList.contains('is-generating-pdf');
    const hadMobileZoomOut = reportElement.classList.contains('mobile-zoom-out');

    // Force perfect desktop size layout synchronously
    reportElement.classList.add('is-generating-pdf');
    reportElement.classList.remove('mobile-zoom-out');
    reportElement.style.width = '1200px';
    reportElement.style.minWidth = '1200px';
    reportElement.style.maxWidth = '1200px';
    
    try {
      // Use htmlToImage to capture the beautifully formatted desktop-layout live element
      const imgData = await htmlToImage.toJpeg(reportElement, {
        quality: 0.98,
        backgroundColor: '#ffffff',
        pixelRatio: 2.5,
      });

      // Restore original container styles immediately after capture to avoid screen flickering
      if (!hadIsGeneratingPdf) reportElement.classList.remove('is-generating-pdf');
      if (hadMobileZoomOut) reportElement.classList.add('mobile-zoom-out');
      reportElement.style.width = originalWidth;
      reportElement.style.minWidth = originalMinWidth;
      reportElement.style.maxWidth = originalMaxWidth;

      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth(); // JSpdf A4: 210mm
      const pdfHeight = pdf.internal.pageSize.getHeight(); // JSpdf A4: 297mm

      // Configure clean margins (10mm is standard for professional documents)
      const margin = 10;
      const destWidth = pdfWidth - (margin * 2); // 190mm
      
      // Get the properties of the captured canvas image
      const imgProps = pdf.getImageProperties(imgData);
      const ratio = destWidth / imgProps.width;
      const destHeight = imgProps.height * ratio;

      const pageHeightLimit = pdfHeight - (margin * 2); // 277mm

      if (destHeight <= pageHeightLimit) {
        // Fits perfectly on a single page, clean top alignment for a professional A4 look
        const yOffset = margin;
        pdf.addImage(imgData, 'JPEG', margin, yOffset, destWidth, destHeight);
      } else {
        // Multi-page splitting! Spans multiple pages beautifully without compressing or cropping
        let heightLeft = destHeight;
        let position = margin;
        let pageNumber = 1;

        pdf.addImage(imgData, 'JPEG', margin, position, destWidth, destHeight);
        heightLeft -= pageHeightLimit;

        while (heightLeft > 0) {
          position = margin - (pageHeightLimit * pageNumber);
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', margin, position, destWidth, destHeight);
          heightLeft -= pageHeightLimit;
          pageNumber++;
        }
      }
      
      const pdfBlob = pdf.output('blob');
      const filename = `QC_Report_${report.qcNo || 'Export'}.pdf`;

      // Convert to base64
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({
            blob: pdfBlob,
            base64: reader.result as string,
            filename
          });
        };
        reader.readAsDataURL(pdfBlob);
      });
    } catch (e) {
      console.error("Error generating PDF:", e);
      // Ensure we restore original styles even on failure
      if (!hadIsGeneratingPdf) reportElement.classList.remove('is-generating-pdf');
      if (hadMobileZoomOut) reportElement.classList.add('mobile-zoom-out');
      reportElement.style.width = originalWidth;
      reportElement.style.minWidth = originalMinWidth;
      reportElement.style.maxWidth = originalMaxWidth;
      throw e;
    }
  };

  const handlePrint = async () => {
    const isMedianApp = !!((window as any).gonative || (window as any).median);
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (!isMedianApp && !isMobileDevice) {
      try {
        window.print();
        return;
      } catch (e) {
        console.error('Window print failed, falling back to PDF generation:', e);
      }
    }

    try {
      setIsGeneratingPdf(true);
      const pdfData = await generatePdf();
      if (!pdfData) return;

      const { blob, base64, filename } = pdfData;

      // 1. If GoNative / Median Printer is configured/activated
      const printer = (window as any).gonative?.printer || (window as any).median?.printer;
      if (printer && typeof printer.print === 'function') {
        printer.print({ url: base64 });
        return;
      }

      // 2. If GoNative / Median Share is active (as sharing opens native menu containing print)
      const share = (window as any).gonative?.share || (window as any).median?.share;
      if (share && typeof share.sharePage === 'function') {
        share.sharePage({ url: base64 });
        return;
      }

      // 3. Fallback to HTML5 sharing or base64 download if on generic mobile WebView
      const file = new File([blob], filename, { type: 'application/pdf' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Print QC Report - ${report.qcNo}`,
          text: `Sales Return QC Report (GRN) for ${report.partyName}`
        });
      } else {
        const link = document.createElement('a');
        link.href = base64;
        link.download = filename;
        link.click();
      }
    } catch (err) {
      console.error('Error during printing/generating PDF:', err);
      alert("Failed to initiate print. Sharing or downloading the PDF to print instead.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleShare = async () => {
    try {
      setIsGeneratingPdf(true);
      const pdfData = await generatePdf();
      if (!pdfData) return;

      const { blob, base64, filename } = pdfData;

      // 1. If GoNative / Median share bridge is present, use it for direct native sharing
      const share = (window as any).gonative?.share || (window as any).median?.share;
      if (share && typeof share.sharePage === 'function') {
        share.sharePage({ url: base64 });
        return;
      }

      // 2. Fallback to standard HTML5 navigator.share
      const file = new File([blob], filename, { type: 'application/pdf' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `QC Report - ${report.qcNo}`,
          text: `Sales Return QC Report (GRN) for ${report.partyName}`
        });
      } else {
        // 3. Fallback to base64 download (which GoNative intercepts successfully for WebView downloads)
        const link = document.createElement('a');
        link.href = base64;
        link.download = filename;
        link.click();
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Error sharing PDF:', err);
        if (navigator.share) {
          const text = `Sales Return QC Report (GRN)\nQC NO: ${report.qcNo}\nParty: ${report.partyName}`;
          await navigator.share({ title: 'QC Report', text });
        }
      }
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleSavePdf = async () => {
    try {
      setIsGeneratingPdf(true);
      const pdfData = await generatePdf();
      if (!pdfData) return;

      const { base64, filename } = pdfData;

      // Always download/save directly as fallback/primary action for direct device storage
      const link = document.createElement('a');
      link.href = base64;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error saving PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
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
            <div className="flex items-center gap-2">
              <span className="text-[10px] lg:text-xs font-black uppercase text-[#141414] truncate max-w-[150px] block">{boardData?.name || 'Local Mode'}</span>
              {isSaving && (
                <div className="flex items-center gap-1 text-[8px] font-bold text-blue-600 uppercase animate-pulse">
                  <RefreshCw size={8} className="animate-spin" />
                  Saving...
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-3 lg:gap-4">
          <button 
            onClick={handleShare}
            disabled={isGeneratingPdf}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 lg:px-6 py-2.5 lg:py-3 border border-[#141414] font-bold uppercase tracking-widest text-[9px] lg:text-[10px] hover:bg-gray-50 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] active:translate-x-1 active:translate-y-1 active:shadow-none bg-blue-50/50 disabled:opacity-50"
            title="Share PDF Report"
          >
            {isGeneratingPdf ? <Loader2 size={12} className="animate-spin" /> : <Share2 size={12} />}
            <span className="hidden sm:inline">{isGeneratingPdf ? 'Generating PDF...' : 'Share PDF Report'}</span>
            <span className="sm:hidden">{isGeneratingPdf ? '...' : 'Share'}</span>
          </button>
          <button 
            onClick={handleSavePdf}
            disabled={isGeneratingPdf}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 lg:px-6 py-2.5 lg:py-3 border border-[#141414] font-bold uppercase tracking-widest text-[9px] lg:text-[10px] hover:bg-gray-50 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] active:translate-x-1 active:translate-y-1 active:shadow-none bg-amber-50/50 disabled:opacity-50"
            title="Save QC Report to Device"
          >
            {isGeneratingPdf ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            <span className="hidden sm:inline">{isGeneratingPdf ? 'Generating PDF...' : 'Save QC'}</span>
            <span className="sm:hidden">{isGeneratingPdf ? '...' : 'Save'}</span>
          </button>
          <button 
            onClick={handlePrint}
            disabled={isGeneratingPdf}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 lg:px-6 py-2.5 lg:py-3 border border-[#141414] font-bold uppercase tracking-widest text-[9px] lg:text-[10px] hover:bg-gray-50 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-50"
            title="Print PDF Report"
          >
            {isGeneratingPdf ? <Loader2 size={12} className="animate-spin" /> : <Printer size={12} />}
            <span className="hidden sm:inline">{isGeneratingPdf ? 'Generating PDF...' : 'Print Report'}</span>
            <span className="sm:hidden">{isGeneratingPdf ? '...' : 'Print'}</span>
          </button>
          <button 
            onClick={async () => {
              await submitReport(report);
              if (syncStatus === 'success') {
                // We'll clear it inside the submitReport success block actually, 
                // but submitReport is in MondayProvider. 
                // Let's add a clear trigger.
              }
            }}
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
            onClick={clearReport}
            className="flex items-center justify-center p-2 bg-gray-100 border border-[#141414] hover:bg-red-500 hover:text-white transition-all text-red-600"
            title="Clear Current Report"
          >
            <Trash2 size={16} />
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

      <div className="flex-1 p-2 md:p-4 lg:p-8 print:p-0 overflow-y-auto custom-scrollbar">
        <div id="report-to-pdf" className="w-full max-w-5xl mx-auto bg-white border-2 border-[#141414] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] lg:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] p-2 md:p-4 lg:p-12 print:border-none print:shadow-none print:p-0 relative mobile-zoom-out">
          
          <div className="text-center py-3 md:py-6 lg:py-10 mb-4 md:mb-6 lg:mb-8 border-b-4 border-double border-[#141414] relative overflow-hidden bg-gray-50/50">
            <span className="absolute top-0 left-0 w-full h-[1px] bg-[#141414]/10" />
            <h1 className="text-base md:text-xl lg:text-4xl font-black uppercase tracking-[0.1em] md:tracking-[0.2em] lg:tracking-[0.4em] inline-block relative px-2 md:px-4">
              <span className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-full bg-[#141414]" />
              Return QC Report (GRN)
              <span className="absolute -right-2 top-1/2 -translate-y-1/2 w-1 h-full bg-[#141414]" />
            </h1>
          </div>
          
          {/* Header Metadata */}
          <div className="border-2 border-[#141414] mb-4 lg:mb-8 bg-white grid grid-cols-2 sm:grid-cols-4 col-span-full">
            {/* Cell 1: QC.NO */}
            <div className="p-2 lg:p-3 border-b-2 border-r-2 border-[#141414]">
              <label className="text-[8px] lg:text-[9px] font-black uppercase block opacity-40 lg:mb-1">QC.NO</label>
              <input type="text" value={report.qcNo} onChange={e => setReport({...report, qcNo: e.target.value})} className="w-full font-mono text-xs lg:text-sm focus:outline-none bg-transparent" />
            </div>
            {/* Cell 2: LR NO */}
            <div className="p-2 lg:p-3 border-b-2 border-[#141414] sm:border-r-2">
              <label className="text-[8px] lg:text-[9px] font-black uppercase block opacity-40 lg:mb-1">LR NO</label>
              <input type="text" value={report.lrNo} onChange={e => setReport({...report, lrNo: e.target.value})} className="w-full font-mono text-xs lg:text-sm focus:outline-none bg-transparent" />
            </div>
            {/* Cell 3: DATE */}
            <div className="p-2 lg:p-3 border-b-2 border-r-2 border-[#141414]">
              <label className="text-[8px] lg:text-[9px] font-black uppercase block opacity-40 lg:mb-1">DATE</label>
              <input type="date" value={report.date} onChange={e => setReport({...report, date: e.target.value})} className="w-full font-mono text-xs lg:text-sm focus:outline-none bg-transparent" />
            </div>
            {/* Cell 4: BOX QTY */}
            <div className="p-2 lg:p-3 border-b-2 border-[#141414]">
              <label className="text-[8px] lg:text-[9px] font-black uppercase block opacity-40 lg:mb-1">BOX QTY</label>
              <input type="text" value={report.boxQty} onChange={e => setReport({...report, boxQty: e.target.value})} className="w-full font-mono text-xs lg:text-sm focus:outline-none bg-transparent" />
            </div>

            {/* Cell 5: RTV NO/PO NO */}
            <div className="p-2 lg:p-3 border-b-2 sm:border-b-0 border-r-2 border-[#141414]">
              <label className="text-[8px] lg:text-[9px] font-black uppercase block opacity-40 lg:mb-1">RTV NO/PO NO</label>
              <input type="text" value={report.rtvNoPoNo} onChange={e => setReport({...report, rtvNoPoNo: e.target.value})} className="w-full font-mono text-xs lg:text-sm focus:outline-none bg-transparent" />
            </div>
            {/* Cell 6: DN Date */}
            <div className="p-2 lg:p-3 border-b-2 sm:border-b-0 border-[#141414] sm:border-r-2">
              <label className="text-[8px] lg:text-[9px] font-black uppercase block opacity-40 lg:mb-1">DN Date</label>
              <input type="date" value={report.dnDate} onChange={e => setReport({...report, dnDate: e.target.value})} className="w-full font-mono text-xs lg:text-sm focus:outline-none bg-transparent" />
            </div>
            {/* Cell 7: RTV Amount */}
            <div className="p-2 lg:p-3 border-b-2 sm:border-b-0 border-r-2 border-[#141414]">
              <label className="text-[8px] lg:text-[9px] font-black uppercase block opacity-40 lg:mb-1">RTV Amount</label>
              <input type="text" value={report.rtvAmount} onChange={e => setReport({...report, rtvAmount: e.target.value})} className="w-full font-mono text-xs lg:text-sm focus:outline-none bg-transparent" />
            </div>
            {/* Cell 8: Transporter */}
            <div className="p-2 lg:p-3 border-b-2 sm:border-b-0 border-[#141414] relative group">
              <label className="text-[8px] lg:text-[9px] font-black uppercase block opacity-40 lg:mb-1">Transporter</label>
              <div className="relative">
                <button 
                  onClick={() => setShowTransporterMenu(!showTransporterMenu)}
                  className="w-full font-mono text-xs lg:text-sm text-left focus:outline-none bg-transparent flex items-center justify-between"
                >
                  <span className={report.transporter ? 'text-[#141414]' : 'opacity-30'}>
                    {report.transporter || 'Select Transporter'}
                  </span>
                  <ChevronDown size={12} className={`transition-transform duration-200 ${showTransporterMenu ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {showTransporterMenu && (
                    <>
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40 bg-transparent"
                        onClick={() => setShowTransporterMenu(false)}
                      />
                      <motion.div 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="absolute left-0 top-full mt-1 w-full min-w-[160px] bg-white border-2 border-[#141414] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50 max-h-48 overflow-y-auto custom-scrollbar"
                      >
                        <button
                          onClick={() => {
                            setReport({...report, transporter: ''});
                            setShowTransporterMenu(false);
                          }}
                          className="w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-red-50 hover:text-red-600 border-b border-[#141414]/10 transition-all opacity-50 hover:opacity-100"
                        >
                          Clear Selection
                        </button>
                        {TRANSPORTERS.map(t => (
                          <button
                            key={t}
                            onClick={() => {
                              setReport({...report, transporter: t});
                              setShowTransporterMenu(false);
                            }}
                            className={`w-full text-left px-3 py-2 font-mono text-xs transition-all hover:bg-[#141414] hover:text-white
                              ${report.transporter === t ? 'bg-[#141414] text-white' : ''}`}
                          >
                            {t}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Note & Narration Row */}
            <div className="col-span-full p-2 lg:p-3 border-t-2 border-[#141414]">
              <label className="text-[8px] lg:text-[9px] font-black uppercase block opacity-40 lg:mb-1">Note & Narration</label>
              <textarea 
                rows={2} 
                value={report.noteNarration} 
                onChange={e => setReport({...report, noteNarration: e.target.value})} 
                className="w-full text-xs lg:text-sm focus:outline-none bg-transparent resize-none leading-tight" 
                placeholder="Enter any additional notes..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 border-2 border-[#141414] mb-4 md:mb-6 bg-white shrink-0">
            <div className="lg:col-span-2 p-2 lg:p-4 flex items-center gap-2 lg:gap-4 relative border-b-2 lg:border-b-0 lg:border-r-2 border-[#141414]">
              <label className="text-[10px] lg:text-[11px] font-bold uppercase whitespace-nowrap">Party Name:</label>
              <div className="flex-1 relative">
                <input 
                  type="text" 
                  value={report.partyName} 
                  onFocus={() => setShowPartyMenu(true)}
                  onChange={e => {
                    setReport({...report, partyName: e.target.value});
                    setPartySearch(e.target.value);
                    setShowPartyMenu(true);
                  }} 
                  className="w-full text-sm lg:text-base font-semibold focus:outline-none bg-transparent" 
                  placeholder="Type to search or add party..."
                />
                
                <AnimatePresence>
                  {showPartyMenu && (
                    <>
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40"
                        onClick={() => setShowPartyMenu(false)}
                      />
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute left-0 top-full mt-2 w-full max-h-60 bg-white border-2 border-[#141414] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] z-50 overflow-y-auto custom-scrollbar"
                      >
                        {/* Add New Option */}
                        {partySearch && !parties.find(p => p.toLowerCase() === partySearch.toLowerCase()) && (
                          <button
                            onClick={async () => {
                              const newParty = partySearch.trim();
                              await addNewParty(newParty);
                              setReport({...report, partyName: newParty});
                              setPartySearch('');
                              setShowPartyMenu(false);
                            }}
                            className="w-full text-left px-4 py-3 bg-blue-50 hover:bg-blue-100 border-b-2 border-[#141414] transition-all group"
                          >
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-600 block mb-1">Add New Entity (Permanent)</span>
                            <p className="text-sm font-black uppercase">{partySearch}</p>
                          </button>
                        )}

                        {/* Filtered List */}
                        {parties
                          .filter(p => !partySearch || p.toLowerCase().includes(partySearch.toLowerCase()))
                          .map(p => (
                            <button
                              key={p}
                              onClick={() => {
                                setReport({...report, partyName: p});
                                setPartySearch('');
                                setShowPartyMenu(false);
                              }}
                              className={`w-full text-left px-4 py-3 border-b border-[#141414]/10 last:border-0 transition-all hover:bg-[#141414] hover:text-white
                                ${report.partyName === p ? 'bg-[#141414] text-white' : ''}`}
                            >
                              <p className="text-sm font-bold uppercase tracking-tight">{p}</p>
                            </button>
                          ))}
                        
                        {parties.filter(p => p.toLowerCase().includes(partySearch.toLowerCase())).length === 0 && !partySearch && (
                          <div className="p-8 text-center bg-gray-50">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-30">Type to explore entities...</p>
                          </div>
                        )}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <div className="p-3 lg:p-4 flex items-center gap-3 lg:gap-4 relative group border-b-2 lg:border-b-0 lg:border-r-2 border-[#141414]">
              <label className="text-[10px] lg:text-[11px] font-bold uppercase whitespace-nowrap">State:</label>
              <div className="flex-1 relative">
                <button 
                  onClick={() => setShowStateMenu(!showStateMenu)}
                  className="w-full text-sm lg:text-base font-semibold text-left focus:outline-none bg-transparent flex items-center justify-between"
                >
                  <span className={report.state ? 'text-[#141414]' : 'opacity-30 uppercase'}>
                    {report.state || 'Select State'}
                  </span>
                  <ChevronDown size={14} className={`transition-transform duration-200 ${showStateMenu ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {showStateMenu && (
                    <>
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40 bg-transparent"
                        onClick={() => {
                          setShowStateMenu(false);
                          setStateSearch('');
                        }}
                      />
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute left-0 top-full mt-2 w-full min-w-[220px] bg-white border-2 border-[#141414] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] z-50 max-h-72 flex flex-col"
                      >
                        <div className="p-3 border-b-2 border-[#141414] sticky top-0 bg-white z-10">
                          <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" />
                            <input
                              autoFocus
                              type="text"
                              placeholder="Search State..."
                              value={stateSearch}
                              onChange={e => setStateSearch(e.target.value)}
                              className="w-full bg-[#141414]/5 border-none text-xs font-bold uppercase py-2 pl-10 pr-3 focus:outline-none placeholder:opacity-50"
                            />
                          </div>
                        </div>
                        <div className="overflow-y-auto custom-scrollbar flex-1">
                          {INDIAN_STATES.filter(s => s.toLowerCase().includes(stateSearch.toLowerCase())).length === 0 ? (
                            <div className="px-4 py-6 text-xs text-center opacity-40 font-bold uppercase tracking-widest">No states found</div>
                          ) : (
                            INDIAN_STATES.filter(s => s.toLowerCase().includes(stateSearch.toLowerCase())).map(s => (
                              <button
                                key={s}
                                onClick={() => {
                                  const stateCities = INDIAN_CITIES_BY_STATE[s] || [];
                                  const newCity = (report.city && stateCities.includes(report.city)) ? report.city : '';
                                  setReport({...report, state: s, city: newCity});
                                  setShowStateMenu(false);
                                  setStateSearch('');
                                }}
                                className={`w-full text-left px-4 py-3 text-sm font-bold uppercase transition-all hover:bg-[#141414] hover:text-white
                                  ${report.state === s ? 'bg-[#141414] text-white' : ''}`}
                              >
                                {s}
                              </button>
                            ))
                          )}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <div className="p-3 lg:p-4 flex items-center gap-3 lg:gap-4 relative group">
              <label className="text-[10px] lg:text-[11px] font-bold uppercase whitespace-nowrap">City:</label>
              <div className="flex-1 relative">
                <button 
                  onClick={() => setShowCityMenu(!showCityMenu)}
                  className="w-full text-sm lg:text-base font-semibold text-left focus:outline-none bg-transparent flex items-center justify-between"
                >
                  <span className={report.city ? 'text-[#141414]' : 'opacity-30 uppercase'}>
                    {report.city || 'Select City'}
                  </span>
                  <ChevronDown size={14} className={`transition-transform duration-200 ${showCityMenu ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {showCityMenu && (
                    <>
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40 bg-transparent"
                        onClick={() => {
                          setShowCityMenu(false);
                          setCitySearch('');
                        }}
                      />
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute left-0 top-full mt-2 w-full min-w-[220px] bg-white border-2 border-[#141414] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] z-50 max-h-72 flex flex-col"
                      >
                        <div className="p-3 border-b-2 border-[#141414] sticky top-0 bg-white z-10">
                          <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" />
                            <input
                              autoFocus
                              type="text"
                              placeholder="Search City..."
                              value={citySearch}
                              onChange={e => setCitySearch(e.target.value)}
                              className="w-full bg-[#141414]/5 border-none text-xs font-bold uppercase py-2 pl-10 pr-3 focus:outline-none placeholder:opacity-50"
                            />
                          </div>
                        </div>
                        <div className="overflow-y-auto custom-scrollbar flex-1">
                          {citySearch && !getAvailableCities().find(c => c.toLowerCase() === citySearch.toLowerCase()) && (
                            <button
                              onClick={() => {
                                setReport({...report, city: citySearch.trim()});
                                setShowCityMenu(false);
                                setCitySearch('');
                              }}
                              className="w-full text-left px-4 py-3 bg-blue-50 hover:bg-blue-100 border-b border-[#141414]/10 transition-all text-xs font-bold"
                            >
                              <span className="text-[8px] font-black uppercase text-blue-600 block mb-1">Use Custom Input</span>
                              {citySearch}
                            </button>
                          )}

                          {getFilteredCities().length === 0 ? (
                            <div className="px-4 py-6 text-xs text-center opacity-40 font-bold uppercase tracking-widest">No cities found</div>
                          ) : (
                            getFilteredCities().map(c => (
                              <button
                                key={c}
                                onClick={() => {
                                  setReport({...report, city: c});
                                  setShowCityMenu(false);
                                  setCitySearch('');
                                }}
                                className={`w-full text-left px-4 py-3 text-sm font-bold uppercase transition-all hover:bg-[#141414] hover:text-white
                                  ${report.city === c ? 'bg-[#141414] text-white' : ''}`}
                              >
                                {c}
                              </button>
                            ))
                          )}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* QC Table */}
          <div className="border-2 border-[#141414] overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse text-[9px] lg:text-[10px] min-w-[800px]">
              <thead>
                <tr className="bg-gray-100 font-bold uppercase border-b-2 border-[#141414]">
                  <th rowSpan={2} className="border-r border-b-2 border-[#141414] p-2 text-center w-10">S.No</th>
                  <th rowSpan={2} className="border-r-2 border-b-2 border-[#141414] p-2 min-w-[80px]">Old SKU</th>
                  <th rowSpan={2} className="border-r-2 border-b-2 border-[#141414] p-2 min-w-[100px]">New SKU</th>
                  <th className="border-r border-b border-[#141414] p-1 text-center">Bill Qty</th>
                  <th className="border-r border-b border-[#141414] p-1 text-center">Received</th>
                  <th className="border-r border-b border-[#141414] p-1 text-center">Not Received</th>
                  <th className="border-r border-b border-[#141414] p-1 text-center text-orange-600 bg-orange-50/50">Expired</th>
                  <th colSpan={2} className="border-r border-b border-[#141414] p-1 text-center">DAMAGE ITEM</th>
                  <th rowSpan={2} className="border-r border-b-2 border-[#141414] p-1 text-center">Use</th>
                  <th rowSpan={2} className="border-r border-b-2 border-[#141414] p-1 min-w-[80px] text-center">Batch Code</th>
                  <th className="border-r border-b border-[#141414] p-1 text-center">MFG</th>
                  <th className="border-b border-[#141414] p-1 text-center">EXP</th>
                </tr>
                <tr className="bg-gray-100 text-[8px] border-b-2 border-[#141414]">
                  <th className="border-r border-[#141414] p-1 uppercase opacity-60 text-center">Unit</th>
                  <th className="border-r border-[#141414] p-1 uppercase opacity-60 text-center">Unit</th>
                  <th className="border-r border-[#141414] p-1 uppercase opacity-60 text-center">Unit</th>
                  <th className="border-r border-[#141414] p-1 uppercase opacity-60 bg-orange-100/50 text-orange-700 text-center font-bold">Unit</th>
                  <th className="border-r border-[#141414] p-1 uppercase opacity-60 bg-green-50/50 text-center">Repairable</th>
                  <th className="border-r border-[#141414] p-1 uppercase opacity-60 bg-red-50/50 text-center">Non Repairable</th>
                  <th className="border-r border-[#141414] p-1 uppercase opacity-40 text-center">Date</th>
                  <th className="uppercase opacity-40 text-center">Date</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.length > 0 ? (
                  report.rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-black/5 group">
                      <td className="p-2 border-r border-b border-[#141414] font-black text-center font-mono text-gray-500 bg-gray-50/50 w-10">
                        {idx + 1}
                      </td>
                      <td className="p-2 border-r-2 border-b border-[#141414] font-bold uppercase relative bg-gray-50/30">
                        {row.oldSku}
                        <button onClick={() => removeRow(idx)} className="absolute right-1 top-1/2 -translate-y-1/2 text-red-500 opacity-0 group-hover:opacity-100 print:hidden p-1">
                          <Trash2 size={12} />
                        </button>
                      </td>
                      <td className="p-2 border-r-2 border-b border-[#141414] font-mono text-[9px] uppercase">{row.newSku}</td>
                      <td className="border-r border-b border-[#141414] p-0"><input type="number" value={row.billQtyUnit || ''} onChange={e => updateRow(idx, { billQtyUnit: parseInt(e.target.value) || 0 })} className="w-full p-2 text-center focus:outline-none bg-transparent" /></td>
                      <td className="border-r border-b border-[#141414] p-0"><input type="number" value={row.receivedUnit || ''} onChange={e => updateRow(idx, { receivedUnit: parseInt(e.target.value) || 0 })} className="w-full p-2 text-center focus:outline-none bg-transparent" /></td>
                      <td className="border-r border-b border-[#141414] p-0"><input type="number" value={row.notReceivedUnit || ''} onChange={e => updateRow(idx, { notReceivedUnit: parseInt(e.target.value) || 0 })} className="w-full p-2 text-center focus:outline-none bg-transparent" /></td>
                      <td className="border-r border-b border-[#141414] p-0 bg-orange-50/20"><input type="number" value={row.expiredUnit || ''} onChange={e => updateRow(idx, { expiredUnit: parseInt(e.target.value) || 0 })} className="w-full p-2 text-center focus:outline-none bg-transparent font-bold text-orange-700" /></td>
                      <td className="border-r border-b border-[#141414] p-0 bg-green-50/20"><input type="number" value={row.damagesRepairable || ''} onChange={e => updateRow(idx, { damagesRepairable: parseInt(e.target.value) || 0 })} className="w-full p-2 text-center focus:outline-none bg-transparent" /></td>
                      <td className="border-r border-b border-[#141414] p-0 bg-red-50/20"><input type="number" value={row.rejectNonRepairable || ''} onChange={e => updateRow(idx, { rejectNonRepairable: parseInt(e.target.value) || 0 })} className="w-full p-2 text-center focus:outline-none bg-transparent" /></td>
                      <td className="border-r border-b border-[#141414] p-0"><input type="text" value={row.use} onChange={e => updateRow(idx, { use: e.target.value })} className="w-full p-2 text-center focus:outline-none uppercase bg-transparent" /></td>
                      <td className="border-r border-b border-[#141414] p-0"><input type="text" value={row.batchCode} onChange={e => updateRow(idx, { batchCode: e.target.value })} className="w-full p-2 text-center font-mono focus:outline-none uppercase bg-transparent" /></td>
                      <td className="border-r border-b border-[#141414] p-0"><input type="text" placeholder="MM/YY" value={row.mfgDate} onChange={e => updateRow(idx, { mfgDate: e.target.value })} className="w-full p-2 text-center text-[9px] focus:outline-none bg-transparent" /></td>
                      <td className="border-b border-[#141414] p-0"><input type="text" placeholder="MM/YY" value={row.expDate} onChange={e => updateRow(idx, { expDate: e.target.value })} className="w-full p-2 text-center text-[9px] focus:outline-none bg-transparent" /></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={13} className="p-12 border-b border-[#141414] text-center text-gray-400 italic font-serif">Add SKUs using the selector bottom right &rarr;</td>
                  </tr>
                )}
                {/* Visual padding rows */}
                {Array.from({ length: Math.max(0, 17 - report.rows.length) }).map((_, i) => (
                  <tr key={`empty-${i}`} className="h-10">
                    <td className="border-r border-b border-[#141414]/10 w-10 bg-gray-50/10"></td>
                    <td className="border-r-2 border-b border-[#141414]/10 bg-gray-50/10"></td>
                    <td className="border-r-2 border-b border-[#141414]/10"></td>
                    <td className="border-r border-b border-[#141414]/10"></td>
                    <td className="border-r border-b border-[#141414]/10"></td>
                    <td className="border-r border-b border-[#141414]/10"></td>
                    <td className="border-r border-b border-[#141414]/10"></td>
                    <td className="border-r border-b border-[#141414]/10"></td>
                    <td className="border-r border-b border-[#141414]/10"></td>
                    <td className="border-r border-b border-[#141414]/10"></td>
                    <td className="border-r border-b border-[#141414]/10"></td>
                    <td className="border-r border-b border-[#141414]/10"></td>
                    <td className="border-b border-[#141414]/10"></td>
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
            <div></div>
          </div>
        </div>
      </div>

      {/* SKU Floating Picker */}
      <div className="fixed bottom-6 right-6 lg:bottom-12 lg:right-12 z-50 flex flex-col items-end gap-4 print:hidden">
        <AnimatePresence>
          {isSkuPickerOpen && (
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="bg-white border-2 border-[#141414] p-4 lg:p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] lg:shadow-2xl w-[90vw] sm:w-80 max-h-[60vh] sm:max-h-[400px] flex flex-col"
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
  const { 
    token, setToken, region, setRegion, boards, loading, error, fetchBoards, 
    selectedBoardId, setSelectedBoardId, boardData, fetchBoardDetails,
    submitReport,
    syncStatus,
    syncError,
    activeView,
    setActiveView,
    customEmbedUrls,
    setCustomEmbedUrl,
    logout
  } = useMonday();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarMinimized, setSidebarMinimized] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
      } else {
        signInAnonymously(auth).catch(console.error);
      }
    });
    return () => unsubscribe();
  }, []);

  if (!token || !selectedBoardId) {
    return <MondaySetup />;
  }

  return (
    <div className="flex h-screen bg-[#E4E3E0] font-sans text-[#141414] print:block print:h-auto overflow-hidden">
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        isMinimized={sidebarMinimized}
        onToggleMinimize={() => setSidebarMinimized(!sidebarMinimized)}
      />
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden bg-[#141414] text-white p-4 flex items-center justify-between sticky top-0 z-50 w-full">
          <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-white/10 rounded transition-colors">
            <Menu size={20} />
          </button>
          <span className="font-black uppercase tracking-[0.2em] text-[10px]">GRN System</span>
          <div className="w-8 h-8" /> {/* Spacer */}
        </header>

        {!selectedBoardId ? (
          <div className="flex-1 bg-white flex flex-col items-center justify-center p-8 lg:p-12 text-center relative overflow-hidden w-full">
            <div className="w-20 h-20 lg:w-24 lg:h-24 border-4 border-[#141414] flex items-center justify-center mb-8 mx-auto shadow-[12px_12px_0px_0px_rgba(0,0,0,0.05)]">
              <Layout size={32} className="opacity-20 lg:size-[40]" />
            </div>
            <h2 className="font-serif italic text-2xl lg:text-3xl mb-4">QC System Standby</h2>
            <p className="text-[9px] lg:text-sm font-mono uppercase tracking-[0.2em] opacity-40 max-w-xs leading-relaxed">
              Please select a target repository from the workspace sidebar to initialize the GRN QC reporting flow.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden w-full flex justify-center">
            <motion.div 
              animate={{ 
                maxWidth: sidebarMinimized ? 1400 : '100%',
              }}
              transition={SIDEBAR_TRANSITION}
              className="h-full w-full"
            >
              {activeView === 'builder' ? (
                <QCReportView />
              ) : activeView === 'monitor' ? (
                <BoardLiveMonitor />
              ) : activeView === 'history' ? (
                <QCHistoryView />
              ) : (
                <Dashboard />
              )}
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}

function QCHistoryView() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [pdfGeneratingReport, setPdfGeneratingReport] = useState<any | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(auth.currentUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
    });
    return () => unsubscribe();
  }, []);

  // Admin Verification States
  const [isAdminVerified, setIsAdminVerified] = useState(() => {
    return localStorage.getItem('qc_admin_verified') === '1522';
  });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [pendingAction, setPendingAction] = useState<{ type: 'delete' | 'download' | 'download-pdf' | 'bulk-delete' | 'bulk-download' | 'bulk-download-pdf'; payload?: any } | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!currentUser) return;
      setLoading(true);
      try {
        const q = query(collection(db, 'qcReports'), orderBy('syncedAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const fetchedReports = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setReports(fetchedReports);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'qcReports');
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [currentUser]);

  const filteredReports = reports.filter(r => 
    (r.qcNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.partyName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.city || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredReports.length && filteredReports.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredReports.map(r => r.id)));
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === '1522') {
      setIsAdminVerified(true);
      localStorage.setItem('qc_admin_verified', '1522');
      setShowPasswordModal(false);
      setPasswordError('');
      if (pendingAction) {
        executeAdminAction(pendingAction.type, pendingAction.payload);
        setPendingAction(null);
      }
    } else {
      setPasswordError('Invalid Admin Password');
    }
  };

  const runWithAdminCheck = (actionType: 'delete' | 'download' | 'download-pdf' | 'bulk-delete' | 'bulk-download' | 'bulk-download-pdf', actionPayload?: any) => {
    if (isAdminVerified) {
      executeAdminAction(actionType, actionPayload);
    } else {
      setPendingAction({ type: actionType, payload: actionPayload });
      setPasswordInput('');
      setPasswordError('');
      setShowPasswordModal(true);
    }
  };

  const formatDate = (dateVal: any) => {
    if (!dateVal) return '';
    if (typeof dateVal === 'string') return dateVal;
    if (dateVal && typeof dateVal.toDate === 'function') {
      try {
        return dateVal.toDate().toISOString().split('T')[0];
      } catch (e) {
        console.error('Error formatting date:', e);
      }
    }
    return String(dateVal);
  };

  const generateAndDownloadHistoryPdf = async (reportData: any) => {
    setIsGeneratingPdf(true);
    try {
      setPdfGeneratingReport(reportData);
      // Wait for React to render the component into the DOM
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const reportElement = document.getElementById('history-report-to-pdf');
      if (!reportElement) {
        throw new Error("PDF layout container element not found");
      }

      // Preserve styles
      const originalWidth = reportElement.style.width;
      const originalMinWidth = reportElement.style.minWidth;
      const originalMaxWidth = reportElement.style.maxWidth;

      reportElement.classList.add('is-generating-pdf');
      reportElement.style.width = '1200px';
      reportElement.style.minWidth = '1200px';
      reportElement.style.maxWidth = '1200px';
      
      const imgData = await htmlToImage.toJpeg(reportElement, {
        quality: 0.98,
        backgroundColor: '#ffffff',
        pixelRatio: 2.5,
      });

      // Restore styles
      reportElement.classList.remove('is-generating-pdf');
      reportElement.style.width = originalWidth;
      reportElement.style.minWidth = originalMinWidth;
      reportElement.style.maxWidth = originalMaxWidth;

      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const destWidth = pdfWidth - (margin * 2);

      const imgProps = pdf.getImageProperties(imgData);
      const ratio = destWidth / imgProps.width;
      const destHeight = imgProps.height * ratio;

      const pageHeightLimit = pdfHeight - (margin * 2);

      if (destHeight <= pageHeightLimit) {
        pdf.addImage(imgData, 'JPEG', margin, margin, destWidth, destHeight);
      } else {
        let heightLeft = destHeight;
        let position = margin;
        let pageNumber = 1;

        pdf.addImage(imgData, 'JPEG', margin, position, destWidth, destHeight);
        heightLeft -= pageHeightLimit;

        while (heightLeft > 0) {
          position = margin - (pageHeightLimit * pageNumber);
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', margin, position, destWidth, destHeight);
          heightLeft -= pageHeightLimit;
          pageNumber++;
        }
      }
      
      const pdfBlob = pdf.output('blob');
      const filename = `QC_Report_${reportData.qcNo || 'Export'}.pdf`;

      // median printer check
      const printer = (window as any).gonative?.printer || (window as any).median?.printer;
      if (printer && typeof printer.print === 'function') {
        const reader = new FileReader();
        reader.onloadend = () => {
          printer.print({ url: reader.result as string });
        };
        reader.readAsDataURL(pdfBlob);
      } else {
        const reader = new FileReader();
        const promise = new Promise<void>((resolve) => {
          reader.onloadend = () => {
            const base64 = reader.result as string;
            const link = document.createElement('a');
            link.href = base64;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            resolve();
          };
        });
        reader.readAsDataURL(pdfBlob);
        await promise;
      }
    } catch (error) {
      console.error("PDF generation failed:", error);
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setPdfGeneratingReport(null);
      setIsGeneratingPdf(false);
    }
  };

  const executeAdminAction = async (type: string, payload?: any) => {
    setActionError('');
    setActionSuccess('');
    if (type === 'delete' && payload) {
      if (!window.confirm(`Are you sure you want to delete report ${payload.qcNo || 'selected'}? This action cannot be undone.`)) return;
      setIsDeleting(true);
      const docId = payload.id || payload.qcNo;
      if (!docId) {
        setActionError('Failed to delete: report identifier not found.');
        setIsDeleting(false);
        return;
      }
      try {
        await deleteDoc(doc(db, 'qcReports', docId));
        setReports(prev => prev.filter(r => r.id !== docId && r.qcNo !== docId));
        if (selectedReport && (selectedReport.id === docId || selectedReport.qcNo === docId)) {
          setSelectedReport(null);
        }
        setActionSuccess(`Report ${docId} deleted successfully.`);
      } catch (error) {
        console.error('Delete error:', error);
        setActionError(error instanceof Error ? error.message : String(error));
      } finally {
        setIsDeleting(false);
      }
    } else if (type === 'download' && payload) {
      exportToExcel(payload);
    } else if (type === 'download-pdf' && payload) {
      await generateAndDownloadHistoryPdf(payload);
    } else if (type === 'bulk-delete') {
      if (selectedIds.size === 0) return;
      if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} reports from history? This action cannot be undone.`)) return;

      setIsDeleting(true);
      try {
        const batch = writeBatch(db);
        selectedIds.forEach(id => {
          batch.delete(doc(db, 'qcReports', id));
        });
        await batch.commit();
        
        // Update local state
        setReports(prev => prev.filter(r => !selectedIds.has(r.id) && !selectedIds.has(r.qcNo)));
        setSelectedIds(new Set());
        setActionSuccess('Selected reports deleted successfully.');
      } catch (error) {
        console.error('Bulk delete error:', error);
        setActionError(error instanceof Error ? error.message : String(error));
      } finally {
        setIsDeleting(false);
      }
    } else if (type === 'bulk-download') {
      if (selectedIds.size === 0) return;
      selectedIds.forEach(id => {
        const report = reports.find(r => r.id === id || r.qcNo === id);
        if (report) {
          exportToExcel(report);
        }
      });
    } else if (type === 'bulk-download-pdf') {
      if (selectedIds.size === 0) return;
      setActionSuccess('Beginning bulk PDF download...');
      for (const id of Array.from(selectedIds)) {
        const report = reports.find(r => r.id === id || r.qcNo === id);
        if (report) {
          await generateAndDownloadHistoryPdf(report);
          await new Promise(r => setTimeout(r, 600));
        }
      }
      setActionSuccess('All selected PDFs downloaded successfully.');
    }
  };

  const exportToExcel = (report: any) => {
    const headerData = [
      ["SALES RETURN QC REPORT (GRN)"],
      ["QC NO", report.qcNo, "LR NO", report.lrNo, "DATE", report.date, "BOX QTY", report.boxQty],
      ["RTV/PO", report.rtvNoPoNo, "DN DATE", report.dnDate, "AMOUNT", report.rtvAmount, "TRANSPORTER", report.transporter],
      ["NOTE", report.noteNarration],
      ["PARTY NAME", report.partyName, "STATE", report.state, "CITY", report.city || ""],
      [""],
      ["S.NO", "OLD SKU", "NEW SKU", "BILL QTY", "RECEIVED", "NOT RECEIVED", "EXPIRED", "REPAIRABLE", "NON-REPAIRABLE", "USE", "BATCH CODE", "MFG", "EXP"]
    ];

    const rowData = report.rows.map((row: any, idx: number) => [
      idx + 1,
      row.oldSku, row.newSku, row.billQtyUnit, row.receivedUnit, row.notReceivedUnit, row.expiredUnit,
      row.damagesRepairable, row.rejectNonRepairable, row.use, row.batchCode, row.mfgDate, row.expDate
    ]);

    const footerData = [
      [""],
      ["APPROVED BY", report.approvedBy]
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([...headerData, ...rowData, ...footerData]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "QC Report");
    XLSX.writeFile(workbook, `QC_Report_${report.qcNo}.xlsx`);
  };

  const handleAdminLockToggle = () => {
    if (isAdminVerified) {
      setIsAdminVerified(false);
      localStorage.removeItem('qc_admin_verified');
    } else {
      setPendingAction(null);
      setPasswordInput('');
      setPasswordError('');
      setShowPasswordModal(true);
    }
  };

  return (
    <div className="flex-1 bg-[#F5F4F0] overflow-hidden flex flex-col h-full">
      <div className="p-6 lg:p-10 flex flex-col h-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-black uppercase tracking-tight">QC Archive</h2>
              {isAdminVerified ? (
                <button 
                  onClick={handleAdminLockToggle}
                  className="bg-green-100 hover:bg-green-200 text-green-700 border border-green-600 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest flex items-center gap-1 cursor-pointer transition-all"
                  title="Click to lock admin mode"
                >
                  ● Admin Active
                </button>
              ) : (
                <button 
                  onClick={handleAdminLockToggle}
                  className="bg-amber-100 hover:bg-amber-200 text-amber-700 border border-amber-600 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest flex items-center gap-1 cursor-pointer transition-all"
                >
                  🔒 Unlock Admin
                </button>
              )}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mt-1">System Record History (Synced to Monday)</p>
          </div>
          
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" size={16} />
            <input 
              type="text"
              placeholder="Search QC No or Party..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border-2 border-[#141414] py-3 pl-10 pr-4 text-xs font-bold uppercase focus:outline-none shadow-[4px_4px_0px_0px_rgba(20,20,20,0.1)] focus:shadow-none transition-all"
            />
          </div>
        </div>
        
        {/* Simple Notification Banner */}
        <AnimatePresence>
          {actionError && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 bg-red-55 border-2 border-red-600 text-red-700 text-xs font-bold uppercase tracking-wide flex justify-between items-center"
            >
              <span>{actionError}</span>
              <button onClick={() => setActionError('')} className="opacity-60 hover:opacity-100 cursor-pointer text-sm font-black">✕</button>
            </motion.div>
          )}
          {actionSuccess && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 bg-green-50 border-2 border-green-600 text-green-700 text-xs font-bold uppercase tracking-wide flex justify-between items-center"
            >
              <span>{actionSuccess}</span>
              <button onClick={() => setActionSuccess('')} className="opacity-60 hover:opacity-100 cursor-pointer text-sm font-black">✕</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bulk Actions Header */}
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6 p-4 bg-[#141414] text-white flex flex-col md:flex-row items-center justify-between gap-4 shadow-[8px_8px_0px_0px_rgba(20,20,20,0.2)]"
            >
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.size === filteredReports.length && filteredReports.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded-none bg-transparent border-2 border-white focus:ring-0 cursor-pointer"
                  />
                  <span className="text-[10px] font-black uppercase tracking-widest">{selectedIds.size} Records Selected</span>
                </div>
                <button 
                  onClick={() => setSelectedIds(new Set())}
                  className="text-[9px] uppercase font-bold opacity-60 hover:opacity-100"
                >
                  Deselect All
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => runWithAdminCheck('bulk-download-pdf')}
                  className="flex items-center gap-2 bg-[#2563eb] text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-[#1d4ed8] transition-all"
                >
                  <FileText size={14} /> Download Selected (PDF)
                </button>
                <button 
                  onClick={() => runWithAdminCheck('bulk-download')}
                  className="flex items-center gap-2 bg-white text-[#141414] px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:invert transition-all"
                >
                  <Download size={14} /> Download Selected (Excel)
                </button>
                <button 
                  onClick={() => runWithAdminCheck('bulk-delete')}
                  disabled={isDeleting}
                  className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50"
                >
                  <Trash2 size={14} /> {isDeleting ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <RefreshCw className="animate-spin text-[#141414]/20" size={40} />
            </div>
          ) : filteredReports.length > 0 ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 pb-8">
              {filteredReports.map(report => (
                <div 
                  key={report.id}
                  className={`bg-white border-2 border-[#141414] p-6 group hover:bg-[#141414] hover:text-white transition-all cursor-pointer relative overflow-hidden flex gap-4
                    ${selectedIds.has(report.id) ? 'bg-[#141414]/5 border-dashed ring-2 ring-[#141414] ring-inset' : ''}`}
                  onClick={() => setSelectedReport(report)}
                >
                  <div 
                    className="flex-shrink-0 pt-1" 
                    onClick={(e) => { e.stopPropagation(); toggleSelect(report.id); }}
                  >
                    <input 
                      type="checkbox" 
                      checked={selectedIds.has(report.id)}
                      onChange={() => {}} // Controlled by click on parent div
                      className="w-5 h-5 rounded-none border-2 border-[#141414] group-hover:border-white checked:bg-[#141414] group-hover:checked:bg-white focus:ring-0 cursor-pointer"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="absolute right-0 top-0 w-24 h-24 bg-[#141414]/5 -translate-y-1/2 translate-x-1/2 rotate-45 group-hover:bg-white/10" />
                    
                    <div className="flex justify-between items-start mb-6">
                      <div className="space-y-1">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40 group-hover:opacity-60">Record ID</span>
                        <h4 className="text-xl font-black uppercase tracking-tight">{report.qcNo}</h4>
                      </div>
                      <div className="flex items-center gap-2 relative z-10">
                        <button 
                          onClick={(e) => { e.stopPropagation(); runWithAdminCheck('download-pdf', report); }}
                          className="p-3 bg-[#2563eb] border border-transparent text-white hover:bg-[#1d4ed8] transition-all flex items-center justify-center"
                          title="Save QC (PDF)"
                        >
                          <FileText size={16} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); runWithAdminCheck('download', report); }}
                          className="p-3 bg-[#141414] text-white border border-white/20 group-hover:border-white/50 hover:bg-white hover:text-[#141414] transition-all flex items-center justify-center"
                          title="Export to Excel"
                        >
                          <Download size={16} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); runWithAdminCheck('delete', report); }}
                          className="p-3 bg-red-600 hover:bg-red-750 text-white border-none transition-all flex items-center justify-center"
                          title="Delete Report"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6 relative z-10">
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest opacity-40 group-hover:opacity-60 block mb-1">Party Name</span>
                        <p className="text-sm font-bold truncate">{report.partyName}</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest opacity-40 group-hover:opacity-60 block mb-1">Date</span>
                        <p className="text-sm font-mono">{report.date}</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest opacity-40 group-hover:opacity-60 block mb-1">Items</span>
                        <p className="text-sm font-bold">{report.rows?.length || 0} SKUs</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest opacity-40 group-hover:opacity-60 block mb-1">Synced At</span>
                        <p className="text-[10px] font-mono opacity-60">
                          {report.syncedAt instanceof Timestamp ? report.syncedAt.toDate().toLocaleString() : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center opacity-20">
              <History size={60} />
              <p className="mt-4 font-black uppercase tracking-[0.3em]">No Records Found</p>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedReport && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-10">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedReport(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white border-4 border-[#141414] w-full max-w-6xl max-h-full overflow-hidden flex flex-col z-10 shadow-[20px_20px_0px_0px_rgba(20,20,20,0.3)]"
            >
              <div className="p-6 border-b-2 border-[#141414] flex justify-between items-center bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[#141414] text-white flex items-center justify-center">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tighter">QC Report Detail</h3>
                    <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">{selectedReport.qcNo}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => runWithAdminCheck('download-pdf', selectedReport)}
                    className="flex items-center gap-2 px-6 py-2 bg-[#2563eb] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#1d4ed8] transition-all"
                  >
                    <FileText size={14} /> Save QC (PDF)
                  </button>
                  <button 
                    onClick={() => runWithAdminCheck('download', selectedReport)}
                    className="flex items-center gap-2 px-6 py-2 bg-[#141414] text-white text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all"
                  >
                    <Download size={14} /> Export Excel
                  </button>
                  <button 
                    onClick={() => runWithAdminCheck('delete', selectedReport)}
                    disabled={isDeleting}
                    className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50"
                  >
                    <Trash2 size={14} /> {isDeleting ? 'Deleting...' : 'Delete Report'}
                  </button>
                  <button 
                    onClick={() => setSelectedReport(null)}
                    className="p-2 hover:bg-red-500 hover:text-white transition-all border border-[#141414]/10"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="border-2 border-[#141414] mb-8 divide-y-2 divide-[#141414]">
                  <div className="grid grid-cols-2 lg:grid-cols-4 divide-x-2 divide-[#141414]">
                    <div className="p-4">
                      <span className="text-[9px] font-black uppercase opacity-40 block mb-1">LR Number</span>
                      <span className="font-mono font-bold">{selectedReport.lrNo}</span>
                    </div>
                    <div className="p-4">
                      <span className="text-[9px] font-black uppercase opacity-40 block mb-1">Date</span>
                      <span className="font-mono font-bold">{selectedReport.date}</span>
                    </div>
                    <div className="p-4">
                      <span className="text-[9px] font-black uppercase opacity-40 block mb-1">Box Qty</span>
                      <span className="font-mono font-bold">{selectedReport.boxQty}</span>
                    </div>
                    <div className="p-4">
                      <span className="text-[9px] font-black uppercase opacity-40 block mb-1">Approved By</span>
                      <span className="font-mono font-bold">{selectedReport.approvedBy}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 divide-x-2 divide-[#141414]">
                    <div className="p-4">
                      <span className="text-[9px] font-black uppercase opacity-40 block mb-1">RTV/PO NO</span>
                      <span className="font-mono font-bold">{selectedReport.rtvNoPoNo}</span>
                    </div>
                    <div className="p-4">
                      <span className="text-[9px] font-black uppercase opacity-40 block mb-1">DN Date</span>
                      <span className="font-mono font-bold">{selectedReport.dnDate}</span>
                    </div>
                    <div className="p-4">
                      <span className="text-[9px] font-black uppercase opacity-40 block mb-1">RTV Amount</span>
                      <span className="font-mono font-bold">{selectedReport.rtvAmount}</span>
                    </div>
                    <div className="p-4">
                      <span className="text-[9px] font-black uppercase opacity-40 block mb-1">Transporter</span>
                      <span className="font-mono font-bold">{selectedReport.transporter}</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <span className="text-[9px] font-black uppercase opacity-40 block mb-1">Note & Narration</span>
                    <p className="text-sm">{selectedReport.noteNarration || "N/A"}</p>
                  </div>
                </div>

                <div className="mb-8">
                  <div className="flex items-center gap-3 mb-4">
                    <label className="text-[11px] font-black uppercase tracking-widest">Party Name:</label>
                    <p className="text-lg font-black uppercase">{selectedReport.partyName}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-[11px] font-black uppercase tracking-widest">State:</label>
                    <p className="text-lg font-black uppercase">{selectedReport.state}</p>
                  </div>
                  {selectedReport.city && (
                    <div className="flex items-center gap-3 mt-4">
                      <label className="text-[11px] font-black uppercase tracking-widest">City:</label>
                      <p className="text-lg font-black uppercase">{selectedReport.city}</p>
                    </div>
                  )}
                </div>

                <div className="border-2 border-[#141414] overflow-x-auto">
                  <table className="w-full border-collapse text-[10px] min-w-[1000px]">
                    <thead>
                      <tr className="bg-gray-100 font-black uppercase border-b-2 border-[#141414]">
                        <th className="border-r-2 border-[#141414] p-3 text-left">SKU Mapping</th>
                        <th className="border-r border-[#141414] p-3">Bill</th>
                        <th className="border-r border-[#141414] p-3">Rcvd</th>
                        <th className="border-r border-[#141414] p-3">Not Rcvd</th>
                        <th className="border-r border-[#141414] p-3">Exp</th>
                        <th className="border-r border-[#141414] p-3">Dmg(R)</th>
                        <th className="border-r border-[#141414] p-3">Rej(NR)</th>
                        <th className="border-r border-[#141414] p-3">Use</th>
                        <th className="border-r border-[#141414] p-3">Batch</th>
                        <th className="border-r border-[#141414] p-3">MFG</th>
                        <th className="p-3">EXP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedReport.rows?.map((row: any, i: number) => (
                        <tr key={i} className="border-b border-[#141414]/10 hover:bg-gray-50">
                          <td className="p-3 border-r-2 border-[#141414]">
                            <div className="flex flex-col">
                              <span className="font-black uppercase tracking-tight">{row.oldSku}</span>
                              <span className="text-[8px] font-mono opacity-40">{row.newSku}</span>
                            </div>
                          </td>
                          <td className="border-r border-[#141414] p-3 text-center font-bold">{row.billQtyUnit}</td>
                          <td className="border-r border-[#141414] p-3 text-center font-bold">{row.receivedUnit}</td>
                          <td className="border-r border-[#141414] p-3 text-center font-bold">{row.notReceivedUnit}</td>
                          <td className="border-r border-[#141414] p-3 text-center font-bold text-orange-600">{row.expiredUnit}</td>
                          <td className="border-r border-[#141414] p-3 text-center font-bold text-green-600">{row.damagesRepairable}</td>
                          <td className="border-r border-[#141414] p-3 text-center font-bold text-red-600">{row.rejectNonRepairable}</td>
                          <td className="border-r border-[#141414] p-3 text-center uppercase">{row.use}</td>
                          <td className="border-r border-[#141414] p-3 text-center font-mono uppercase">{row.batchCode}</td>
                          <td className="border-r border-[#141414] p-3 text-center">{row.mfgDate}</td>
                          <td className="p-3 text-center">{row.expDate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Password Verification Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowPasswordModal(false);
                setPendingAction(null);
              }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white border-4 border-[#141414] w-full max-w-sm p-6 z-10 shadow-[12px_12px_0px_0px_rgba(20,20,20,1)] relative"
            >
              <button 
                onClick={() => {
                  setShowPasswordModal(false);
                  setPendingAction(null);
                }}
                className="absolute right-4 top-4 p-1 hover:bg-gray-100 transition-all border border-[#141414]/10 cursor-pointer"
              >
                <X size={16} />
              </button>

              <div className="text-center space-y-4 mb-6">
                <div className="w-12 h-12 bg-amber-500 text-white flex items-center justify-center mx-auto border-2 border-[#141414] text-xl font-bold">
                  ⚠️
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">Admin Authorization</h3>
                  <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest mt-1">Required to Delete or Download History Check</p>
                </div>
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-60 block text-center">Enter 4-Digit PIN</label>
                  <input 
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="••••"
                    maxLength={4}
                    className="w-full bg-[#f5f5f5] border-2 border-[#141414] p-3 font-mono text-center text-3xl tracking-[0.5em] focus:outline-none focus:bg-white transition-all placeholder:text-[#ccc]"
                    required
                    autoFocus
                  />
                </div>

                {passwordError && (
                  <div className="p-3 bg-red-50 border-2 border-red-600 text-red-600 text-[9px] font-black uppercase tracking-widest text-center">
                    {passwordError}
                  </div>
                )}

                <button 
                  type="submit"
                  className="w-full py-3 bg-[#141414] text-white text-[11px] font-black uppercase tracking-widest hover:invert transition-all shadow-[4px_4px_0px_0px_rgba(20,20,20,0.3)] active:shadow-none cursor-pointer"
                >
                  Verify PIN
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden container for PDF rendering */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '1200px', overflow: 'hidden' }} aria-hidden="true">
        {pdfGeneratingReport && (
          <div id="history-report-to-pdf" className="w-full bg-white border-2 border-[#141414] p-12 relative">
            
            <div className="text-center py-6 mb-8 border-b-4 border-double border-[#141414] relative overflow-hidden bg-gray-50/50">
              <span className="absolute top-0 left-0 w-full h-[1px] bg-[#141414]/10" />
              <h1 className="text-4xl font-black uppercase tracking-[0.4em] inline-block relative px-4">
                <span className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-full bg-[#141414]" />
                Return QC Report (GRN)
                <span className="absolute -right-2 top-1/2 -translate-y-1/2 w-1 h-full bg-[#141414]" />
              </h1>
            </div>
            
            {/* Header Metadata */}
            <div className="border-2 border-[#141414] mb-8 bg-white grid grid-cols-4 col-span-full">
              {/* Cell 1: QC.NO */}
              <div className="p-3 border-b-2 border-r-2 border-[#141414]">
                <label className="text-[9px] font-black uppercase block opacity-40 mb-1">QC.NO</label>
                <div className="font-mono text-sm font-bold">{pdfGeneratingReport.qcNo}</div>
              </div>
              {/* Cell 2: LR NO */}
              <div className="p-3 border-b-2 border-r-2 border-[#141414]">
                <label className="text-[9px] font-black uppercase block opacity-40 mb-1">LR NO</label>
                <div className="font-mono text-sm font-bold">{pdfGeneratingReport.lrNo}</div>
              </div>
              {/* Cell 3: DATE */}
              <div className="p-3 border-b-2 border-r-2 border-[#141414]">
                <label className="text-[9px] font-black uppercase block opacity-40 mb-1">DATE</label>
                <div className="font-mono text-sm font-bold">{formatDate(pdfGeneratingReport.date)}</div>
              </div>
              {/* Cell 4: BOX QTY */}
              <div className="p-3 border-b-2 border-[#141414]">
                <label className="text-[9px] font-black uppercase block opacity-40 mb-1">BOX QTY</label>
                <div className="font-mono text-sm font-bold">{pdfGeneratingReport.boxQty}</div>
              </div>

              {/* Cell 5: RTV NO/PO NO */}
              <div className="p-3 border-r-2 border-[#141414]">
                <label className="text-[9px] font-black uppercase block opacity-40 mb-1">RTV NO/PO NO</label>
                <div className="font-mono text-sm font-bold">{pdfGeneratingReport.rtvNoPoNo}</div>
              </div>
              {/* Cell 6: DN Date */}
              <div className="p-3 border-r-2 border-[#141414]">
                <label className="text-[9px] font-black uppercase block opacity-40 mb-1">DN Date</label>
                <div className="font-mono text-sm font-bold">{formatDate(pdfGeneratingReport.dnDate)}</div>
              </div>
              {/* Cell 7: RTV Amount */}
              <div className="p-3 border-r-2 border-[#141414]">
                <label className="text-[9px] font-black uppercase block opacity-40 mb-1">RTV Amount</label>
                <div className="font-mono text-sm font-bold">{pdfGeneratingReport.rtvAmount}</div>
              </div>
              {/* Cell 8: Transporter */}
              <div className="p-3">
                <label className="text-[9px] font-black uppercase block opacity-40 mb-1">Transporter</label>
                <div className="font-mono text-sm font-bold">{pdfGeneratingReport.transporter}</div>
              </div>

              {/* Note & Narration Row */}
              <div className="col-span-full p-3 border-t-2 border-[#141414]">
                <label className="text-[9px] font-black uppercase block opacity-40 mb-1">Note & Narration</label>
                <div className="text-sm border-none bg-transparent">{pdfGeneratingReport.noteNarration || 'N/A'}</div>
              </div>
            </div>

            <div className="grid grid-cols-4 border-2 border-[#141414] mb-6 bg-white shrink-0">
              <div className="col-span-2 p-4 flex items-center gap-4 border-r-2 border-[#141414]">
                <label className="text-[11px] font-bold uppercase whitespace-nowrap">Party Name:</label>
                <div className="text-base font-semibold font-black uppercase">{pdfGeneratingReport.partyName}</div>
              </div>
              <div className="p-4 flex items-center gap-4 border-r-2 border-[#141414]">
                <label className="text-[11px] font-bold uppercase whitespace-nowrap">State:</label>
                <div className="text-base font-semibold font-black uppercase">{pdfGeneratingReport.state}</div>
              </div>
              <div className="p-4 flex items-center gap-4">
                <label className="text-[11px] font-bold uppercase whitespace-nowrap">City:</label>
                <div className="text-base font-semibold font-black uppercase">{pdfGeneratingReport.city || ''}</div>
              </div>
            </div>

            {/* QC Table */}
            <div className="border-2 border-[#141414] overflow-x-auto">
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="bg-gray-100 font-bold uppercase border-b-2 border-[#141414]">
                    <th rowSpan={2} className="border-r border-b-2 border-[#141414] p-2 text-center w-10">S.No</th>
                    <th rowSpan={2} className="border-r-2 border-b-2 border-[#141414] p-2 min-w-[80px]">Old SKU</th>
                    <th rowSpan={2} className="border-r-2 border-b-2 border-[#141414] p-2 min-w-[100px]">New SKU</th>
                    <th className="border-r border-b border-[#141414] p-1 text-center">Bill Qty</th>
                    <th className="border-r border-b border-[#141414] p-1 text-center font-bold">Received</th>
                    <th className="border-r border-b border-[#141414] p-1 text-center font-bold">Not Received</th>
                    <th className="border-r border-b border-[#141414] p-1 text-center text-orange-600 bg-orange-50/50 font-bold">Expired</th>
                    <th colSpan={2} className="border-r border-b border-[#141414] p-1 text-center font-bold">DAMAGE ITEM</th>
                    <th rowSpan={2} className="border-r border-b-2 border-[#141414] p-1 text-center">Use</th>
                    <th rowSpan={2} className="border-r border-b-2 border-[#141414] p-1 min-w-[80px] text-center font-bold">Batch Code</th>
                    <th className="border-r border-b border-[#141414] p-1 text-center font-bold">MFG</th>
                    <th className="border-b border-[#141414] p-1 text-center font-bold">EXP</th>
                  </tr>
                  <tr className="bg-gray-100 text-[8px] border-b-2 border-[#141414]">
                    <th className="border-r border-[#141414] p-1 uppercase opacity-60 text-center font-bold">Unit</th>
                    <th className="border-r border-[#141414] p-1 uppercase opacity-60 text-center font-bold">Unit</th>
                    <th className="border-r border-[#141414] p-1 uppercase opacity-60 text-center font-bold">Unit</th>
                    <th className="border-r border-[#141414] p-1 uppercase opacity-60 bg-orange-100/50 text-orange-700 text-center font-bold">Unit</th>
                    <th className="border-r border-[#141414] p-1 uppercase opacity-60 bg-green-50/50 text-center font-bold">Repairable</th>
                    <th className="border-r border-[#141414] p-1 uppercase opacity-60 bg-red-50/50 text-center font-bold">Non Repairable</th>
                    <th className="border-r border-[#141414] p-1 uppercase opacity-40 text-center font-bold">Date</th>
                    <th className="uppercase opacity-40 text-center font-bold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {pdfGeneratingReport.rows?.map((row: any, idx: number) => (
                    <tr key={idx} className="hover:bg-black/5">
                      <td className="p-2 border-r border-b border-[#141414] font-black text-center font-mono text-gray-500 bg-gray-50/50 w-10">
                        {idx + 1}
                      </td>
                      <td className="p-2 border-r-2 border-b border-[#141414] font-bold uppercase bg-gray-50/30">
                        {row.oldSku}
                      </td>
                      <td className="p-2 border-r-2 border-b border-[#141414] font-mono text-[9px] uppercase">{row.newSku}</td>
                      <td className="border-r border-b border-[#141414] p-2 text-center font-bold">{row.billQtyUnit || 0}</td>
                      <td className="border-r border-b border-[#141414] p-2 text-center font-bold">{row.receivedUnit || 0}</td>
                      <td className="border-r border-b border-[#141414] p-2 text-center font-bold">{row.notReceivedUnit || 0}</td>
                      <td className="border-r border-b border-[#141414] p-2 text-center font-bold text-orange-700 bg-orange-50/20">{row.expiredUnit || 0}</td>
                      <td className="border-r border-b border-[#141414] p-2 text-center font-bold text-green-700 bg-green-50/20">{row.damagesRepairable || 0}</td>
                      <td className="border-r border-b border-[#141414] p-2 text-center font-bold text-red-700 bg-red-50/20">{row.rejectNonRepairable || 0}</td>
                      <td className="border-r border-b border-[#141414] p-2 text-center uppercase">{row.use || ''}</td>
                      <td className="border-r border-b border-[#141414] p-2 text-center font-mono uppercase">{row.batchCode || ''}</td>
                      <td className="border-r border-b border-[#141414] p-2 text-center text-[10px]">{row.mfgDate || ''}</td>
                      <td className="border-b border-[#141414] p-2 text-center text-[10px]">{row.expDate || ''}</td>
                    </tr>
                  ))}
                  {/* Visual padding rows */}
                  {Array.from({ length: Math.max(0, 17 - (pdfGeneratingReport.rows?.length || 0)) }).map((_, i) => (
                    <tr key={`empty-${i}`} className="h-10">
                      <td className="border-r border-b border-[#141414]/10 w-10 bg-gray-50/10"></td>
                      <td className="border-r-2 border-b border-[#141414]/10 bg-gray-50/10"></td>
                      <td className="border-r-2 border-b border-[#141414]/10"></td>
                      <td className="border-r border-b border-[#141414]/10"></td>
                      <td className="border-r border-b border-[#141414]/10"></td>
                      <td className="border-r border-b border-[#141414]/10"></td>
                      <td className="border-r border-b border-[#141414]/10"></td>
                      <td className="border-r border-b border-[#141414]/10"></td>
                      <td className="border-r border-b border-[#141414]/10"></td>
                      <td className="border-r border-b border-[#141414]/10"></td>
                      <td className="border-r border-b border-[#141414]/10"></td>
                      <td className="border-r border-b border-[#141414]/10"></td>
                      <td className="border-b border-[#141414]/10"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-8 flex justify-between items-end border-t-2 border-[#141414] pt-8 gap-6">
              <div className="flex border-2 border-[#141414] divide-x-2 divide-[#141414]">
                <div className="p-4 w-48 bg-gray-50 flex flex-col justify-between min-h-[80px]">
                  <span className="text-[9px] font-bold uppercase opacity-50">Approve By</span>
                  <span className="text-[9px] font-bold uppercase opacity-50">Signature</span>
                </div>
                <div className="p-4 flex-1 w-64 flex flex-col justify-between min-h-[80px]">
                  <div className="font-serif italic text-lg leading-relaxed">{pdfGeneratingReport.approvedBy}</div>
                </div>
              </div>
            </div>
            
          </div>
        )}
      </div>

      {isGeneratingPdf && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-md flex flex-col items-center justify-center gap-4 text-white">
          <RefreshCw className="animate-spin text-white mb-2" size={40} />
          <h3 className="text-lg font-black uppercase tracking-widest">Generating Clean PDF</h3>
          <p className="text-xs opacity-60 uppercase tracking-widest">Applying double-margins, typography pairings, and signatures...</p>
        </div>
      )}
    </div>
  );
}

function Dashboard() {
  const { boardData, token, selectedBoardId, region, logout } = useMonday();
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
        headers: { 
          'Content-Type': 'application/json', 
          'x-monday-token': token,
          'x-monday-region': region
        },
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
      
      if (response.status === 401 || JSON.stringify(result || {}).includes("Not Authenticated") || result.proxy_status === 401) {
        logout();
        return;
      }
      
      const items = result.data?.boards?.[0]?.items_page?.items || [];
      
      const parsedReports: QCReport[] = items.map((item: any) => {
        const updateBody = item.updates[0]?.body || '';
        const rows: QCRow[] = [];
        const lines = updateBody.split('\n');
        
        const qcNoMatch = updateBody.match(/\*\*QC NO:\*\*\s*(QC-\d+)/);
        const partyMatch = updateBody.match(/\*\*PARTY:\*\*\s*([^\n|]+)/);
        const stateMatch = updateBody.match(/\*\*STATE:\*\*\s*([^\n|]+)/);
        const cityMatch = updateBody.match(/\*\*CITY:\*\*\s*([^\n|]+)/);
        const dateMatch = updateBody.match(/\*\*DATE:\*\*\s*(\d{4}-\d{2}-\d{2})/);
        const boxMatch = updateBody.match(/\*\*BOX QTY:\*\*\s*(\d+)/);
        const lrMatch = updateBody.match(/\*\*LR NO:\*\*\s*([^\n|]+)/);
        const noteMatch = updateBody.match(/\*\*NOTE & NARRATION:\*\*\s*([^\n|]+)/);

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
          city: cityMatch?.[1]?.trim() || '',
          date: dateMatch?.[1] || '',
          rows,
          approvedBy: '',
          lrNo: lrMatch?.[1]?.trim() || '',
          boxQty: boxMatch?.[1] || '',
          noteNarration: noteMatch?.[1]?.trim() || ''
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
      (r.qcNo || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.partyName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.state || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.city || '').toLowerCase().includes(searchQuery.toLowerCase())
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
      const location = report.city ? `${report.state}, ${report.city}` : report.state;
      const key = `${report.partyName} (${location})`;
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
                  <p className="font-bold text-sm uppercase">{selectedQc.state}{selectedQc.city ? ` - ${selectedQc.city}` : ''}</p>
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
                    <th className="p-4 font-black w-12 text-center">S.No</th>
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
                      <td className="p-4 text-center font-mono font-black text-gray-400 bg-gray-50/50 w-12 border-r border-gray-100">{i + 1}</td>
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
              placeholder="Search QC No, Party, State, or City..."
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
                      <div className="text-[8px] opacity-40 uppercase font-medium">{r.partyName} | {r.state}{r.city ? ` - ${r.city}` : ''}</div>
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
                            if (skuRtv > acc.count) {
                              const location = report.city ? `${report.state} - ${report.city}` : report.state;
                              return { name: report.partyName, state: location, count: skuRtv };
                            }
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
  const [isSaving, setIsSaving] = useState(false);
  
  const currentEmbedUrl = (selectedBoardId && customEmbedUrls[selectedBoardId]) 
    ? customEmbedUrls[selectedBoardId]
    : `https://view.monday.com/embed/${selectedBoardId}`;

  const handleUpdateEmbed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedBoardId && tempUrl.trim()) {
      setIsSaving(true);
      // Extract URL from iframe if they pasted the whole block
      let url = tempUrl.trim();
      const match = url.match(/src="([^"]+)"/);
      if (match) url = match[1];
      
      try {
        await setCustomEmbedUrl(selectedBoardId, url);
        setIsEditingEmbed(false);
        setTempUrl('');
      } catch (error) {
        console.error("Error saving embed URL:", error);
      } finally {
        setIsSaving(false);
      }
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
              <button type="submit" disabled={isSaving} className="bg-white text-[#141414] px-8 py-3 font-black uppercase text-[10px] tracking-widest hover:invert transition-all h-[46px] disabled:opacity-50">
                {isSaving ? 'Syncing...' : 'Save to System'}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 p-2 md:p-8 overflow-hidden relative">
        <div className="w-[222%] h-[222%] md:w-full md:h-full origin-top-left mobile-zoom-out bg-white border-2 border-[#141414] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] md:shadow-[12px_12px_0px_0px_rgba(0,0,0,0.1)] overflow-hidden transition-all duration-300">
          <iframe 
            key={currentEmbedUrl} // Force reload on URL change
            src={currentEmbedUrl}
            width="100%" 
            height="100%" 
            style={{ border: 0 }}
            title="Monday Board Monitor"
            referrerPolicy="no-referrer"
            sandbox="allow-forms allow-popups allow-scripts allow-same-origin allow-downloads"
            loading="lazy"
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
