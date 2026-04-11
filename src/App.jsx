/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/no-unescaped-entities */
import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

// --- NOTIFICATION HELPERS ---
const playChime = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); 
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3); 
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5);
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) { console.warn("Audio API not supported"); }
};

let titleInterval;
const blinkTitle = (msg) => {
  clearInterval(titleInterval);
  const originalTitle = "GOD eChallan";
  let showMsg = true;
  titleInterval = setInterval(() => {
    document.title = showMsg ? msg : originalTitle;
    showMsg = !showMsg;
  }, 1000);
  
  window.addEventListener('focus', () => {
    clearInterval(titleInterval);
    document.title = originalTitle;
  }, { once: true });
};

const triggerSystemAlert = (title, body) => {
  playChime();
  blinkTitle(`🔔 ${title}`);
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body: body, icon: '/pwa-512x512.png', badge: '/pwa-512x512.png' });
  }
};

export default function App() {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false); 
  const [workerName, setWorkerName] = useState('');
  const [loginError, setLoginError] = useState('');

  const [view, setView] = useState(''); 
  const [masterItems, setMasterItems] = useState([]);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [uploadStatus, setUploadStatus] = useState('WAITING UPLOAD');
  const [ledgerData, setLedgerData] = useState([]);
  
  // PAGINATION & STOCK STATE
  const [ledgerLimit, setLedgerLimit] = useState(50);
  const [totalLedgerCount, setTotalLedgerCount] = useState(0);
  const [liveStock, setLiveStock] = useState([]);
  const [isFetchingStock, setIsFetchingStock] = useState(false);
  
  const [ledgerMonth, setLedgerMonth] = useState(new Date().getMonth());
  const [ledgerYear, setLedgerYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([new Date().getFullYear()]);
  
  const [openNoteId, setOpenNoteId] = useState(null);
  const [tempNoteText, setTempNoteText] = useState("");

  const [depotMode, setDepotMode] = useState('DISPATCH'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [qty, setQty] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState('CANS'); 
  const [depotCart, setDepotCart] = useState([]); 
  const [depotReturnNote, setDepotReturnNote] = useState(''); 
  const [pendingDepotReturns, setPendingDepotReturns] = useState({});

  const [retailMode, setRetailMode] = useState('PO'); 
  const [retailSearch, setRetailSearch] = useState('');
  const [retailQty, setRetailQty] = useState('');
  const [retailSelectedItem, setRetailSelectedItem] = useState(null);
  const [retailSelectedUnit, setRetailSelectedUnit] = useState('CANS'); 
  const [retailReturnNote, setRetailReturnNote] = useState(''); 
  const [isRetailDropdownOpen, setIsRetailDropdownOpen] = useState(false);
  const [retailCart, setRetailCart] = useState([]); 
  
  const [pendingPOs, setPendingPOs] = useState({}); 
  const [incomingDeliveries, setIncomingDeliveries] = useState({});
  const [pendingReturns, setPendingReturns] = useState({});
  const [isAdminAuth, setIsAdminAuth] = useState(false);

  const [verifyModal, setVerifyModal] = useState(null);
  const [editPOModal, setEditPOModal] = useState(null);
  const [processReturnModal, setProcessReturnModal] = useState(null);

  const monthNames = ["JAN", "FEB", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUG", "SEPT", "OCT", "NOV", "DEC"];

  useEffect(() => {
    document.title = "GOD eChallan";
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchRole(session.user.id);
      else setLoadingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchRole(session.user.id);
      else { setUserRole(null); setView(''); setIsAdminAuth(false); setLoadingAuth(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchRole(userId) {
    const { data } = await supabase.from('users').select('role').eq('id', userId).single();
    if (data) {
      const currentRole = data.role ? data.role.toLowerCase().trim() : 'unassigned';
      setUserRole(currentRole);
      fetchAvailableYears();

      if (currentRole === 'master' || currentRole === 'admin') { 
        setView('ledger'); 
        setIsAdminAuth(true); 
      } 
      else if (currentRole === 'retail') { setView('retail'); }
      else if (currentRole === 'depot') { setView('depot'); }
      else { setView('unassigned'); }
    }
    setLoadingAuth(false);
  }

  async function handleLogin(e) {
    e.preventDefault(); setLoginError(''); setIsLoggingIn(true); 
    const hiddenEmail = `${workerName.trim().toLowerCase()}@god.com.in`;
    const { data, error } = await supabase.auth.signInWithPassword({ email: hiddenEmail, password: "123456" });
    if (error) { setLoginError(`System Error: ${error.message}`); setIsLoggingIn(false); return; }
    
    if (data?.user) {
      await fetchRole(data.user.id);
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
    setIsLoggingIn(false);
  }

  const fetchAvailableYears = async () => {
    const currentYear = new Date().getFullYear();
    const { data } = await supabase.from('transactions').select('timestamp').order('timestamp', { ascending: true }).limit(1);
    if (data && data.length > 0) {
      const firstYear = new Date(data[0].timestamp).getFullYear();
      const years = [];
      for (let i = firstYear; i <= currentYear; i++) years.push(i);
      setAvailableYears(years.reverse());
    } else {
      setAvailableYears([currentYear]);
    }
  };

  const fetchMasterItems = async () => {
    const { data } = await supabase.from('master_items').select('*');
    if (data && data.length > 0) {
      setMasterItems(data); setUploadStatus(`${data.length} SKUs AVAILABLE`);
    } else {
      setMasterItems([]); setUploadStatus('WAITING UPLOAD');
    }
  };

  const fetchPendingData = async () => {
    const promises = [
      supabase.from('transactions').select('*').eq('status', 'PO_PLACED').order('timestamp', { ascending: true }),
      supabase.from('transactions').select('*').eq('status', 'DISPATCHED').order('timestamp', { ascending: false }),
      supabase.from('transactions').select('*').eq('status', 'RETURN_REQUESTED').order('timestamp', { ascending: true }),
      supabase.from('transactions').select('*').eq('status', 'RETURN_INITIATED').order('timestamp', { ascending: true })
    ];
    const results = await Promise.all(promises);
    if (results[0].data) setPendingPOs(results[0].data.reduce((acc, curr) => { (acc[curr.group_id] = acc[curr.group_id] || []).push(curr); return acc; }, {}));
    if (results[1].data) setIncomingDeliveries(results[1].data.reduce((acc, curr) => { (acc[curr.challan_no] = acc[curr.challan_no] || []).push(curr); return acc; }, {}));
    if (results[2].data) setPendingDepotReturns(results[2].data.reduce((acc, curr) => { (acc[curr.group_id] = acc[curr.group_id] || []).push(curr); return acc; }, {}));
    if (results[3].data) setPendingReturns(results[3].data.reduce((acc, curr) => { (acc[curr.challan_no] = acc[curr.challan_no] || []).push(curr); return acc; }, {}));
  };

  // PAGINATED LEDGER FETCH
  const fetchLedgerData = async () => {
    if (!session) return;
    const startDate = new Date(ledgerYear, ledgerMonth, 1).toISOString();
    const endDate = new Date(ledgerYear, ledgerMonth + 1, 0, 23, 59, 59, 999).toISOString();

    const { data, count } = await supabase.from('transactions')
      .select('*', { count: 'exact' })
      .in('status', ['ACCEPTED', 'DISPATCHED', 'RETURN_ACCEPTED'])
      .gte('timestamp', startDate)
      .lte('timestamp', endDate)
      .order('timestamp', { ascending: false })
      .limit(ledgerLimit);

    if (data) setLedgerData(data);
    if (count !== null) setTotalLedgerCount(count);
  };

  // LIVE INVENTORY FETCH
  const fetchLiveStock = async () => {
    setIsFetchingStock(true);
    const { data } = await supabase.from('transactions')
      .select('item_desc, disp_qty, req_qty, status, unit')
      .in('status', ['ACCEPTED', 'DISPATCHED', 'RETURN_ACCEPTED']);

    if (data) {
      const inventory = {};
      data.forEach(row => {
          let desc = String(row.item_desc).trim().toUpperCase();
          let q = parseInt(row.disp_qty || row.req_qty) || 0;
          if (!inventory[desc]) inventory[desc] = { qty: 0, unit: row.unit || getUnit(desc), category: getCategory(desc) };
          if (row.status === 'RETURN_ACCEPTED') inventory[desc].qty -= q;
          else inventory[desc].qty += q;
      });
      const stockArr = Object.entries(inventory).filter(([_, v]) => v.qty !== 0).map(([k, v]) => ({ desc: k, ...v })).sort((a,b) => a.category.localeCompare(b.category) || a.desc.localeCompare(b.desc));
      setLiveStock(stockArr);
    }
    setIsFetchingStock(false);
  };

  const refreshAllData = async () => {
    if (!session) return;
    await Promise.all([ fetchMasterItems(), fetchPendingData(), fetchLedgerData() ]);
  };

  useEffect(() => { refreshAllData(); }, [session, ledgerMonth, ledgerYear, ledgerLimit]);

  // --- PERSISTENT BADGE & TITLE HIGHLIGHTING ---
  useEffect(() => {
    let actionableCount = 0;
    if (userRole === 'depot') actionableCount = Object.keys(pendingPOs).length + Object.keys(pendingDepotReturns).length;
    else if (userRole === 'retail') actionableCount = Object.keys(incomingDeliveries).length;
    else if (userRole === 'admin' || userRole === 'master') actionableCount = Object.keys(pendingPOs).length + Object.keys(pendingDepotReturns).length + Object.keys(incomingDeliveries).length + Object.keys(pendingReturns).length;

    if (navigator.setAppBadge) {
      if (actionableCount > 0) navigator.setAppBadge(actionableCount).catch(() => {});
      else navigator.clearAppBadge().catch(() => {});
    }

    let persistentInterval;
    if (actionableCount > 0) {
      persistentInterval = setInterval(() => {
        if (!document.title.includes("🔔")) {
           document.title = document.title === "GOD eChallan" ? `(${actionableCount}) Action Required` : "GOD eChallan";
        }
      }, 1500);
    } else {
      if (!document.title.includes("🔔")) document.title = "GOD eChallan";
    }

    return () => { if (persistentInterval) clearInterval(persistentInterval); };
  }, [pendingPOs, pendingDepotReturns, incomingDeliveries, pendingReturns, userRole]);

  // --- REALTIME NOTIFICATIONS ---
  useEffect(() => {
    if (!session || !userRole) return;
    const channel = supabase.channel('realtime-system').on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            if (payload.new.status === 'PO_PLACED' && (userRole === 'admin' || userRole === 'master' || userRole === 'depot')) {
                triggerSystemAlert("New Order", `Order ${payload.new.group_id} has been received.`); refreshAllData();
            }
            if (payload.new.status === 'RETURN_REQUESTED' && (userRole === 'admin' || userRole === 'master' || userRole === 'retail')) {
                triggerSystemAlert("Return Request", `Return Request ${payload.new.group_id} has been submitted.`); refreshAllData();
            }
          }
          if (payload.eventType === 'UPDATE') {
             if (payload.old.status === 'PO_PLACED' && payload.new.status === 'DISPATCHED' && userRole === 'retail') {
                 triggerSystemAlert("Goods Dispatched", `Goods dispatched under Challan ${payload.new.challan_no}`); refreshAllData();
             }
             if (payload.old.status === 'RETURN_REQUESTED' && payload.new.status === 'RETURN_INITIATED' && userRole === 'depot') {
                 triggerSystemAlert("Incoming Return", `Incoming Return: ${payload.new.challan_no}`); refreshAllData();
             }
          }
          if (payload.eventType === 'DELETE' && userRole === 'retail') {
              triggerSystemAlert("Order Cancelled", "A pending item has been cancelled by the Depot."); refreshAllData();
          }
        }).subscribe();
    return () => supabase.removeChannel(channel);
  }, [session, userRole]);

  const saveAdminNote = async (keyField, keyValue) => {
    try {
      const { error } = await supabase.from('transactions').update({ admin_note: tempNoteText }).eq(keyField, keyValue);
      if (error) throw error;
      await fetchLedgerData();
      setOpenNoteId(null);
    } catch (error) { alert(`Failed to save note: ${error.message}`); }
  };

  const deleteLedgerGroup = async (keyField, keyValue) => {
    if (window.confirm(`MASTER OVERRIDE: Permanently delete all records for ${keyValue}? This cannot be undone.`)) {
      const { error } = await supabase.from('transactions').delete().eq(keyField, keyValue);
      if (error) alert(`Deletion Failed: ${error.message}`);
      else refreshAllData();
    }
  };

  const formatDate = (dateInput) => {
    const d = dateInput ? new Date(dateInput) : new Date();
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const formatTime = (dateInput) => {
    const d = dateInput ? new Date(dateInput) : new Date();
    let hours = d.getHours(); let minutes = d.getMinutes(); const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12; minutes = minutes < 10 ? '0' + minutes : minutes;
    return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  };

  const isWithin30Days = (dateStr) => {
    const txDate = new Date(dateStr); const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return txDate >= thirtyDaysAgo;
  };

  const getNextSequence = async (type) => {
    const prefix = type === 'PO' ? 'PO2627' : type === 'RT' ? 'RT2627' : type === 'RR' ? 'RR2627' : 'CN2627';
    const column = type === 'PO' || type === 'RR' ? 'group_id' : 'challan_no';
    const { data } = await supabase.from('transactions').select(column).like(column, `${prefix}%`).order(column, { ascending: false }).limit(1);
    if (data && data.length > 0 && data[0][column]) return `${prefix}${String(parseInt(data[0][column].replace(prefix, '')) + 1).padStart(3, '0')}`;
    return `${prefix}001`;
  };

  const getCategory = (desc) => {
    const item = masterItems.find(i => String(i.description).trim().toUpperCase() === String(desc).trim().toUpperCase()); 
    if (item && item.category) return item.category;
    const upperDesc = desc ? String(desc).trim().toUpperCase() : '';
    if (upperDesc.includes('TYRE') || upperDesc.includes('TUBE') || upperDesc.match(/\d{2,3}\/\d{2,3}/)) return 'TVS';
    return 'SERVO';
  };

  const getUnit = (desc) => {
    if (!desc) return ''; const upperDesc = String(desc).trim().toUpperCase(); let cat = getCategory(desc);
    if (cat === 'SERVO') {
      if (/210\s*L/i.test(desc) || /182\s*KG/i.test(desc)) return 'BRL';
      if (/50\s*L/i.test(desc)) return 'DRUM';
      if (/(7\.5|10|15|20|26)\s*(L|KG)/i.test(desc)) return 'BUC';
      return 'CANS';
    } else {
      const learned = JSON.parse(localStorage.getItem('tvsUnits') || '{}');
      if (learned[desc]) return learned[desc]; return /\bTT\b/i.test(upperDesc) ? 'SET' : 'PCS';
    }
  };

  const getDisplayQty = (desc, qty, unit) => {
    const item = masterItems.find(i => String(i.description).trim().toUpperCase() === String(desc).trim().toUpperCase());
    const isNegative = qty < 0; const absQty = Math.abs(qty); const sign = isNegative ? '- ' : '';
    if (item && item.category === 'SERVO' && item.ratio && parseFloat(item.ratio) > 1) {
        const ratio = parseInt(item.ratio); const cases = Math.floor(absQty / ratio); const cans = absQty % ratio;
        let parts = []; if (cases > 0) parts.push(`${cases} CAR`); if (cans > 0) parts.push(`${cans} ${unit}`);
        return parts.length > 0 ? sign + parts.join(' + ') : `0 ${unit}`;
    }
    return `${isNegative ? '-' : ''}${absQty || 0} ${unit}`;
  };

  const handleItemSelect = (item, setItemState, setUnitState, setSearchState, setDropdownState) => {
    setItemState(item); setSearchState(item.description); setUnitState(getUnit(item.description));
    setHighlightIndex(-1); if(setDropdownState) setDropdownState(false);
  };

  const smartSearch = (query) => {
    if (!query) return []; const terms = query.toLowerCase().split(' ').filter(Boolean);
    return masterItems.filter(item => terms.every(term => item.description.toLowerCase().includes(term))).slice(0, 50);
  };

  // --- PDF ENGINE ---
  const printPDF = (challanNo, itemsList) => {
    const doc = new jsPDF({ format: 'a5' }); const isReturn = challanNo.startsWith('RT');
    doc.setFillColor(235, 235, 235); doc.rect(5, 5, 138, 16, 'F'); 
    doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.text("GUJARAT OIL DEPOT", 74, 12, { align: "center" });
    doc.setFontSize(10); doc.text(isReturn ? "RETURN CHALLAN" : "DELIVERY CHALLAN", 74, 18, { align: "center" });
    doc.setLineWidth(0.4); doc.line(5, 21, 143, 21); doc.setFontSize(9);
    doc.text(isReturn ? `RETURN NO :` : `CHALLAN NO :`, 8, 27); doc.setFont("helvetica", "normal"); doc.text(challanNo, 32, 27);
    doc.setFont("helvetica", "bold"); doc.text(`DATE :`, 104, 27); doc.setFont("helvetica", "normal"); doc.text(formatDate(), 116, 27);
    doc.setFont("helvetica", "bold"); doc.text(`BILLED TO :`, 8, 33); doc.setFont("helvetica", "normal"); doc.text(`SOUTH GUJARAT DISTRIBUTORS`, 28, 33); doc.text(`RETAIL STORE`, 28, 38);
    const tableTop = 41; doc.setFillColor(245, 245, 245); doc.rect(5.2, tableTop + 0.2, 137.6, 6.6, 'F'); 
    doc.setLineWidth(0.4); doc.line(5, tableTop, 143, tableTop); doc.line(5, tableTop + 7, 143, tableTop + 7);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("SR", 10, tableTop + 5, { align: "center" }); doc.text("ITEM DESCRIPTION", 56, tableTop + 5, { align: "center" }); doc.text("NOS", 104, tableTop + 5, { align: "center" }); doc.text("QTY", 127.5, tableTop + 5, { align: "center" });
    doc.setFont("helvetica", "normal"); let y = tableTop + 12; let totalNos = 0;
    itemsList.forEach((item, index) => {
      const desc = item.description || item.item_desc; const splitDesc = doc.splitTextToSize(desc, 80); 
      const rawQty = parseInt(item.disp_qty || item.req_qty) || 0; totalNos += rawQty;
      const displayStr = getDisplayQty(desc, rawQty, item.unit || getUnit(desc)); const paddedQty = String(rawQty).padStart(2, '0');
      doc.text(`${index + 1}`, 10, y, { align: "center" }); doc.text(splitDesc, 17, y); 
      doc.setFont("helvetica", "bold"); doc.text(paddedQty, 104, y, { align: "center" }); doc.setFontSize(8); doc.text(displayStr, 127.5, y, { align: "center" });
      doc.setFontSize(9); doc.setFont("helvetica", "normal");
      const rowHeight = (splitDesc.length * 4) + 1;
      if (index < itemsList.length - 1) { doc.setLineWidth(0.1); doc.line(5, y + rowHeight - 2, 143, y + rowHeight - 2); }
      y += rowHeight + 2; 
    });
    const tableBottom = Math.max(y - 1, 165); doc.setFillColor(235, 235, 235); doc.rect(5.2, tableBottom + 0.2, 137.6, 5.6, 'F');
    doc.setLineWidth(0.4); doc.line(5, tableBottom, 143, tableBottom); doc.setFont("helvetica", "bold");
    doc.text("TOTAL", 92, tableBottom + 4.2, { align: "right" }); doc.text(String(totalNos).padStart(2, '0'), 104, tableBottom + 4.2, { align: "center" });
    doc.line(5, tableBottom + 6, 143, tableBottom + 6); doc.line(15, tableTop, 15, tableBottom + 6); doc.line(97, tableTop, 97, tableBottom + 6); doc.line(112, tableTop, 112, tableBottom + 6); 
    const sigY = 183; doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.text("Receiver's Signature / Stamp", 8, sigY);
    if (itemsList.length > 0 && (itemsList[0].status === 'ACCEPTED' || itemsList[0].status === 'RETURN_ACCEPTED')) {
      doc.setTextColor(0, 128, 0); doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.text("Digitally Verified", 8, sigY + 6); doc.setTextColor(0, 0, 0); 
    }
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text("For GUJARAT OIL DEPOT", 140, sigY - 6, { align: "right" });
    doc.setTextColor(0, 51, 153); doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.text("Electronically Signed Document", 140, sigY, { align: "right" });
    doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "normal"); doc.setFontSize(6); doc.text(`Auth: ${formatDate()} ${formatTime()}`, 140, sigY + 4, { align: "right" });
    doc.setLineWidth(0.4); doc.rect(5, 5, 138, 195); doc.save(`${challanNo}.pdf`);
  };

  // --- EXCEL ENGINE ---
  const downloadLedger = () => {
    if(ledgerData.length === 0) { alert(`No data to export for ${monthNames[ledgerMonth]} ${ledgerYear}.`); return; }
    const dispatchedDataObj = {}; const returnsDataObj = {};
    ledgerData.forEach(row => {
      const key = row.challan_no || row.group_id;
      if (row.status === 'RETURN_ACCEPTED') {
         if (!returnsDataObj['RETURNS']) returnsDataObj['RETURNS'] = { isReturnGroup: true, items: [], date: row.timestamp };
         returnsDataObj['RETURNS'].items.push(row);
      } else {
         if (!dispatchedDataObj[key]) dispatchedDataObj[key] = { date: row.timestamp, challan_no: row.challan_no, status: row.status, items: [], admin_note: row.admin_note };
         if (row.admin_note && !dispatchedDataObj[key].admin_note) dispatchedDataObj[key].admin_note = row.admin_note;
         dispatchedDataObj[key].items.push(row);
      }
    });

    const dispatchedGroups = Object.values(dispatchedDataObj).sort((a, b) => new Date(b.date) - new Date(a.date));
    const returnGroups = Object.values(returnsDataObj);
    const itemSummary = {};
    
    ledgerData.forEach(row => {
      const desc = String(row.item_desc).trim().toUpperCase(); const q = parseInt(row.disp_qty || row.req_qty) || 0;
      if(!itemSummary[desc]) itemSummary[desc] = { qty: 0, unit: row.unit || getUnit(desc), category: getCategory(desc) };
      if (row.status === 'RETURN_ACCEPTED') itemSummary[desc].qty -= q; else if (row.status === 'ACCEPTED' || row.status === 'DISPATCHED') itemSummary[desc].qty += q;
    });

    const summaryEntries = Object.entries(itemSummary).filter(([_, data]) => data.qty !== 0); 
    const servoEntries = summaryEntries.filter(([_, data]) => data.category === 'SERVO');
    const tvsEntries = summaryEntries.filter(([_, data]) => data.category === 'TVS');
    
    const exportTitle = `GUJARAT OIL DEPOT - TRANSACTION LEDGER (${monthNames[ledgerMonth]} ${ledgerYear})`;

    let leftRowsFlat = [];
    leftRowsFlat.push({ type: 'title', title: exportTitle, bgColor: '#d1d5db' });
    leftRowsFlat.push({ type: 'subtitle', title: `BILLED TO: SOUTH GUJARAT DISTRIBUTORS, RETAIL STORE`, bgColor: '#f3f4f6' });
    leftRowsFlat.push({ type: 'header', cols: ['DATE / TIME', 'CHALLAN NO', 'ITEM DESCRIPTION', 'NOS', 'QTY', 'ADMIN NOTE'], bgColor: '#e5e7eb' });

    let globalTxTotal = 0;
    dispatchedGroups.forEach(group => {
      let bgColor = group.status === "ACCEPTED" ? "#dcfce7" : "#dbeafe"; 
      group.items.forEach((row, i) => {
        const rawQty = parseInt(row.disp_qty || row.req_qty) || 0; globalTxTotal += rawQty;
        leftRowsFlat.push({
          type: 'data', isReturn: false, isFirst: i === 0, rowspan: group.items.length,
          date: `${formatDate(group.date)}<br style="mso-data-placement:same-cell;"/>${formatTime(group.date)}`,
          challan: group.challan_no || '-', desc: String(row.item_desc).trim().toUpperCase(), nos: String(rawQty).padStart(2, '0'),
          qty: getDisplayQty(row.item_desc, rawQty, row.unit || getUnit(row.item_desc)).toUpperCase(),
          adminNote: group.admin_note || '', color: bgColor, qtyColor: 'color: #000;' 
        });
      });
    });
    if (dispatchedGroups.length > 0) {
      leftRowsFlat.push({ type: 'global_total', color: '#d1d5db', total: String(globalTxTotal).padStart(2, '0') });
    }

    if (returnGroups.length > 0) {
      leftRowsFlat.push({ type: 'empty' });
      leftRowsFlat.push({ type: 'title', title: `GUJARAT OIL DEPOT - RETURN LEDGER (${monthNames[ledgerMonth]} ${ledgerYear})`, bgColor: '#fca5a5' });
      leftRowsFlat.push({ type: 'subtitle', title: `RETURNED BY: SOUTH GUJARAT DISTRIBUTORS, RETAIL STORE`, bgColor: '#fee2e2' });
      leftRowsFlat.push({ type: 'header', cols: ['DATE / TIME', 'RETURN NO', 'ITEM DESCRIPTION', 'NOS', 'QTY', 'REMARKS / NOTE'], bgColor: '#fecaca' });

      let globalReturnTotal = 0;
      returnGroups.forEach(group => {
        let bgColor = "#fef2f2"; 
        group.items.forEach((row, i) => {
          const rawQty = parseInt(row.disp_qty || row.req_qty) || 0; globalReturnTotal += rawQty;
          leftRowsFlat.push({
            type: 'data', isReturn: true, isFirst: i === 0, rowspan: group.items.length, 
            date: `${formatDate(row.timestamp)}<br style="mso-data-placement:same-cell;"/>${formatTime(row.timestamp)}`,
            challan: row.challan_no || '-', desc: String(row.item_desc).trim().toUpperCase(), nos: String(rawQty).padStart(2, '0'),
            qty: getDisplayQty(row.item_desc, rawQty, row.unit || getUnit(row.item_desc)).toUpperCase(),
            note: row.note || '', color: bgColor, qtyColor: 'color: #dc2626;' 
          });
        });
      });
      leftRowsFlat.push({ type: 'global_total', color: '#fca5a5', total: String(globalReturnTotal).padStart(2, '0') });
    }

    let rightRowsFlat = [];
    rightRowsFlat.push({ type: 'title', title: `ITEM WISE SUMMARY`, bgColor: '#fde047' });
    rightRowsFlat.push({ type: 'subtitle', title: `TOTAL SKUS: ${summaryEntries.length}`, bgColor: '#fef08a' });
    rightRowsFlat.push({ type: 'header', cols: ['ITEM DESCRIPTION', 'TOTAL NOS', 'CONVERTED QTY'], bgColor: '#fef9c3' });
    
    if (servoEntries.length > 0) {
        rightRowsFlat.push({ type: 'group_title', title: 'SERVO LUBRICANTS', bgColor: '#fde047' });
        let servoTotal = 0;
        servoEntries.forEach(([desc, data]) => { 
            servoTotal += data.qty;
            rightRowsFlat.push({ type: 'summary_data', desc, nos: String(data.qty).padStart(2, '0'), qty: getDisplayQty(desc, data.qty, data.unit).toUpperCase(), bgColor: '#fef9c3' }); 
        });
        rightRowsFlat.push({ type: 'summary_total', total: String(servoTotal).padStart(2, '0'), color: '#fef08a' });
    }
    if (tvsEntries.length > 0) {
        rightRowsFlat.push({ type: 'group_title', title: 'TVS TYRES & TUBES', bgColor: '#fde047' });
        let tvsTotal = 0;
        tvsEntries.forEach(([desc, data]) => { 
            tvsTotal += data.qty;
            rightRowsFlat.push({ type: 'summary_data', desc, nos: String(data.qty).padStart(2, '0'), qty: getDisplayQty(desc, data.qty, data.unit).toUpperCase(), bgColor: '#fef9c3' }); 
        });
        rightRowsFlat.push({ type: 'summary_total', total: String(tvsTotal).padStart(2, '0'), color: '#fef08a' });
    }

    const maxRows = Math.max(leftRowsFlat.length, rightRowsFlat.length);
    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"></head><body>`;
    html += `<table border="0" cellpadding="5" cellspacing="0" style="font-family: Arial, sans-serif; border-collapse: collapse; font-size: 13px; white-space: nowrap;">`;
    html += `<colgroup><col width="130" /><col width="110" /><col width="380" /><col width="50" /><col width="130" /><col width="180" /><col width="30" /><col width="380" /><col width="80" /><col width="140" /></colgroup>`;

    for(let i=0; i<maxRows; i++) {
      html += `<tr style="height: 35px;">`;
      if (i < leftRowsFlat.length) {
        const l = leftRowsFlat[i]; const spanLimit = 6;
        if (l.type === 'title') { 
            html += `<td colspan="${spanLimit}" style="background-color: ${l.bgColor}; color: #000; padding: 10px; text-align: left; border: 1px solid black; font-size: 16px; font-weight: bold; vertical-align: middle; white-space: nowrap;">${l.title}</td>`;
        } else if (l.type === 'subtitle') { 
            html += `<td colspan="${spanLimit}" style="background-color: ${l.bgColor}; color: #000; padding: 8px; text-align: left; border: 1px solid black; font-weight: bold; vertical-align: middle; white-space: nowrap;">${l.title}</td>`;
        } else if (l.type === 'header') { 
            l.cols.forEach((col, idx) => { 
                const align = (idx === 2) ? 'left' : 'center'; 
                html += `<td style="background-color: ${l.bgColor}; border: 1px solid black; padding: 8px; font-weight: bold; text-align: ${align}; color: #000; vertical-align: middle; white-space: nowrap;">${col}</td>`; 
            });
        } else if (l.type === 'data') {
            if (l.isFirst) {
                html += `<td rowspan="${l.rowspan}" style="mso-number-format:'\\@'; background-color: ${l.color}; border: 1px solid black; vertical-align: middle; text-align: center; font-weight: bold; padding: 8px; color: #000; white-space: normal; mso-style-textwrap: yes;">${l.date}</td>`;
                html += `<td rowspan="${l.rowspan}" style="mso-number-format:'\\@'; background-color: ${l.color}; border: 1px solid black; vertical-align: middle; text-align: center; font-weight: bold; padding: 8px; color: #000; white-space: nowrap;">${l.challan}</td>`;
            }
            html += `<td style="background-color: ${l.color}; border: 1px solid black; vertical-align: middle; padding: 8px; color: #000; white-space: normal; mso-style-textwrap: yes; word-wrap: break-word;">${l.desc}</td>`;
            html += `<td style="background-color: ${l.color}; border: 1px solid black; vertical-align: middle; text-align: center; font-weight: bold; padding: 8px; ${l.qtyColor} white-space: nowrap;">${l.nos}</td>`;
            html += `<td style="background-color: ${l.color}; border: 1px solid black; vertical-align: middle; font-weight: bold; padding: 8px; text-align: center; ${l.qtyColor} white-space: nowrap;">${l.qty}</td>`;
            if (l.isReturn) { 
                if (l.isFirst) html += `<td rowspan="${l.rowspan}" style="background-color: ${l.color}; border: 1px solid black; vertical-align: middle; padding: 8px; color: #000; width: 180px; max-width: 180px; white-space: normal; mso-style-textwrap: yes; word-wrap: break-word;">${l.note || ''}</td>`;
            } else { 
                if (l.isFirst) html += `<td rowspan="${l.rowspan}" style="background-color: ${l.color}; border: 1px solid black; vertical-align: middle; padding: 8px; color: #000; width: 180px; max-width: 180px; white-space: normal; mso-style-textwrap: yes; word-wrap: break-word;">${l.adminNote || ''}</td>`; 
            }
        } else if (l.type === 'global_total') {
            html += `<td colspan="3" style="background-color: ${l.color}; border: 1px solid black; padding: 8px; text-align: right; font-weight: bold; color: #000; vertical-align: middle; white-space: nowrap;">GRAND TOTAL:</td>`;
            html += `<td style="background-color: ${l.color}; border: 1px solid black; padding: 8px; text-align: center; font-weight: bold; color: #000; vertical-align: middle; white-space: nowrap;">${l.total}</td>`;
            html += `<td style="background-color: ${l.color}; border: 1px solid black; padding: 8px;"></td><td style="background-color: ${l.color}; border: 1px solid black; padding: 8px;"></td>`;
        } else if (l.type === 'empty') { html += `<td style="border: none; background-color: transparent;"></td>`.repeat(6); }
      } else { html += `<td style="border: none; background-color: transparent;"></td>`.repeat(6); }

      html += `<td style="border: none; background-color: transparent; width: 30px;"></td>`;

      if (i < rightRowsFlat.length) {
        const r = rightRowsFlat[i];
        if (r.type === 'title') { 
            html += `<td colspan="3" style="background-color: ${r.bgColor}; color: #000; padding: 10px; text-align: left; border: 1px solid black; font-size: 16px; font-weight: bold; vertical-align: middle; white-space: nowrap;">${r.title}</td>`;
        } else if (r.type === 'subtitle') { 
            html += `<td colspan="3" style="background-color: ${r.bgColor}; color: #000; padding: 8px; text-align: left; border: 1px solid black; font-weight: bold; vertical-align: middle; white-space: nowrap;">${r.title}</td>`;
        } else if (r.type === 'header') { 
            r.cols.forEach((col, idx) => { 
                const align = (idx === 0) ? 'left' : 'center'; 
                html += `<td style="background-color: ${r.bgColor}; border: 1px solid black; padding: 8px; font-weight: bold; text-align: ${align}; color: #000; vertical-align: middle; white-space: nowrap;">${col}</td>`; 
            });
        } else if (r.type === 'group_title') { 
            html += `<td colspan="3" style="background-color: ${r.bgColor}; color: #1e3a8a; padding: 8px; text-align: center; border: 1px solid black; font-weight: bold; font-size: 14px; vertical-align: middle; white-space: nowrap;">${r.title}</td>`;
        } else if (r.type === 'summary_data') {
            html += `<td style="border: 1px solid black; vertical-align: middle; padding: 8px; color: #000; background-color: ${r.bgColor}; white-space: normal; mso-style-textwrap: yes; word-wrap: break-word;">${r.desc}</td>`;
            html += `<td style="border: 1px solid black; vertical-align: middle; text-align: center; font-weight: bold; padding: 8px; color: #000; background-color: ${r.bgColor}; white-space: nowrap;">${r.nos}</td>`;
            html += `<td style="border: 1px solid black; vertical-align: middle; font-weight: bold; padding: 8px; text-align: center; color: #000; background-color: ${r.bgColor}; white-space: nowrap;">${r.qty}</td>`;
        } else if (r.type === 'summary_total') {
            html += `<td style="background-color: ${r.color}; border: 1px solid black; padding: 8px; text-align: right; font-weight: bold; color: #000; vertical-align: middle; white-space: nowrap;">GROUP TOTAL:</td>`;
            html += `<td style="background-color: ${r.color}; border: 1px solid black; padding: 8px; text-align: center; font-weight: bold; color: #000; vertical-align: middle; white-space: nowrap;">${r.total}</td>`;
            html += `<td style="background-color: ${r.color}; border: 1px solid black; padding: 8px;"></td>`;
        }
      } else { html += `<td style="border: none; background-color: transparent;"></td>`.repeat(3); }
      html += `</tr>`;
    }
    html += `</table></body></html>`;

    const blob = new Blob([html], { type: "application/vnd.ms-excel" }); const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `eChallan ${formatDate().replace(/\//g, '.')}.xls`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0]; if (!file) return; setUploadStatus('Processing...');
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result); const workbook = XLSX.read(data, { type: 'array' }); let finalItemsToUpload = [];
        const normalizeRow = (row) => { const normalized = {}; for (let key in row) normalized[key.toLowerCase().trim()] = row[key]; return normalized; };
        ['SERVO', 'TVS'].forEach(sheetName => {
          const sheet = workbook.SheetNames.find(s => s.toUpperCase() === sheetName);
          if (sheet) {
            const formatted = XLSX.utils.sheet_to_json(workbook.Sheets[sheet]).map(row => {
              const norm = normalizeRow(row); return { description: norm.description, ratio: norm.ratio || 1, category: sheetName };
            }).filter(item => item.description);
            finalItemsToUpload = [...finalItemsToUpload, ...formatted];
          }
        });
        await supabase.from('master_items').delete().neq('description', 'dummy'); 
        await supabase.from('master_items').insert(finalItemsToUpload);
        refreshAllData();
      } catch (error) { setUploadStatus(`Error`); }
    };
    reader.readAsArrayBuffer(file); 
  };

  const handleKeyDown = (e, itemsList, setSelected, setSearch, setDropdownOpen, setUnitState, listIdPrefix) => {
    if (e.key === 'ArrowDown') { 
      e.preventDefault(); setHighlightIndex(p => { const next = p < itemsList.length - 1 ? p + 1 : p; document.getElementById(`${listIdPrefix}-${next}`)?.scrollIntoView({ block: 'nearest' }); return next; }); 
    } else if (e.key === 'ArrowUp') { 
      e.preventDefault(); setHighlightIndex(p => { const next = p > 0 ? p - 1 : 0; document.getElementById(`${listIdPrefix}-${next}`)?.scrollIntoView({ block: 'nearest' }); return next; }); 
    } else if (e.key === 'Enter') {
      e.preventDefault(); if (highlightIndex >= 0 && itemsList[highlightIndex]) handleItemSelect(itemsList[highlightIndex], setSelected, setUnitState, setSearch, setDropdownOpen);
    }
  };

  // --- ACTIONS ---
  const retailFilteredItems = smartSearch(retailSearch);
  const addToRetailCart = (e) => {
    e.preventDefault(); if (!retailSelectedItem || !retailQty) return;
    setRetailCart([...retailCart, { ...retailSelectedItem, req_qty: retailQty, unit: retailSelectedUnit }]);
    setRetailSearch(''); setRetailQty(''); setRetailSelectedItem(null);
  };
  const updateRetailCartQty = (index, val) => { const updated = [...retailCart]; updated[index].req_qty = val; setRetailCart(updated); };
  const removeRetailCartItem = (index) => setRetailCart(retailCart.filter((_, i) => i !== index));

  const submitRetailAction = async () => {
    if (retailCart.length === 0) return; const isReturn = retailMode === 'RETURN'; const groupId = await getNextSequence(isReturn ? 'RT' : 'PO');
    const tx = retailCart.map(item => ({ 
      group_id: groupId, item_desc: item.description, req_qty: parseInt(item.req_qty), 
      unit: item.unit, status: isReturn ? 'RETURN_INITIATED' : 'PO_PLACED',
      challan_no: isReturn ? groupId : null, note: isReturn ? (retailReturnNote || null) : null
    }));
    const { error } = await supabase.from('transactions').insert(tx);
    if (error) { triggerSystemAlert("Submission Error", error.message); } else { 
      triggerSystemAlert(`${isReturn ? 'Return' : 'P.O.'} Submitted`, `Group ID: ${groupId}`); 
      setRetailCart([]); setRetailReturnNote(''); refreshAllData();
    }
  };

  const depotFilteredItems = smartSearch(searchQuery);
  const addToDepotCart = (e) => {
    e.preventDefault(); if (!selectedItem || !qty) return;
    setDepotCart([...depotCart, { ...selectedItem, disp_qty: qty, unit: selectedUnit }]); setSearchQuery(''); setQty(''); setSelectedItem(null);
  };
  const updateDepotCartQty = (index, val) => { const updated = [...depotCart]; updated[index].disp_qty = val; setDepotCart(updated); };
  const removeDepotCartItem = (index) => setDepotCart(depotCart.filter((_, i) => i !== index));

  const submitDepotAction = async (e) => {
    e.preventDefault(); if (depotCart.length === 0) return;
    if (depotMode === 'DISPATCH') {
      const challanNo = await getNextSequence('CN'); const groupId = 'MANUAL-' + Date.now();
      const tx = depotCart.map(item => ({ group_id: groupId, challan_no: challanNo, item_desc: item.description, disp_qty: parseInt(item.disp_qty), unit: item.unit, status: 'DISPATCHED' }));
      const { error } = await supabase.from('transactions').insert(tx);
      if (!error) { printPDF(challanNo, depotCart); setDepotCart([]); fetchPendingData(); }
    } else {
      const groupId = await getNextSequence('RR');
      const tx = depotCart.map(item => ({ 
        group_id: groupId, item_desc: item.description, req_qty: parseInt(item.disp_qty), 
        unit: item.unit, status: 'RETURN_REQUESTED', note: depotReturnNote || null 
      }));
      const { error } = await supabase.from('transactions').insert(tx);
      if (!error) { triggerSystemAlert("Return Request Submitted", `Group ID: ${groupId}`); setDepotCart([]); setDepotReturnNote(''); fetchPendingData(); }
    }
  };

  const openVerifyModal = (challanNo, items) => {
    const checks = {}; items.forEach((_, i) => checks[i] = false);
    setVerifyModal({ challanNo, items, checks, isDepotReturn: challanNo.startsWith('RT') });
  };
  const toggleVerifyCheck = (index) => setVerifyModal(prev => ({ ...prev, checks: { ...prev.checks, [index]: !prev.checks[index] } }));

  const acceptDelivery = async () => {
    if (!verifyModal) return; const newStatus = verifyModal.isDepotReturn ? 'RETURN_ACCEPTED' : 'ACCEPTED';
    const { error } = await supabase.from('transactions').update({ status: newStatus }).eq('challan_no', verifyModal.challanNo);
    if (!error) { setVerifyModal(null); refreshAllData(); }
  };

  const openEditPOModal = (groupId, items) => { setEditPOModal({ groupId, items: items.map(i => ({ ...i, edit_qty: i.req_qty })) }); };
  const handleEditPOQty = (index, val) => { const updated = [...editPOModal.items]; updated[index].edit_qty = val; setEditPOModal({ ...editPOModal, items: updated }); };
  
  const confirmDispatchPO = async () => {
    if (!editPOModal) return; const challanNo = await getNextSequence('CN'); const backorders = []; const printItems = [];
    for (const item of editPOModal.items) {
      const dispatchQty = parseInt(item.edit_qty) || 0; const reqQty = parseInt(item.req_qty);
      if (dispatchQty === 0) { await supabase.from('transactions').delete().eq('id', item.id); continue; }
      if (dispatchQty > 0) { await supabase.from('transactions').update({ status: 'DISPATCHED', challan_no: challanNo, disp_qty: dispatchQty }).eq('id', item.id); printItems.push({ ...item, disp_qty: dispatchQty }); }
      if (dispatchQty < reqQty) { const newPO = await getNextSequence('PO'); backorders.push({ group_id: newPO, item_desc: item.item_desc, req_qty: reqQty - dispatchQty, unit: item.unit, status: 'PO_PLACED' }); }
    }
    if (backorders.length > 0) await supabase.from('transactions').insert(backorders);
    if (printItems.length > 0) printPDF(challanNo, printItems);
    setEditPOModal(null); refreshAllData();
  };

  const openProcessReturnModal = (groupId, items) => { setProcessReturnModal({ groupId, items: items.map(i => ({ ...i, edit_qty: i.req_qty })) }); };
  const handleProcessReturnQty = (index, val) => { const updated = [...processReturnModal.items]; updated[index].edit_qty = val; setProcessReturnModal({ ...processReturnModal, items: updated }); };

  const confirmProcessReturnRequest = async () => {
    if (!processReturnModal) return; const challanNo = await getNextSequence('RT'); const backorders = []; const printItems = [];
    for (const item of processReturnModal.items) {
      const dispatchQty = parseInt(item.edit_qty) || 0; const reqQty = parseInt(item.req_qty);
      if (dispatchQty === 0) { await supabase.from('transactions').delete().eq('id', item.id); continue; }
      if (dispatchQty > 0) { await supabase.from('transactions').update({ status: 'RETURN_INITIATED', challan_no: challanNo, disp_qty: dispatchQty }).eq('id', item.id); printItems.push({ ...item, disp_qty: dispatchQty }); }
      if (dispatchQty < reqQty) { const newRR = await getNextSequence('RR'); backorders.push({ group_id: newRR, item_desc: item.item_desc, req_qty: reqQty - dispatchQty, unit: item.unit, status: 'RETURN_REQUESTED' }); }
    }
    if (backorders.length > 0) await supabase.from('transactions').insert(backorders);
    if (printItems.length > 0) printPDF(challanNo, printItems);
    setProcessReturnModal(null); refreshAllData();
  };

  // --- UI RENDER ---
  if (loadingAuth) return <div className="h-screen flex items-center justify-center bg-gray-200 font-bold select-none">LOADING SYSTEM...</div>;
  if (!session) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-200 font-sans select-none">
      <div className="bg-white border-2 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-sm w-full">
        <h2 className="text-2xl font-black text-center mb-6 uppercase border-b-4 border-black pb-2">GOD LOGIN</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="text" value={workerName} onChange={(e) => setWorkerName(e.target.value)} placeholder="WORKER NAME" className="w-full border-2 border-black p-4 font-bold text-center uppercase focus:bg-yellow-50 outline-none select-text" required />
          <button type="submit" disabled={isLoggingIn} className="w-full bg-black text-white py-4 font-bold uppercase border-2 border-black hover:bg-gray-800 active:translate-y-1 transition-all">{isLoggingIn ? 'VERIFYING...' : 'ACCESS DASHBOARD'}</button>
          {loginError && <p className="text-red-600 font-bold text-center text-sm uppercase">{loginError}</p>}
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-200 text-gray-900 pb-10 font-sans selection:bg-blue-200 select-none">
      <nav className="bg-gray-800 text-white border-b-2 border-black p-3 sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center font-bold uppercase text-sm">
          <span className="tracking-widest">Gujarat Oil Depot</span>
          <div className="flex gap-2 items-center">
            {userRole && (
              <div className="bg-gray-700 p-1 flex gap-1 rounded">
                {(userRole === 'admin' || userRole === 'master' || userRole === 'depot') && (
                  <button onClick={() => setView('depot')} className={`px-3 py-1.5 text-xs font-bold ${view === 'depot' ? 'bg-white text-black' : 'text-gray-300 hover:text-white'}`}>DEPOT</button>
                )}
                {(userRole === 'admin' || userRole === 'master' || userRole === 'retail') && (
                  <button onClick={() => setView('retail')} className={`px-3 py-1.5 text-xs font-bold ${view === 'retail' ? 'bg-white text-black' : 'text-gray-300 hover:text-white'}`}>RETAIL</button>
                )}
                {(userRole === 'admin' || userRole === 'master') && (
                  <button onClick={() => { setView('stock'); fetchLiveStock(); }} className={`px-3 py-1.5 text-xs font-bold ${view === 'stock' ? 'bg-white text-black' : 'text-gray-300 hover:text-white'}`}>STOCK</button>
                )}
                <button onClick={() => { setView('ledger'); setLedgerLimit(50); }} className={`px-3 py-1.5 text-xs font-bold ${view === 'ledger' ? 'bg-white text-black' : 'text-gray-300 hover:text-white'}`}>LEDGER</button>
              </div>
            )}
            <button onClick={() => supabase.auth.signOut()} className="bg-red-600 px-4 py-1.5 text-xs border border-black hover:bg-red-700">LOGOUT</button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto p-4">
        {verifyModal && (
          <div className="fixed inset-0 bg-black/75 z-50 flex justify-center items-center p-4 z-[60]">
            <div className="bg-white border-2 border-black max-w-lg w-full p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <h2 className="text-lg font-bold border-b-2 border-black pb-3 mb-4 uppercase">VERIFY GOODS: {verifyModal.challanNo}</h2>
              <div className="space-y-2 mb-6 max-h-72 overflow-y-auto pr-2">
                {verifyModal.items.map((item, idx) => (
                  <label key={idx} className={`flex items-center space-x-3 p-3 border-2 cursor-pointer transition-colors ${verifyModal.checks[idx] ? 'bg-green-100 border-green-600' : 'bg-gray-50 border-gray-300 hover:bg-gray-100'}`}>
                    <input type="checkbox" checked={verifyModal.checks[idx]} onChange={() => toggleVerifyCheck(idx)} className="w-5 h-5 cursor-pointer accent-black select-text" />
                    <span className="flex-1 text-sm font-bold text-gray-800">{item.item_desc}</span>
                    <span className="text-sm font-bold text-right whitespace-nowrap">{getDisplayQty(item.item_desc, item.disp_qty || item.req_qty, item.unit || getUnit(item.item_desc))}</span>
                  </label>
                ))}
              </div>
              <div className="flex space-x-3">
                <button onClick={() => setVerifyModal(null)} className="flex-1 border-2 border-black bg-gray-200 py-3 text-sm font-bold hover:bg-gray-300">CANCEL</button>
                <button onClick={acceptDelivery} disabled={!Object.values(verifyModal.checks).every(Boolean)} className="flex-1 border-2 border-black bg-green-700 text-white py-3 text-sm font-bold hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed">CONFIRM MATCH</button>
              </div>
            </div>
          </div>
        )}

        {editPOModal && (
          <div className="fixed inset-0 bg-black/75 z-50 flex justify-center items-center p-4 z-[60]">
            <div className="bg-white border-2 border-black max-w-xl w-full p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <h2 className="font-bold border-b-2 border-black pb-3 mb-4 uppercase text-lg">REVIEW & DISPATCH: {editPOModal.groupId}</h2>
              <div className="space-y-2 mb-6 max-h-72 overflow-y-auto pr-2">
                <div className="flex text-[13px] font-bold text-gray-500 px-2 uppercase"><span className="flex-1">ITEM DESCRIPTION</span><span className="w-20 text-center">REQ</span><span className="w-24 text-center">DISPATCH</span></div>
                {editPOModal.items.map((item, idx) => (
                  <div key={idx} className="flex items-center space-x-3 bg-gray-100 border border-gray-300 p-2">
                    <span className="flex-1 text-sm font-bold truncate" title={item.item_desc}>{item.item_desc}</span>
                    <span className="text-sm font-bold text-gray-600 w-20 text-center whitespace-nowrap">{getDisplayQty(item.item_desc, item.req_qty, item.unit)}</span>
                    <input type="number" value={item.edit_qty} onChange={(e) => handleEditPOQty(idx, e.target.value)} className="w-24 text-sm p-1.5 border-2 border-black text-center font-bold focus:bg-yellow-50 focus:outline-none select-text" />
                  </div>
                ))}
              </div>
              <div className="flex space-x-2">
                <button onClick={() => setEditPOModal(null)} className="flex-1 border-2 border-black bg-gray-200 py-3 text-sm font-bold hover:bg-gray-300">CANCEL</button>
                <button onClick={confirmDispatchPO} className="flex-1 border-2 border-black bg-blue-800 text-white py-3 text-sm font-bold hover:bg-blue-900 uppercase">Generate Challan</button>
              </div>
            </div>
          </div>
        )}

        {processReturnModal && (
          <div className="fixed inset-0 bg-black/75 z-50 flex justify-center items-center p-4 z-[60]">
            <div className="bg-white border-2 border-black max-w-xl w-full p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <h2 className="text-lg font-bold border-b-2 border-black pb-3 mb-4 uppercase text-red-800">PROCESS DEPOT REQUEST: {processReturnModal.groupId}</h2>
              <div className="space-y-2 mb-6 max-h-72 overflow-y-auto pr-2">
                <div className="flex text-[13px] font-bold text-gray-500 px-2 uppercase"><span className="flex-1">ITEM DESCRIPTION</span><span className="w-20 text-center">REQ</span><span className="w-24 text-center">DISPATCH</span></div>
                {processReturnModal.items.map((item, idx) => (
                  <div key={idx} className="flex items-center space-x-3 bg-red-50 border border-red-300 p-2">
                    <span className="flex-1 text-sm font-bold truncate" title={item.item_desc}>{item.item_desc}</span>
                    <span className="text-sm font-bold text-gray-600 w-20 text-center whitespace-nowrap">{getDisplayQty(item.item_desc, item.req_qty, item.unit)}</span>
                    <input type="number" value={item.edit_qty} onChange={(e) => handleProcessReturnQty(idx, e.target.value)} className="w-24 text-sm p-1.5 border-2 border-black text-center font-bold focus:bg-yellow-50 focus:outline-none select-text" />
                  </div>
                ))}
              </div>
              <div className="flex space-x-3">
                <button onClick={() => setProcessReturnModal(null)} className="flex-1 border-2 border-black bg-gray-200 py-3 text-sm font-bold hover:bg-gray-300">CANCEL</button>
                <button onClick={confirmProcessReturnRequest} className="flex-1 border-2 border-black bg-red-800 text-white py-3 text-sm font-bold hover:bg-red-900">GENERATE RETURN</button>
              </div>
            </div>
          </div>
        )}

        {view === 'unassigned' && (
          <div className="flex items-center justify-center mt-20">
            <div className="bg-red-100 border-2 border-red-600 p-8 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-w-md">
              <h2 className="text-xl font-black text-red-800 mb-2">NO TERMINAL ASSIGNED</h2>
              <p className="font-bold text-gray-800 text-sm">Your account does not have a valid role assigned in the database.</p>
            </div>
          </div>
        )}

        {view === 'stock' && (
          <div className="w-full bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex justify-between items-center border-b-2 border-black pb-3 mb-4">
               <h2 className="text-xl font-black uppercase tracking-wider">LIVE INVENTORY DASHBOARD</h2>
               <button onClick={fetchLiveStock} className="bg-gray-200 border border-black px-3 py-1 font-bold text-xs uppercase shadow-sm hover:bg-gray-300">↻ REFRESH</button>
            </div>
            {isFetchingStock ? (
               <p className="text-center py-10 font-bold text-gray-500 uppercase animate-pulse">Calculating Live Stock...</p>
            ) : (
               <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                 <table className="w-full text-left border-collapse text-sm">
                   <thead className="bg-yellow-100 border-b-2 border-black font-bold uppercase sticky top-0 shadow-sm text-[13px] text-yellow-900">
                     <tr>
                       <th className="p-3 border-r border-black w-32">CATEGORY</th>
                       <th className="p-3 border-r border-black">ITEM DESCRIPTION</th>
                       <th className="p-3 text-center border-r border-black w-40">NET STOCK (NOS)</th>
                       <th className="p-3 text-center w-24">UNIT</th>
                     </tr>
                   </thead>
                   <tbody>
                     {liveStock.length === 0 ? (
                        <tr><td colSpan="4" className="text-center py-6 font-bold text-gray-400">NO STOCK FOUND</td></tr>
                     ) : liveStock.map((item, idx) => (
                       <tr key={idx} className="border-b border-gray-300 hover:bg-yellow-50 font-bold text-gray-800 select-text">
                         <td className="p-3 border-r border-gray-300">{item.category}</td>
                         <td className="p-3 border-r border-gray-300 uppercase">{item.desc}</td>
                         <td className="p-3 border-r border-gray-300 text-center text-blue-800 text-base">{item.qty}</td>
                         <td className="p-3 text-center text-xs text-gray-500">{item.unit}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            )}
          </div>
        )}

        {view === 'ledger' && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white border-2 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] gap-4">
              <div className="flex items-center gap-4">
                <span className="font-black text-[13px] uppercase">{uploadStatus}</span>
                {(userRole === 'admin' || userRole === 'master') && (
                  <label className="bg-gray-200 border border-black hover:bg-gray-300 px-4 py-2 rounded-sm text-[13px] font-bold cursor-pointer">
                    UPDATE EXCEL DB <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
                  </label>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold uppercase mr-1">Ledger Month:</span>
                <select value={ledgerMonth} onChange={(e) => setLedgerMonth(Number(e.target.value))} className="border-2 border-black p-1.5 text-sm font-bold uppercase focus:outline-none cursor-pointer select-text">
                  {monthNames.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
                <select value={ledgerYear} onChange={(e) => setLedgerYear(Number(e.target.value))} className="border-2 border-black p-1.5 text-sm font-bold uppercase focus:outline-none cursor-pointer select-text">
                  {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                {(userRole === 'admin' || userRole === 'master') && (
                  <button onClick={downloadLedger} className="bg-blue-800 border-2 border-black hover:bg-blue-900 text-white px-5 py-2 font-bold text-[13px] ml-2">EXPORT EXCEL</button>
                )}
              </div>
            </div>

            <div className="bg-white border-2 border-black overflow-hidden shadow-sm">
              <div className="max-h-[65vh] overflow-y-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-gray-100 border-b-2 border-black font-bold uppercase sticky top-0 z-10 shadow-sm text-sm">
                    <tr>
                      <th className="p-3 border-r border-gray-300 w-28 text-center select-text">DATE / TIME</th>
                      <th className="p-3 border-r border-gray-300 select-text">CHALLAN NO</th>
                      <th className="p-3 border-r border-gray-300 w-1/2 select-text">ITEM DESCRIPTION</th>
                      <th className="p-3 text-center border-r border-gray-300 select-text">NOS</th>
                      <th className="p-3 text-center border-r border-gray-300 whitespace-nowrap select-text">QTY</th>
                      <th className="p-3 text-center border-r border-gray-300 w-48 select-none">ADMIN NOTE</th>
                      <th className="p-3 text-center w-20 select-none">PDF</th>
                      {userRole === 'master' && <th className="p-3 text-center w-16 select-none bg-red-100 text-red-800">DEL</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(ledgerData.reduce((acc, row) => {
                      const key = row.challan_no || row.group_id; 
                      if (!acc[key]) acc[key] = { ...row, items: [], keyValue: key, keyField: row.challan_no ? 'challan_no' : 'group_id' };
                      if (row.admin_note && !acc[key].admin_note) acc[key].admin_note = row.admin_note;
                      acc[key].items.push(row); return acc;
                    }, {})).length === 0 ? (
                      <tr><td colSpan={userRole === 'master' ? "8" : "7"} className="p-8 text-center text-gray-500 font-bold uppercase text-base">No records for {monthNames[ledgerMonth]} {ledgerYear}</td></tr>
                    ) : Object.values(ledgerData.reduce((acc, row) => {
                      const key = row.challan_no || row.group_id; 
                      if (!acc[key]) acc[key] = { ...row, items: [], keyValue: key, keyField: row.challan_no ? 'challan_no' : 'group_id' };
                      if (row.admin_note && !acc[key].admin_note) acc[key].admin_note = row.admin_note;
                      acc[key].items.push(row); return acc;
                    }, {})).sort((a, b) => new Date(b.date) - new Date(a.date)).map((group, idx) => (
                      <tr key={idx} className={`border-b border-gray-300 align-top hover:bg-gray-50 ${group.status === 'ACCEPTED' ? 'bg-green-50' : group.status === 'RETURN_ACCEPTED' ? 'bg-red-50' : 'bg-blue-50'} select-text`}>
                        <td className="p-3 border-r border-gray-300 text-center font-bold leading-tight">
                          {formatDate(group.timestamp)}<br/><span className="text-gray-600 font-normal text-[13px]">{formatTime(group.timestamp)}</span>
                        </td>
                        <td className="p-3 border-r border-gray-200 font-bold text-gray-900">
                          {group.challan_no || 'PENDING'}
                        </td>
                        <td className="p-3 border-r border-gray-200">
                          <ul className="space-y-1.5">
                            {group.items.map((i, k) => <li key={k} className="font-bold border-b border-gray-200 last:border-0 pb-1 uppercase truncate max-w-[300px] xl:max-w-[400px]" title={i.item_desc}><span className="w-1.5 h-1.5 bg-gray-400 inline-block rounded-full mr-2 mb-0.5"></span>{i.item_desc}</li>)}
                          </ul>
                        </td>
                        <td className="p-3 border-r border-gray-200 text-center">
                          <ul className="space-y-1.5">
                            {group.items.map((i, k) => <li key={k} className={`font-bold pb-1 ${group.status==='RETURN_ACCEPTED'?'text-red-900':''}`}>{group.status === 'RETURN_ACCEPTED' ? '-' : ''}{i.disp_qty || i.req_qty}</li>)}
                          </ul>
                        </td>
                        <td className="p-3 border-r border-gray-200 text-center whitespace-nowrap">
                           <ul className="space-y-1.5">
                            {group.items.map((i, k) => <li key={k} className={`font-bold pb-1 ${group.status==='RETURN_ACCEPTED'?'text-red-600':''}`}>{getDisplayQty(i.item_desc, i.disp_qty || i.req_qty, i.unit)}</li>)}
                          </ul>
                        </td>
                        <td className="p-3 border-r border-gray-200 align-top select-none">
                          {group.status !== 'RETURN_ACCEPTED' ? (
                            <div className="flex flex-col gap-2 min-w-[140px] max-w-[200px]">
                              {(userRole === 'admin' || userRole === 'master') ? (
                                openNoteId === group.keyValue ? (
                                  <div className="flex flex-col gap-1.5 w-full mt-1">
                                    <textarea
                                      className="w-full border-2 border-black p-2 text-[13px] font-bold focus:outline-none focus:bg-yellow-50 resize-none whitespace-pre-wrap break-words select-text"
                                      rows="3"
                                      value={tempNoteText}
                                      onChange={(e) => setTempNoteText(e.target.value)}
                                      placeholder="Enter note..."
                                      autoFocus
                                    />
                                    <div className="flex gap-1.5 mt-1">
                                      <button onClick={() => saveAdminNote(group.keyField, group.keyValue)} className="bg-blue-600 text-white px-2 py-1.5 text-[11px] font-bold uppercase flex-1 border-2 border-blue-800 active:translate-y-px">SAVE</button>
                                      <button onClick={() => setOpenNoteId(null)} className="bg-gray-200 text-gray-800 px-2 py-1.5 text-[11px] font-bold uppercase flex-1 border-2 border-gray-400 active:translate-y-px">CANCEL</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-start gap-1">
                                    <button 
                                      onClick={() => { setOpenNoteId(group.keyValue); setTempNoteText(group.admin_note || ""); }}
                                      className="text-[11px] px-2.5 py-1.5 border border-gray-400 rounded shadow-sm font-bold uppercase bg-white hover:bg-gray-100"
                                    >
                                      {group.admin_note ? 'EDIT NOTE' : '+ ADD NOTE'}
                                    </button>
                                    {group.admin_note && (
                                      <div className="text-[13px] font-bold text-gray-800 whitespace-pre-wrap break-words leading-tight mt-1.5">
                                        {group.admin_note}
                                      </div>
                                    )}
                                  </div>
                                )
                              ) : (
                                <div className="flex flex-col items-start gap-1">
                                  {group.admin_note ? (
                                    <div className="text-[13px] font-bold text-gray-800 whitespace-pre-wrap break-words leading-tight mt-1.5">
                                      {group.admin_note}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 text-[13px] italic mt-1.5">No Note</span>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-center text-gray-400 text-sm">-</div>
                          )}
                        </td>
                        <td className="p-3 text-center vertical-middle select-none">
                          {group.challan_no && isWithin30Days(group.timestamp) ? (
                            <button onClick={() => {
                                const fullChallanItems = ledgerData.filter(i => i.challan_no === group.challan_no);
                                printPDF(group.challan_no, fullChallanItems);
                              }} 
                              className="text-[11px] font-bold bg-white border border-gray-400 text-gray-800 hover:bg-gray-100 px-2.5 py-1.5 rounded shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-y-px active:shadow-none"
                            >
                              PDF
                            </button>
                          ) : group.challan_no ? (
                            <span className="text-[11px] text-gray-400 font-bold">LOCKED</span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        {userRole === 'master' && (
                          <td className="p-3 text-center vertical-middle select-none border-l border-red-200">
                             <button onClick={() => deleteLedgerGroup(group.keyField, group.keyValue)} className="text-xl hover:scale-110 active:scale-95 transition-transform" title="Permanently Delete Group">🗑️</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {ledgerData.length >= ledgerLimit && (
                 <div className="bg-gray-100 border-t-2 border-black p-2 flex justify-center">
                    <button onClick={() => setLedgerLimit(prev => prev + 50)} className="bg-black text-white px-6 py-2 text-xs font-bold uppercase hover:bg-gray-800 transition-colors">Load Older Records</button>
                 </div>
              )}
            </div>
          </div>
        )}

        {view === 'depot' && (
          <div className="flex flex-col md:flex-row gap-4 items-start">
            {/* Updates Section - Left on desktop, below on mobile */}
            <div className="w-full md:w-1/2 space-y-4 order-2 md:order-1">
              <div className="w-full bg-white border-2 border-gray-400 shadow-sm flex flex-col">
                <div className="bg-gray-200 border-b-2 border-gray-400 px-4 py-2.5 font-bold text-sm uppercase text-gray-800 flex justify-between items-center">
                  <span>Pending PO Inbox</span>
                  <span className="bg-gray-800 text-white px-2.5 py-0.5 rounded text-xs leading-none">{Object.keys(pendingPOs).length}</span>
                </div>
                <div className="p-4">
                  {Object.keys(pendingPOs).length === 0 ? <p className="text-[13px] text-gray-500 font-bold text-center py-6">NO PENDING ORDERS</p> : (
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                      {Object.entries(pendingPOs).map(([groupId, items]) => (
                        <div key={groupId} className="border-2 border-gray-300 bg-gray-50 p-4">
                          <div className="font-bold text-[13px] mb-3 text-gray-600 border-b border-gray-200 pb-1.5">{groupId}</div>
                          <table className="w-full mb-4 border-collapse text-sm">
                            <tbody>
                              {items.map((item, idx) => (
                                <tr key={idx} className="border-b border-gray-300 last:border-0">
                                  <td className="py-2.5 pr-2 font-medium text-gray-800 uppercase select-text">{item.item_desc}</td>
                                  <td className="py-2.5 text-right font-bold w-32 whitespace-nowrap select-text">{getDisplayQty(item.item_desc, item.req_qty, item.unit || getUnit(item.item_desc))}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <button onClick={() => openEditPOModal(groupId, items)} className="w-full bg-blue-800 hover:bg-blue-900 text-white font-bold text-[13px] py-2.5 border-2 border-blue-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none">REVIEW & DISPATCH</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="w-full bg-white border-2 border-red-400 shadow-sm flex flex-col">
                <div className="bg-red-100 border-b-2 border-red-400 px-4 py-2.5 font-bold text-sm uppercase text-red-800 flex justify-between items-center">
                  <span>Incoming Returns</span>
                  <span className="bg-red-800 text-white px-2.5 py-0.5 rounded text-xs leading-none">{Object.keys(pendingReturns).length}</span>
                </div>
                <div className="p-4 max-h-64 overflow-y-auto">
                  {Object.keys(pendingReturns).length === 0 ? <p className="text-[13px] text-gray-500 font-bold text-center py-6">NO INCOMING RETURNS</p> : (
                    <div className="space-y-4">
                      {Object.entries(pendingReturns).map(([challanNo, items]) => (
                        <div key={challanNo} className="border-2 border-red-300 bg-red-50 p-4">
                          <div className="flex justify-between items-center mb-4 border-b-2 border-red-200 pb-2">
                            <span className="font-bold text-sm text-red-900 select-text">{challanNo}</span>
                            <button onClick={() => printPDF(challanNo, items)} className="text-xs font-bold bg-white border border-gray-400 px-3 py-1.5 shadow-sm hover:bg-gray-100">VIEW DOC</button>
                          </div>
                          <button onClick={() => openVerifyModal(challanNo, items)} className="w-full bg-red-700 hover:bg-red-800 text-white font-bold text-[13px] py-2.5 border-2 border-red-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none">VERIFY & ACCEPT</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Data Entry - Right on desktop, top on mobile */}
            <div className="w-full md:w-1/2 flex flex-col gap-4 order-1 md:order-2">
              <div className="w-full bg-white border-2 border-gray-400 shadow-sm flex flex-col">
                <div className="bg-gray-200 border-b-2 border-gray-400 px-4 py-2 font-bold flex space-x-2 text-sm uppercase text-gray-800">
                  <button onClick={() => setDepotMode('DISPATCH')} className={`flex-1 py-1.5 rounded-sm border shadow-sm ${depotMode === 'DISPATCH' ? 'bg-white border-black text-black' : 'bg-gray-200 border-gray-400 text-gray-500 hover:bg-gray-300'}`}>DISPATCH GOODS</button>
                  <button onClick={() => setDepotMode('RETURN_REQUEST')} className={`flex-1 py-1.5 rounded-sm border shadow-sm ${depotMode === 'RETURN_REQUEST' ? 'bg-red-50 border-red-500 text-red-800' : 'bg-gray-200 border-gray-400 text-gray-500 hover:bg-gray-300'}`}>REQUEST RETURN</button>
                </div>
              </div>

              <form onSubmit={addToDepotCart} className="w-full bg-gray-100 border-2 border-gray-400 shadow-sm p-4">
                <div className="flex flex-col space-y-4">
                  <div className="relative">
                    <label className="block text-[13px] font-bold text-gray-700 mb-1.5">SEARCH ITEM</label>
                    <input type="text" value={searchQuery} onKeyDown={(e) => handleKeyDown(e, depotFilteredItems, setSelectedItem, setSearchQuery, null, setSelectedUnit, 'depot-item')} onChange={(e) => { setSearchQuery(e.target.value); setSelectedItem(null); setHighlightIndex(-1); }} className="w-full border-2 border-gray-400 p-3 text-sm font-bold focus:outline-none focus:border-black focus:bg-yellow-50 select-text" placeholder="TYPE TO SEARCH..." />
                    {searchQuery.length > 0 && depotFilteredItems.length > 0 && !selectedItem && (
                      <div className="absolute z-10 w-full max-h-56 overflow-y-auto bg-white border-2 border-gray-400 mt-1 shadow-xl text-sm font-bold">
                        {depotFilteredItems.map((item, i) => <div id={`depot-item-${i}`} key={i} onClick={() => handleItemSelect(item, setSelectedItem, setSelectedUnit, setSearchQuery, null)} className={`p-3 cursor-pointer border-b border-gray-200 uppercase ${highlightIndex === i ? 'bg-gray-800 text-white' : 'hover:bg-gray-100'}`}>{item.description}</div>)}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-[13px] font-bold text-gray-700 mb-1.5">QTY</label>
                      <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} className="w-full border-2 border-gray-400 p-3 text-sm font-bold focus:outline-none focus:border-black focus:bg-yellow-50 select-text" placeholder="0" />
                    </div>
                    <div className="w-32">
                      <label className="block text-[13px] font-bold text-gray-700 mb-1.5">UNIT</label>
                      {selectedItem?.category === 'TVS' ? (
                         <select value={selectedUnit} onChange={(e) => setSelectedUnit(e.target.value)} className="w-full border-2 border-gray-400 p-3 bg-white text-sm font-bold focus:outline-none cursor-pointer select-text">
                            <option value="PCS">PCS</option><option value="SET">SET</option>
                         </select>
                      ) : (
                         <input type="text" value={selectedUnit} disabled className="w-full border-2 border-gray-200 p-3 bg-gray-200 text-gray-500 text-sm font-bold select-text" />
                      )}
                    </div>
                  </div>
                  <button type="submit" className={`w-full text-white font-bold text-[13px] py-3 border-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none mt-2 ${depotMode === 'RETURN_REQUEST' ? 'bg-red-800 hover:bg-red-900 border-black' : 'bg-gray-800 hover:bg-black border-black'}`}>
                    + ADD TO {depotMode === 'RETURN_REQUEST' ? 'RETURN' : 'CART'}
                  </button>
                </div>
              </form>
              
              {depotCart.length > 0 && (
                <div className={`w-full bg-white border-2 shadow-sm flex flex-col p-4 ${depotMode === 'RETURN_REQUEST' ? 'border-red-400' : 'border-blue-400'}`}>
                  <table className="w-full border-collapse mb-4 text-sm">
                    <tbody>
                      {depotCart.map((item, idx) => (
                        <tr key={idx} className={`border-b ${depotMode === 'RETURN_REQUEST' ? 'border-red-200 hover:bg-red-50' : 'border-blue-200 hover:bg-blue-50'} last:border-0`}>
                          <td className="py-2.5 flex items-center gap-3">
                            <button onClick={() => removeDepotCartItem(idx)} className="text-red-600 bg-white border border-red-300 font-bold px-2.5 py-1 hover:bg-red-100 rounded shadow-sm">✕</button>
                            <span className="font-bold text-gray-900 uppercase select-text">{item.description}</span>
                          </td>
                          <td className="py-2.5 text-right w-48 whitespace-nowrap select-text">
                            <div className="flex items-center justify-end gap-2">
                              <input type="number" value={item.disp_qty} onChange={(e) => updateDepotCartQty(idx, e.target.value)} className={`w-20 border-2 ${depotMode === 'RETURN_REQUEST' ? 'border-red-400 focus:border-red-600' : 'border-blue-400 focus:border-blue-600'} p-1.5 text-center font-bold focus:outline-none focus:bg-yellow-50 select-text`} />
                              <span className={`font-normal text-[13px] ${depotMode === 'RETURN_REQUEST' ? 'text-red-900' : 'text-blue-900'}`}>{item.unit || getUnit(item.description)}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {depotMode === 'RETURN_REQUEST' && (
                    <input type="text" value={depotReturnNote} onChange={(e) => setDepotReturnNote(e.target.value)} placeholder="ADD OPTIONAL RETURN NOTE" className="w-full border-2 border-red-400 p-3 text-sm font-bold focus:outline-none focus:border-red-600 focus:bg-yellow-50 mb-4 select-text" />
                  )}
                  <button onClick={submitDepotAction} className={`w-full mt-auto text-white font-bold text-[13px] py-3 border-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none ${depotMode === 'RETURN_REQUEST' ? 'bg-red-700 hover:bg-red-800 border-red-900' : 'bg-blue-800 hover:bg-blue-900 border-blue-900'}`}>
                    {depotMode === 'RETURN_REQUEST' ? `SUBMIT REQUEST (${depotCart.length})` : `ISSUE CHALLAN (${depotCart.length})`}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'retail' && (
          <div className="flex flex-col md:flex-row gap-4 items-start">
            {/* Updates Section - Left on desktop, below on mobile */}
            <div className="w-full md:w-1/2 space-y-4 order-2 md:order-1">
              <div className="w-full bg-white border-2 border-gray-400 shadow-sm flex flex-col">
                <div className="bg-gray-200 border-b-2 border-gray-400 px-4 py-2.5 font-bold text-sm uppercase text-gray-800 flex justify-between items-center">
                  <span>Pending PO Inbox</span>
                  <span className="bg-gray-800 text-white px-2.5 py-0.5 rounded text-xs leading-none">{Object.keys(pendingPOs).length}</span>
                </div>
                <div className="p-4">
                  {Object.keys(pendingPOs).length === 0 ? <p className="text-[13px] text-gray-500 font-bold text-center py-6">NO PENDING ORDERS</p> : (
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                      {Object.entries(pendingPOs).map(([groupId, items]) => (
                        <div key={groupId} className="border-2 border-gray-300 bg-gray-50 p-4">
                          <div className="font-bold text-[13px] mb-3 text-gray-600 border-b border-gray-200 pb-1.5">{groupId}</div>
                          <table className="w-full mb-4 border-collapse text-sm">
                            <tbody>
                              {items.map((item, idx) => (
                                <tr key={idx} className="border-b border-gray-300 last:border-0">
                                  <td className="py-2.5 pr-2 font-medium text-gray-800 uppercase select-text">{item.item_desc}</td>
                                  <td className="py-2.5 text-right font-bold w-32 whitespace-nowrap select-text">{getDisplayQty(item.item_desc, item.req_qty, item.unit || getUnit(item.item_desc))}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <button onClick={() => openEditPOModal(groupId, items)} className="w-full bg-blue-800 hover:bg-blue-900 text-white font-bold text-[13px] py-2.5 border-2 border-blue-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none">REVIEW & DISPATCH</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="w-full bg-white border-2 border-red-400 shadow-sm flex flex-col">
                <div className="bg-red-100 border-b-2 border-red-400 px-4 py-2.5 font-bold text-sm uppercase text-red-800 flex justify-between items-center">
                  <span>Incoming Returns</span>
                  <span className="bg-red-800 text-white px-2.5 py-0.5 rounded text-xs leading-none">{Object.keys(pendingReturns).length}</span>
                </div>
                <div className="p-4 max-h-64 overflow-y-auto">
                  {Object.keys(pendingReturns).length === 0 ? <p className="text-[13px] text-gray-500 font-bold text-center py-6">NO INCOMING RETURNS</p> : (
                    <div className="space-y-4">
                      {Object.entries(pendingReturns).map(([challanNo, items]) => (
                        <div key={challanNo} className="border-2 border-red-300 bg-red-50 p-4">
                          <div className="flex justify-between items-center mb-4 border-b-2 border-red-200 pb-2">
                            <span className="font-bold text-sm text-red-900 select-text">{challanNo}</span>
                            <button onClick={() => printPDF(challanNo, items)} className="text-xs font-bold bg-white border border-gray-400 px-3 py-1.5 shadow-sm hover:bg-gray-100">VIEW DOC</button>
                          </div>
                          <button onClick={() => openVerifyModal(challanNo, items)} className="w-full bg-red-700 hover:bg-red-800 text-white font-bold text-[13px] py-2.5 border-2 border-red-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none">VERIFY & ACCEPT</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Data Entry - Right on desktop, top on mobile */}
            <div className="w-full md:w-1/2 flex flex-col gap-4 order-1 md:order-2">
              <div className="w-full bg-white border-2 border-gray-400 shadow-sm flex flex-col">
                <div className="bg-gray-200 border-b-2 border-gray-400 px-4 py-2 font-bold flex space-x-2 text-sm uppercase text-gray-800">
                  <button onClick={() => setRetailMode('PO')} className={`flex-1 py-1.5 rounded-sm border shadow-sm ${retailMode === 'PO' ? 'bg-white border-black text-black' : 'bg-gray-200 border-gray-400 text-gray-500 hover:bg-gray-300'}`}>ORDER GOODS</button>
                  <button onClick={() => setRetailMode('RETURN')} className={`flex-1 py-1.5 rounded-sm border shadow-sm ${retailMode === 'RETURN' ? 'bg-red-50 border-red-500 text-red-800' : 'bg-gray-200 border-gray-400 text-gray-500 hover:bg-gray-300'}`}>RETURN GOODS</button>
                </div>
              </div>

              <form onSubmit={addToRetailCart} className="w-full bg-gray-100 border-2 border-gray-400 shadow-sm p-4">
                <div className="flex flex-col space-y-4">
                  <div className="relative">
                    <label className="block text-[13px] font-bold text-gray-700 mb-1.5">SEARCH ITEM</label>
                    <input type="text" value={retailSearch} onFocus={() => setIsRetailDropdownOpen(true)} onKeyDown={(e) => handleKeyDown(e, retailFilteredItems, setRetailSelectedItem, setRetailSearch, setIsRetailDropdownOpen, setRetailSelectedUnit, 'retail-item')} onChange={(e) => { setRetailSearch(e.target.value); setRetailSelectedItem(null); setIsRetailDropdownOpen(true); setHighlightIndex(-1); }} className="w-full border-2 border-gray-400 p-3 text-sm font-bold focus:outline-none focus:border-black focus:bg-yellow-50 select-text" placeholder="TYPE TO SEARCH..." />
                    {retailSearch.length > 0 && isRetailDropdownOpen && (
                      <div className="absolute z-10 w-full max-h-56 overflow-y-auto bg-white border-2 border-gray-400 mt-1 shadow-xl text-sm font-bold">
                        {retailFilteredItems.map((item, i) => <div id={`retail-item-${i}`} key={i} onClick={() => handleItemSelect(item, setRetailSelectedItem, setRetailSelectedUnit, setRetailSearch, setIsRetailDropdownOpen)} className={`p-3 cursor-pointer border-b border-gray-200 uppercase ${highlightIndex === i ? 'bg-gray-800 text-white' : 'hover:bg-gray-100'}`}><span className="text-[10px] font-bold text-gray-500 mr-2">[{item.category}]</span>{item.description}</div>)}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-[13px] font-bold text-gray-700 mb-1.5">QTY</label>
                      <input type="number" value={retailQty} onChange={(e) => setRetailQty(e.target.value)} className="w-full border-2 border-gray-400 p-3 text-sm font-bold focus:outline-none focus:border-black focus:bg-yellow-50 select-text" placeholder="0" />
                    </div>
                    <div className="w-32">
                      <label className="block text-[13px] font-bold text-gray-700 mb-1.5">UNIT</label>
                      {retailSelectedItem?.category === 'TVS' ? (
                         <select value={retailSelectedUnit} onChange={(e) => setRetailSelectedUnit(e.target.value)} className="w-full border-2 border-gray-400 p-3 bg-white text-sm font-bold focus:outline-none cursor-pointer select-text">
                            <option value="PCS">PCS</option><option value="SET">SET</option>
                         </select>
                      ) : (
                         <input type="text" value={retailSelectedUnit} disabled className="w-full border-2 border-gray-200 p-3 bg-gray-200 text-gray-500 text-sm font-bold select-text" />
                      )}
                    </div>
                  </div>
                  <button type="submit" className={`w-full text-white font-bold text-sm py-3 border-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none mt-2 ${retailMode === 'RETURN' ? 'bg-red-800 hover:bg-red-900 border-black' : 'bg-gray-800 hover:bg-black border-black'}`}>
                    + ADD TO {retailMode === 'RETURN' ? 'RETURN' : 'ORDER'}
                  </button>
                </div>
              </form>

              {retailCart.length > 0 && (
                <div className={`w-full bg-white border-2 shadow-sm flex flex-col p-4 ${retailMode === 'RETURN' ? 'border-red-400' : 'border-green-400'}`}>
                  <table className="w-full border-collapse mb-4 text-sm">
                    <tbody>
                      {retailCart.map((item, idx) => (
                        <tr key={idx} className={`border-b ${retailMode === 'RETURN' ? 'border-red-200 hover:bg-red-50' : 'border-green-200 hover:bg-green-50'} last:border-0`}>
                          <td className="py-2.5 flex items-center gap-3">
                            <button onClick={() => removeRetailCartItem(idx)} className="text-red-600 bg-white border border-red-300 font-bold px-2.5 py-1 hover:bg-red-100 rounded shadow-sm">✕</button>
                            <span className="font-bold text-gray-900 uppercase select-text">{item.description}</span>
                          </td>
                          <td className="py-2.5 text-right w-48 whitespace-nowrap select-text">
                             <div className="flex items-center justify-end gap-2">
                              <input type="number" value={item.req_qty} onChange={(e) => updateRetailCartQty(idx, e.target.value)} className={`w-20 border-2 ${retailMode === 'RETURN' ? 'border-red-400 focus:border-red-600' : 'border-green-400 focus:border-green-600'} p-1.5 text-center font-bold focus:outline-none focus:bg-yellow-50 select-text`} />
                              <span className={`font-normal text-[13px] ${retailMode === 'RETURN' ? 'text-red-900' : 'text-green-900'}`}>{item.unit || getUnit(item.description)}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {retailMode === 'RETURN' && (
                    <input type="text" value={retailReturnNote} onChange={(e) => setRetailReturnNote(e.target.value)} placeholder="ADD OPTIONAL RETURN NOTE" className="w-full border-2 border-red-400 p-3 text-sm font-bold focus:outline-none focus:border-red-600 focus:bg-yellow-50 mb-4 select-text" />
                  )}
                  <button onClick={submitRetailAction} className={`w-full mt-auto text-white font-bold text-[13px] py-3 border-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none ${retailMode === 'RETURN' ? 'bg-red-700 hover:bg-red-800 border-red-900' : 'bg-green-700 hover:bg-green-800 border-green-900'}`}>
                    {retailMode === 'RETURN' ? `SUBMIT RETURN (${retailCart.length})` : `SUBMIT P.O. (${retailCart.length})`}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}