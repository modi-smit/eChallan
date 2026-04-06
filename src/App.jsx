import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

export default function App() {
  // --- NEW AUTH STATES ---
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false); 
  const [workerName, setWorkerName] = useState('');
  const [loginError, setLoginError] = useState('');

  // --- EXISTING STATES ---
  const [view, setView] = useState(''); 
  const [masterItems, setMasterItems] = useState([]);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  // Depot States
  const [depotMode, setDepotMode] = useState('DISPATCH'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [qty, setQty] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState('CANS'); 
  const [depotCart, setDepotCart] = useState([]); 
  const [depotReturnNote, setDepotReturnNote] = useState(''); 
  const [pendingPOs, setPendingPOs] = useState({}); 
  const [pendingReturns, setPendingReturns] = useState({});

  // Admin States
  const [isAdminAuth, setIsAdminAuth] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('WAITING UPLOAD');
  const [ledgerData, setLedgerData] = useState([]);
  
  // --- Admin Note States ---
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [tempNoteText, setTempNoteText] = useState("");

  // Retailer States
  const [retailMode, setRetailMode] = useState('PO'); 
  const [retailSearch, setRetailSearch] = useState('');
  const [retailQty, setRetailQty] = useState('');
  const [retailSelectedItem, setRetailSelectedItem] = useState(null);
  const [retailSelectedUnit, setRetailSelectedUnit] = useState('CANS'); 
  const [retailReturnNote, setRetailReturnNote] = useState(''); 
  const [isRetailDropdownOpen, setIsRetailDropdownOpen] = useState(false);
  const [retailCart, setRetailCart] = useState([]); 
  const [incomingDeliveries, setIncomingDeliveries] = useState({});
  const [pendingDepotReturns, setPendingDepotReturns] = useState({});
  
  // Modals
  const [verifyModal, setVerifyModal] = useState(null);
  const [editPOModal, setEditPOModal] = useState(null);
  const [processReturnModal, setProcessReturnModal] = useState(null);

  // --- AUTH LOGIC ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchRole(session.user.id);
      else setLoadingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchRole(session.user.id);
      else {
        setUserRole(null);
        setView('');
        setIsAdminAuth(false);
        setLoadingAuth(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchRole(userId) {
    const { data, error } = await supabase.from('users').select('role').eq('id', userId).single();
    if (data) {
      const currentRole = data.role ? data.role.toLowerCase().trim() : '';
      setUserRole(currentRole === 'master' ? 'admin' : currentRole);
      
      if (currentRole === 'admin' || currentRole === 'master') {
        setView('admin');
        setIsAdminAuth(true); 
      } else if (currentRole === 'retail') {
        setView('retail');
      } else if (currentRole === 'depot') {
        setView('depot');
      } else {
        setView('unassigned');
      }
    }
    setLoadingAuth(false);
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true); 
    
    const hiddenEmail = `${workerName.trim().toLowerCase()}@god.com.in`;
    const hiddenPin = "123456"; 
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: hiddenEmail,
      password: hiddenPin,
    });

    if (error) {
      setLoginError(`System Error: ${error.message}`);
      setIsLoggingIn(false);
      return;
    }

    if (data?.user) {
      await fetchRole(data.user.id);
    }
    
    setIsLoggingIn(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  // --- DATA FETCHING & SAVING ---
  useEffect(() => { 
    if (!session) return; 
    fetchMasterItems(); 
    fetchPendingPOs(); 
    fetchIncomingDeliveries(); 
    fetchPendingReturns();
    fetchPendingDepotReturns();
    if (isAdminAuth) fetchLedger();
  }, [isAdminAuth, session]);

  const fetchMasterItems = async () => {
    const { data } = await supabase.from('master_items').select('*');
    if (data) {
      setMasterItems(data);
      setUploadStatus(data.length > 0 ? `${data.length} SKUs AVAILABLE` : 'WAITING UPLOAD');
    }
  };

  const fetchPendingPOs = async () => {
    const { data } = await supabase.from('transactions').select('*').eq('status', 'PO_PLACED').order('timestamp', { ascending: true });
    if (data) {
      const grouped = data.reduce((acc, curr) => {
        if (!acc[curr.group_id]) acc[curr.group_id] = [];
        acc[curr.group_id].push(curr);
        return acc;
      }, {});
      setPendingPOs(grouped);
    } else setPendingPOs({});
  };

  const fetchPendingDepotReturns = async () => {
    const { data } = await supabase.from('transactions').select('*').eq('status', 'RETURN_REQUESTED').order('timestamp', { ascending: true });
    if (data) {
      const grouped = data.reduce((acc, curr) => {
        if (!acc[curr.group_id]) acc[curr.group_id] = [];
        acc[curr.group_id].push(curr);
        return acc;
      }, {});
      setPendingDepotReturns(grouped);
    } else setPendingDepotReturns({});
  };

  const fetchPendingReturns = async () => {
    const { data } = await supabase.from('transactions').select('*').eq('status', 'RETURN_INITIATED').order('timestamp', { ascending: true });
    if (data) {
      const grouped = data.reduce((acc, curr) => {
        if (!acc[curr.challan_no]) acc[curr.challan_no] = [];
        acc[curr.challan_no].push(curr);
        return acc;
      }, {});
      setPendingReturns(grouped);
    } else setPendingReturns({});
  };

  const fetchIncomingDeliveries = async () => {
    const { data } = await supabase.from('transactions').select('*').eq('status', 'DISPATCHED').order('timestamp', { ascending: false });
    if (data) {
      const grouped = data.reduce((acc, curr) => {
        if (!acc[curr.challan_no]) acc[curr.challan_no] = [];
        acc[curr.challan_no].push(curr);
        return acc;
      }, {});
      setIncomingDeliveries(grouped);
    } else setIncomingDeliveries({});
  };

  const fetchLedger = async () => {
    const { data } = await supabase.from('transactions')
      .select('*')
      .in('status', ['ACCEPTED', 'DISPATCHED', 'RETURN_ACCEPTED'])
      .order('timestamp', { ascending: false });
    if (data) setLedgerData(data);
  };

  // --- SAVE ADMIN NOTE ---
  const saveAdminNote = async (keyField, keyValue) => {
    try {
      // Apply the note to ALL rows that share this challan_no or group_id
      const { error } = await supabase
        .from('transactions')
        .update({ admin_note: tempNoteText })
        .eq(keyField, keyValue);

      if (error) throw error;

      // Update local state instantly for all matching rows
      setLedgerData((prevData) =>
        prevData.map((tx) =>
          tx[keyField] === keyValue ? { ...tx, admin_note: tempNoteText } : tx
        )
      );

      setEditingNoteId(null);
    } catch (error) {
      alert(`Failed to save note: ${error.message}`);
    }
  };

  const formatDate = (dateInput) => {
    const d = dateInput ? new Date(dateInput) : new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${d.getFullYear()}`;
  };

  const formatTime = (dateInput) => {
    const d = dateInput ? new Date(dateInput) : new Date();
    let hours = d.getHours();
    let minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  };

  const isWithin30Days = (dateStr) => {
    const txDate = new Date(dateStr);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return txDate >= thirtyDaysAgo;
  };

  const getNextSequence = async (type) => {
    const prefix = type === 'PO' ? 'PO2627' : type === 'RT' ? 'RT2627' : type === 'RR' ? 'RR2627' : 'CN2627';
    const column = type === 'PO' || type === 'RR' ? 'group_id' : 'challan_no';
    
    const { data } = await supabase
      .from('transactions')
      .select(column)
      .like(column, `${prefix}%`)
      .order(column, { ascending: false })
      .limit(1);
      
    if (data && data.length > 0 && data[0][column]) {
       const lastNum = parseInt(data[0][column].replace(prefix, ''));
       return `${prefix}${String(lastNum + 1).padStart(3, '0')}`;
    }
    return `${prefix}001`;
  };

  const getCategory = (desc) => {
    const item = masterItems.find(i => i.description === desc);
    if (item && item.category) return item.category;
    const upperDesc = desc ? desc.toUpperCase() : '';
    if (upperDesc.includes('TYRE') || upperDesc.includes('TUBE') || upperDesc.match(/\d{2,3}\/\d{2,3}/)) return 'TVS';
    return 'SERVO';
  };

  const getUnit = (desc) => {
    if (!desc) return '';
    const upperDesc = desc.toUpperCase();
    let cat = getCategory(desc);

    if (cat === 'SERVO') {
      if (/210\s*L/i.test(desc) || /182\s*KG/i.test(desc)) return 'BRL';
      if (/50\s*L/i.test(desc)) return 'DRUM';
      if (/(7\.5|10|15|20|26)\s*(L|KG)/i.test(desc)) return 'BUC';
      return 'CANS';
    } else {
      const learned = JSON.parse(localStorage.getItem('tvsUnits') || '{}');
      if (learned[desc]) return learned[desc];
      return /\bTT\b/i.test(upperDesc) ? 'SET' : 'PCS';
    }
  };

  const getDisplayQty = (desc, qty, unit) => {
    const item = masterItems.find(i => i.description === desc);
    if (item && item.category === 'SERVO' && item.ratio && parseFloat(item.ratio) > 1) {
        const ratio = parseInt(item.ratio);
        const q = parseInt(Math.abs(qty));
        const cases = Math.floor(q / ratio);
        const cans = q % ratio;
        let parts = [];
        if (cases > 0) parts.push(`${cases} CAR`);
        if (cans > 0) parts.push(`${cans} ${unit}`);
        return parts.length > 0 ? parts.join(' + ') : `0 ${unit}`;
    }
    return `${Math.abs(qty) || 0} ${unit}`;
  };

  const handleItemSelect = (item, setItemState, setUnitState, setSearchState, setDropdownState) => {
    setItemState(item); setSearchState(item.description); setUnitState(getUnit(item.description));
    setHighlightIndex(-1); if(setDropdownState) setDropdownState(false);
  };

  const smartSearch = (query) => {
    if (!query) return [];
    const terms = query.toLowerCase().split(' ').filter(Boolean);
    return masterItems.filter(item => {
      const desc = item.description.toLowerCase();
      return terms.every(term => desc.includes(term));
    }).slice(0, 50);
  };

  const printPDF = (challanNo, itemsList) => {
    const doc = new jsPDF({ format: 'a5' }); 
    const isReturn = challanNo.startsWith('RT');
    
    doc.setFillColor(235, 235, 235);
    doc.rect(5, 5, 138, 16, 'F'); 
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("GUJARAT OIL DEPOT", 74, 12, { align: "center" });
    doc.setFontSize(10);
    doc.text(isReturn ? "RETURN CHALLAN" : "DELIVERY CHALLAN", 74, 18, { align: "center" });

    doc.setLineWidth(0.4);
    doc.line(5, 21, 143, 21);

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(isReturn ? `RETURN NO :` : `CHALLAN NO :`, 8, 27);
    doc.setFont("helvetica", "normal");
    doc.text(challanNo, 32, 27);
    
    doc.setFont("helvetica", "bold");
    doc.text(`DATE :`, 104, 27);
    doc.setFont("helvetica", "normal");
    doc.text(formatDate(), 116, 27);

    doc.setFont("helvetica", "bold");
    doc.text(`BILLED TO :`, 8, 33);
    doc.setFont("helvetica", "normal");
    doc.text(`SOUTH GUJARAT DISTRIBUTORS`, 28, 33);
    doc.text(`RETAIL STORE`, 28, 38);
    
    const tableTop = 41;
    doc.setFillColor(245, 245, 245);
    doc.rect(5.2, tableTop + 0.2, 137.6, 6.6, 'F'); 
    
    doc.setLineWidth(0.4);
    doc.line(5, tableTop, 143, tableTop);
    doc.line(5, tableTop + 7, 143, tableTop + 7);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("SR", 10, tableTop + 5, { align: "center" });
    doc.text("ITEM DESCRIPTION", 56, tableTop + 5, { align: "center" }); 
    doc.text("NOS", 104, tableTop + 5, { align: "center" });
    doc.text("QTY", 127.5, tableTop + 5, { align: "center" });

    doc.setFont("helvetica", "normal");
    let y = tableTop + 12;
    let totalNos = 0;

    itemsList.forEach((item, index) => {
      const desc = item.description || item.item_desc;
      const splitDesc = doc.splitTextToSize(desc, 80); 
      const rawQty = parseInt(item.disp_qty || item.req_qty) || 0;
      totalNos += rawQty;

      const unit = item.unit || getUnit(desc);
      const displayStr = getDisplayQty(desc, rawQty, unit);
      const paddedQty = String(rawQty).padStart(2, '0');
      
      doc.text(`${index + 1}`, 10, y, { align: "center" }); 
      doc.text(splitDesc, 17, y); 
      
      doc.setFont("helvetica", "bold");
      doc.text(paddedQty, 104, y, { align: "center" }); 
      
      doc.setFontSize(8); 
      doc.text(displayStr, 127.5, y, { align: "center" }); 
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      
      const rowHeight = (splitDesc.length * 4) + 1;
      
      if (index < itemsList.length - 1) {
        doc.setLineWidth(0.1);
        doc.line(5, y + rowHeight - 2, 143, y + rowHeight - 2); 
      }
      
      y += rowHeight + 2; 
    });

    const tableBottom = Math.max(y - 1, 165);

    doc.setFillColor(235, 235, 235);
    doc.rect(5.2, tableBottom + 0.2, 137.6, 5.6, 'F');

    doc.setLineWidth(0.4);
    doc.line(5, tableBottom, 143, tableBottom); 
    
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL", 92, tableBottom + 4.2, { align: "right" });
    doc.text(String(totalNos).padStart(2, '0'), 104, tableBottom + 4.2, { align: "center" });
    
    doc.line(5, tableBottom + 6, 143, tableBottom + 6); 

    doc.line(15, tableTop, 15, tableBottom + 6); 
    doc.line(97, tableTop, 97, tableBottom + 6); 
    doc.line(112, tableTop, 112, tableBottom + 6); 

    const sigY = 183; 
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Receiver's Signature / Stamp", 8, sigY);
    
    if (itemsList.length > 0 && (itemsList[0].status === 'ACCEPTED' || itemsList[0].status === 'RETURN_ACCEPTED')) {
      doc.setTextColor(0, 128, 0); 
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.text("Digitally Verified", 8, sigY + 6);
      doc.setTextColor(0, 0, 0); 
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("For GUJARAT OIL DEPOT", 140, sigY - 6, { align: "right" });
    
    doc.setTextColor(0, 51, 153); 
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.text("Electronically Signed Document", 140, sigY, { align: "right" });
    
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.text(`Auth: ${formatDate()} ${formatTime()}`, 140, sigY + 4, { align: "right" });
    
    doc.setLineWidth(0.4);
    doc.rect(5, 5, 138, 195); 

    doc.save(`${challanNo}.pdf`);
  };

  const downloadLedger = () => {
    if(ledgerData.length === 0) { alert("No data to export"); return; }
    
    const dispatchedDataObj = {};
    const returnsDataObj = {};
    
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
      const desc = row.item_desc.toUpperCase();
      const q = parseInt(row.disp_qty || row.req_qty) || 0;
      if(!itemSummary[desc]) itemSummary[desc] = { qty: 0, unit: row.unit || getUnit(desc), category: getCategory(desc) };
      
      if (row.status === 'RETURN_ACCEPTED') itemSummary[desc].qty -= q;
      else if (row.status === 'ACCEPTED' || row.status === 'DISPATCHED') itemSummary[desc].qty += q;
    });

    const summaryEntries = Object.entries(itemSummary).filter(([_, data]) => data.qty !== 0); 
    const servoEntries = summaryEntries.filter(([_, data]) => data.category === 'SERVO');
    const tvsEntries = summaryEntries.filter(([_, data]) => data.category === 'TVS');
    
    let leftRowsFlat = [];
    
    leftRowsFlat.push({ type: 'title', title: `GUJARAT OIL DEPOT - TRANSACTION LEDGER (${formatDate()})`, isReturn: false });
    leftRowsFlat.push({ type: 'subtitle', title: `BILLED TO: SOUTH GUJARAT DISTRIBUTORS, RETAIL STORE`, isReturn: false });
    leftRowsFlat.push({ type: 'header', cols: ['DATE / TIME', 'CHALLAN NO', 'ITEM DESCRIPTION', 'NOS', 'QTY', 'ADMIN NOTE'], isReturn: false });

    dispatchedGroups.forEach(group => {
      let bgColor = group.status === "ACCEPTED" ? "#dcfce7" : "#dbeafe"; 
      let groupTotal = 0;
      group.items.forEach((row, i) => {
        const rawQty = parseInt(row.disp_qty || row.req_qty) || 0;
        groupTotal += rawQty;
        
        // STRICT MATH CHECK FOR RED TEXT
        const reqQ = Number(row.req_qty);
        const dispQ = Number(row.disp_qty);
        const isChanged = Boolean(row.req_qty) && Boolean(row.disp_qty) && reqQ > 0 && dispQ > 0 && reqQ !== dispQ;
        
        leftRowsFlat.push({
          type: 'data', isReturn: false, isFirst: i === 0, rowspan: group.items.length,
          date: `${formatDate(group.date)}<br style="mso-data-placement:same-cell;"/>${formatTime(group.date)}`,
          challan: group.challan_no || '-', desc: row.item_desc.toUpperCase(),
          nos: String(rawQty).padStart(2, '0'),
          qty: getDisplayQty(row.item_desc, rawQty, row.unit || getUnit(row.item_desc)).toUpperCase(),
          adminNote: group.admin_note || '', // Grabs from group
          color: bgColor, qtyColor: isChanged ? 'color: #dc2626;' : 'color: #000;'
        });
      });
      leftRowsFlat.push({ type: 'total', color: bgColor, total: String(groupTotal).padStart(2, '0'), isReturn: false });
    });

    if (returnGroups.length > 0) {
      leftRowsFlat.push({ type: 'empty' });
      leftRowsFlat.push({ type: 'title', title: `GUJARAT OIL DEPOT - RETURN LEDGER (${formatDate()})`, isReturn: true });
      leftRowsFlat.push({ type: 'subtitle', title: `RETURNED BY: SOUTH GUJARAT DISTRIBUTORS, RETAIL STORE`, isReturn: true });
      leftRowsFlat.push({ type: 'header', cols: ['DATE / TIME', 'RETURN NO', 'ITEM DESCRIPTION', 'NOS', 'QTY', 'REMARKS / NOTE'], isReturn: true });

      returnGroups.forEach(group => {
        let bgColor = "#fee2e2"; 
        let groupTotal = 0;
        group.items.forEach((row, i) => {
          const rawQty = parseInt(row.disp_qty || row.req_qty) || 0;
          groupTotal += rawQty;
          leftRowsFlat.push({
            type: 'data', isReturn: true, isFirst: i === 0, rowspan: group.items.length, 
            date: `${formatDate(row.timestamp)}<br style="mso-data-placement:same-cell;"/>${formatTime(row.timestamp)}`,
            challan: row.challan_no || '-', desc: row.item_desc.toUpperCase(),
            nos: String(rawQty).padStart(2, '0'),
            qty: getDisplayQty(row.item_desc, rawQty, row.unit || getUnit(row.item_desc)).toUpperCase(),
            note: row.note || '',
            color: bgColor, qtyColor: 'color: #dc2626;'
          });
        });
        leftRowsFlat.push({ type: 'total', color: bgColor, total: String(groupTotal).padStart(2, '0'), isReturn: true });
      });
    }

    let rightRowsFlat = [];
    rightRowsFlat.push({ type: 'title', title: `ITEM WISE SUMMARY` });
    rightRowsFlat.push({ type: 'subtitle', title: `TOTAL SKUS: ${summaryEntries.length}` });
    rightRowsFlat.push({ type: 'header', cols: ['ITEM DESCRIPTION', 'TOTAL NOS', 'CONVERTED QTY'] });
    
    if (servoEntries.length > 0) {
        rightRowsFlat.push({ type: 'group_title', title: 'SERVO LUBRICANTS' });
        servoEntries.forEach(([desc, data]) => {
           rightRowsFlat.push({ type: 'summary_data', desc, nos: String(data.qty).padStart(2, '0'), qty: getDisplayQty(desc, data.qty, data.unit).toUpperCase() });
        });
    }

    if (tvsEntries.length > 0) {
        rightRowsFlat.push({ type: 'group_title', title: 'TVS TYRES & TUBES' });
        tvsEntries.forEach(([desc, data]) => {
           rightRowsFlat.push({ type: 'summary_data', desc, nos: String(data.qty).padStart(2, '0'), qty: getDisplayQty(desc, data.qty, data.unit).toUpperCase() });
        });
    }

    const maxRows = Math.max(leftRowsFlat.length, rightRowsFlat.length);

    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="UTF-8"></head><body>`;
    
    html += `<table border="0" cellpadding="5" cellspacing="0" style="font-family: Arial, sans-serif; border-collapse: collapse; font-size: 13px; white-space: nowrap;">`;
    
    html += `<colgroup>
        <col width="130" />
        <col width="110" />
        <col width="380" />
        <col width="50" />
        <col width="130" />
        <col width="250" />
        <col width="30" />
        <col width="380" />
        <col width="80" />
        <col width="140" />
    </colgroup>`;

    for(let i=0; i<maxRows; i++) {
      html += `<tr style="height: 35px;">`;
      
      if (i < leftRowsFlat.length) {
        const l = leftRowsFlat[i];
        const spanLimit = 6;

        if (l.type === 'title') {
            html += `<td colspan="${spanLimit}" style="background-color: #d1d5db; color: #000; padding: 10px; text-align: left; border: 1px solid black; font-size: 16px; font-weight: bold; vertical-align: middle; white-space: nowrap;">${l.title}</td>`;
            if (!l.isReturn) html += `<td style="border: none; background-color: transparent;"></td>`;
        } else if (l.type === 'subtitle') {
            html += `<td colspan="${spanLimit}" style="background-color: #f3f4f6; color: #000; padding: 8px; text-align: left; border: 1px solid black; font-weight: bold; vertical-align: middle; white-space: nowrap;">${l.title}</td>`;
            if (!l.isReturn) html += `<td style="border: none; background-color: transparent;"></td>`;
        } else if (l.type === 'header') {
            l.cols.forEach((col, idx) => {
                const align = (idx === 2) ? 'left' : 'center'; 
                html += `<td style="background-color: #e5e7eb; border: 1px solid black; padding: 8px; font-weight: bold; text-align: ${align}; color: #000; vertical-align: middle; white-space: nowrap;">${col}</td>`;
            });
            if (!l.isReturn) html += `<td style="border: none; background-color: transparent;"></td>`;
        } else if (l.type === 'data') {
            if (l.isFirst) {
                html += `<td rowspan="${l.rowspan}" style="mso-number-format:'\\@'; background-color: ${l.color}; border: 1px solid black; vertical-align: middle; text-align: center; font-weight: bold; padding: 8px; color: #000; white-space: normal; mso-style-textwrap: yes;">${l.date}</td>`;
                html += `<td rowspan="${l.rowspan}" style="mso-number-format:'\\@'; background-color: ${l.color}; border: 1px solid black; vertical-align: middle; text-align: center; font-weight: bold; padding: 8px; color: #000; white-space: nowrap;">${l.challan}</td>`;
        }
        
        // CSS Wrap implemented here
        html += `<td style="background-color: ${l.color}; border: 1px solid black; vertical-align: middle; padding: 8px; color: #000; white-space: normal; mso-style-textwrap: yes; word-wrap: break-word;">${l.desc}</td>`;
        html += `<td style="background-color: ${l.color}; border: 1px solid black; vertical-align: middle; text-align: center; font-weight: bold; padding: 8px; ${l.qtyColor} white-space: nowrap;">${l.nos}</td>`;
        html += `<td style="background-color: ${l.color}; border: 1px solid black; vertical-align: middle; font-weight: bold; padding: 8px; text-align: center; ${l.qtyColor} white-space: nowrap;">${l.qty}</td>`;

        if (l.isReturn) {
            // Return Note Span
            if (l.isFirst) html += `<td rowspan="${l.rowspan}" style="background-color: ${l.color}; border: 1px solid black; vertical-align: middle; padding: 8px; color: #000; white-space: normal; mso-style-textwrap: yes; word-wrap: break-word;">${l.note || ''}</td>`;
        } else {
            // Admin Note Span (Fixed to span the whole challan)
            if (l.isFirst) html += `<td rowspan="${l.rowspan}" style="background-color: ${l.color}; border: 1px solid black; vertical-align: middle; padding: 8px; color: #000; white-space: normal; mso-style-textwrap: yes; word-wrap: break-word;">${l.adminNote || ''}</td>`;
        }
        } else if (l.type === 'total') {
            html += `<td colspan="3" style="background-color: ${l.color}; border: 1px solid black; padding: 8px; text-align: right; font-weight: bold; color: #000; vertical-align: middle; white-space: nowrap;">TOTAL:</td>`;
            html += `<td style="background-color: ${l.color}; border: 1px solid black; padding: 8px; text-align: center; font-weight: bold; color: #000; vertical-align: middle; white-space: nowrap;">${l.total}</td>`;
            if (l.isReturn) {
                html += `<td colspan="2" style="background-color: ${l.color}; border: 1px solid black; padding: 8px;"></td>`;
            } else {
                html += `<td style="background-color: ${l.color}; border: 1px solid black; padding: 8px;"></td>`;
                html += `<td style="border: none; background-color: transparent;"></td>`;
            }
        } else if (l.type === 'empty') {
            html += `<td style="border: none; background-color: transparent;"></td>`.repeat(6);
        }
      } else {
        html += `<td style="border: none; background-color: transparent;"></td>`.repeat(6);
      }

      html += `<td style="border: none; background-color: transparent; width: 30px;"></td>`;

      if (i < rightRowsFlat.length) {
        const r = rightRowsFlat[i];
        if (r.type === 'title') {
            html += `<td colspan="3" style="background-color: #d1d5db; color: #000; padding: 10px; text-align: left; border: 1px solid black; font-size: 16px; font-weight: bold; vertical-align: middle; white-space: nowrap;">${r.title}</td>`;
        } else if (r.type === 'subtitle') {
            html += `<td colspan="3" style="background-color: #ffffff; color: #000; padding: 8px; text-align: left; border: 1px solid black; font-weight: bold; vertical-align: middle; white-space: nowrap;">${r.title}</td>`;
        } else if (r.type === 'header') {
            r.cols.forEach((col, idx) => {
                const align = (idx === 0) ? 'left' : 'center';
                html += `<td style="background-color: #e5e7eb; border: 1px solid black; padding: 8px; font-weight: bold; text-align: ${align}; color: #000; vertical-align: middle; white-space: nowrap;">${col}</td>`;
            });
        } else if (r.type === 'group_title') {
            html += `<td colspan="3" style="background-color: #dbeafe; color: #1e3a8a; padding: 8px; text-align: center; border: 1px solid black; font-weight: bold; font-size: 14px; vertical-align: middle; white-space: nowrap;">${r.title}</td>`;
        } else if (r.type === 'summary_data') {
            html += `<td style="border: 1px solid black; vertical-align: middle; padding: 8px; color: #000; background-color: #ffffff; white-space: normal; mso-style-textwrap: yes; word-wrap: break-word;">${r.desc}</td>`;
            html += `<td style="border: 1px solid black; vertical-align: middle; text-align: center; font-weight: bold; padding: 8px; color: #000; background-color: #ffffff; white-space: nowrap;">${r.nos}</td>`;
            html += `<td style="border: 1px solid black; vertical-align: middle; font-weight: bold; padding: 8px; text-align: center; color: #000; background-color: #ffffff; white-space: nowrap;">${r.qty}</td>`;
        }
      } else {
        html += `<td style="border: none; background-color: transparent;"></td>`.repeat(3);
      }
      
      html += `</tr>`;
    }

    html += `</table></body></html>`;

    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eChallan ${formatDate().replace(/\//g, '.')}.xls`;
    document.body.appendChild(a); 
    a.click();
    document.body.removeChild(a);
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
              const norm = normalizeRow(row); 
              return { description: norm.description, ratio: norm.ratio || 1, category: sheetName };
            }).filter(item => item.description);
            finalItemsToUpload = [...finalItemsToUpload, ...formatted];
          }
        });
        await supabase.from('master_items').delete().neq('description', 'dummy'); 
        await supabase.from('master_items').insert(finalItemsToUpload);
        setUploadStatus(`${finalItemsToUpload.length} SKUs AVAILABLE`); fetchMasterItems();
      } catch (error) { setUploadStatus(`Error`); }
    };
    reader.readAsArrayBuffer(file); 
  };

  const handleKeyDown = (e, itemsList, setSelected, setSearch, setDropdownOpen, setUnitState, listIdPrefix) => {
    if (e.key === 'ArrowDown') { 
      e.preventDefault(); 
      setHighlightIndex(p => {
        const next = p < itemsList.length - 1 ? p + 1 : p;
        document.getElementById(`${listIdPrefix}-${next}`)?.scrollIntoView({ block: 'nearest' });
        return next;
      }); 
    } 
    else if (e.key === 'ArrowUp') { 
      e.preventDefault(); 
      setHighlightIndex(p => {
        const next = p > 0 ? p - 1 : 0;
        document.getElementById(`${listIdPrefix}-${next}`)?.scrollIntoView({ block: 'nearest' });
        return next;
      }); 
    } 
    else if (e.key === 'Enter') {
      e.preventDefault(); if (highlightIndex >= 0 && itemsList[highlightIndex]) {
        handleItemSelect(itemsList[highlightIndex], setSelected, setUnitState, setSearch, setDropdownOpen);
      }
    }
  };

  const retailFilteredItems = smartSearch(retailSearch);

  const addToRetailCart = (e) => {
    e.preventDefault(); if (!retailSelectedItem || !retailQty) return;
    setRetailCart([...retailCart, { ...retailSelectedItem, req_qty: retailQty, unit: retailSelectedUnit }]);
    setRetailSearch(''); setRetailQty(''); setRetailSelectedItem(null);
  };
  const updateRetailCartQty = (index, val) => { const updated = [...retailCart]; updated[index].req_qty = val; setRetailCart(updated); };
  const removeRetailCartItem = (index) => setRetailCart(retailCart.filter((_, i) => i !== index));

  const submitRetailAction = async () => {
    if (retailCart.length === 0) return; 
    const isReturn = retailMode === 'RETURN';
    const groupId = await getNextSequence(isReturn ? 'RT' : 'PO');
    const tx = retailCart.map(item => ({ 
      group_id: groupId, 
      item_desc: item.description, 
      req_qty: parseInt(item.req_qty), 
      unit: item.unit, 
      status: isReturn ? 'RETURN_INITIATED' : 'PO_PLACED',
      challan_no: isReturn ? groupId : null,
      note: isReturn ? retailReturnNote : null
    }));
    const { error } = await supabase.from('transactions').insert(tx);
    if (error) {
      alert(`Submission Error: ${error.message}`);
    } else { 
      alert(`${isReturn ? 'Return' : 'P.O.'} Submitted: ${groupId}`); 
      setRetailCart([]); 
      setRetailReturnNote('');
      fetchPendingPOs(); 
      fetchPendingReturns();
    }
  };

  const openVerifyModal = (challanNo, items) => {
    const checks = {}; items.forEach((_, i) => checks[i] = false);
    setVerifyModal({ challanNo, items, checks, isDepotReturn: challanNo.startsWith('RT') });
  };
  const toggleVerifyCheck = (index) => setVerifyModal(prev => ({ ...prev, checks: { ...prev.checks, [index]: !prev.checks[index] } }));

  const acceptDelivery = async () => {
    if (!verifyModal) return;
    const newStatus = verifyModal.isDepotReturn ? 'RETURN_ACCEPTED' : 'ACCEPTED';
    const { error } = await supabase.from('transactions').update({ status: newStatus }).eq('challan_no', verifyModal.challanNo);
    if (!error) { 
      setVerifyModal(null); 
      fetchIncomingDeliveries(); 
      fetchPendingReturns();
      fetchLedger(); 
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
    e.preventDefault();
    if (depotCart.length === 0) return;
    if (depotMode === 'DISPATCH') {
      generateManualChallan();
    } else {
      const groupId = await getNextSequence('RR');
      const tx = depotCart.map(item => ({ 
        group_id: groupId, 
        item_desc: item.description, 
        req_qty: parseInt(item.disp_qty), 
        unit: item.unit, 
        status: 'RETURN_REQUESTED',
        note: depotReturnNote 
      }));
      const { error } = await supabase.from('transactions').insert(tx);
      if (error) {
        alert(`Submission Error: ${error.message}`);
      } else { 
        alert(`Return Request Submitted: ${groupId}`); 
        setDepotCart([]); 
        setDepotReturnNote('');
        fetchPendingDepotReturns(); 
      }
    }
  };

  const generateManualChallan = async () => {
    const challanNo = await getNextSequence('CN'); 
    const groupId = 'MANUAL-' + Date.now();
    const tx = depotCart.map(item => ({ group_id: groupId, challan_no: challanNo, item_desc: item.description, disp_qty: parseInt(item.disp_qty), unit: item.unit, status: 'DISPATCHED' }));
    const { error } = await supabase.from('transactions').insert(tx);
    if (!error) { printPDF(challanNo, depotCart); setDepotCart([]); fetchIncomingDeliveries(); }
  };

  const openEditPOModal = (groupId, items) => {
    setEditPOModal({ groupId, items: items.map(i => ({ ...i, edit_qty: i.req_qty })) });
  };
  const handleEditPOQty = (index, val) => {
    const updated = [...editPOModal.items]; updated[index].edit_qty = val; setEditPOModal({ ...editPOModal, items: updated });
  };
  
  const confirmDispatchPO = async () => {
    if (!editPOModal) return;
    const challanNo = await getNextSequence('CN');
    const backorders = [];
    const printItems = [];

    for (const item of editPOModal.items) {
      const dispatchQty = parseInt(item.edit_qty) || 0;
      const reqQty = parseInt(item.req_qty);

      if (dispatchQty > 0) {
        await supabase.from('transactions').update({ status: 'DISPATCHED', challan_no: challanNo, disp_qty: dispatchQty }).eq('id', item.id);
        printItems.push({ ...item, disp_qty: dispatchQty });
      }

      if (dispatchQty < reqQty) {
        const diff = reqQty - dispatchQty;
        const newPO = await getNextSequence('PO');
        backorders.push({ group_id: newPO, item_desc: item.item_desc, req_qty: diff, unit: item.unit, status: 'PO_PLACED' });
      }
    }

    if (backorders.length > 0) await supabase.from('transactions').insert(backorders);
    if (printItems.length > 0) printPDF(challanNo, printItems);
    
    setEditPOModal(null); fetchPendingPOs(); fetchIncomingDeliveries();
  };

  const openProcessReturnModal = (groupId, items) => {
    setProcessReturnModal({ groupId, items: items.map(i => ({ ...i, edit_qty: i.req_qty })) });
  };
  const handleProcessReturnQty = (index, val) => {
    const updated = [...processReturnModal.items]; updated[index].edit_qty = val; setProcessReturnModal({ ...processReturnModal, items: updated });
  };

  const confirmProcessReturnRequest = async () => {
    if (!processReturnModal) return;
    const challanNo = await getNextSequence('RT');
    const backorders = [];
    const printItems = [];

    for (const item of processReturnModal.items) {
      const dispatchQty = parseInt(item.edit_qty) || 0;
      const reqQty = parseInt(item.req_qty);

      if (dispatchQty > 0) {
        await supabase.from('transactions').update({ status: 'RETURN_INITIATED', challan_no: challanNo, disp_qty: dispatchQty }).eq('id', item.id);
        printItems.push({ ...item, disp_qty: dispatchQty });
      }

      if (dispatchQty < reqQty) {
        const diff = reqQty - dispatchQty;
        const newRR = await getNextSequence('RR');
        backorders.push({ group_id: newRR, item_desc: item.item_desc, req_qty: diff, unit: item.unit, status: 'RETURN_REQUESTED' });
      }
    }

    if (backorders.length > 0) await supabase.from('transactions').insert(backorders);
    if (printItems.length > 0) printPDF(challanNo, printItems);
    
    setProcessReturnModal(null); fetchPendingDepotReturns(); fetchPendingReturns();
  };

  // --- UI RENDERING ---

  // 1. Loading Screen
  if (loadingAuth) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-200">
        <p className="text-xl font-bold animate-pulse text-gray-800">Authenticating System...</p>
      </div>
    );
  }

  // 2. Auth/Login Screen
  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-200 font-sans">
        <div className="w-full max-w-sm bg-gray-100 border-2 border-black p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <h2 className="text-2xl font-black text-center border-b-2 border-black pb-3 mb-6 uppercase">System Login</h2>
          
          {loginError && (
            <div className="bg-red-200 text-red-900 border-2 border-red-900 p-2 font-bold text-sm mb-4 text-center">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1 uppercase text-center">Enter Worker Name</label>
              <input
                type="text"
                autoFocus
                value={workerName}
                onChange={(e) => setWorkerName(e.target.value)}
                className="w-full border-2 border-black p-3 font-bold text-center uppercase focus:bg-yellow-50 focus:outline-none text-lg"
                placeholder="Enter your Name"
                required
              />
            </div>
            <button 
              type="submit" 
              disabled={isLoggingIn}
              className={`w-full bg-black hover:bg-gray-800 text-white py-4 font-bold uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] mt-2 transition-all ${isLoggingIn ? 'opacity-60 cursor-not-allowed shadow-none translate-y-1' : 'active:translate-y-1 active:shadow-none'}`}
            >
              {isLoggingIn ? 'VERIFYING...' : 'Access System'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 3. Smart Navigation Bar
  const renderNav = () => (
    <nav className="bg-gray-800 text-white border-b-2 border-black sticky top-0 z-50">
      <div className="container mx-auto px-4 py-2.5 flex justify-between items-center text-sm">
        <div className="font-bold uppercase tracking-wider text-base">Gujarat Oil Depot</div>
        <div className="flex space-x-2 items-center">
          {userRole === 'admin' && (
            <>
              <button onClick={() => setView('depot')} className={`px-2 py-1 font-bold rounded-sm border ${view === 'depot' ? 'bg-white text-black border-gray-300' : 'bg-gray-700 border-gray-600 hover:bg-gray-600'}`}>OIL DEPOT</button>
              <button onClick={() => setView('retail')} className={`px-2 py-1 font-bold rounded-sm border ${view === 'retail' ? 'bg-white text-black border-gray-300' : 'bg-gray-700 border-gray-600 hover:bg-gray-600'}`}>RETAIL STORE</button>
              <button onClick={() => setView('admin')} className={`px-2 py-1 font-bold rounded-sm border ${view === 'admin' ? 'bg-white text-black border-gray-300' : 'bg-gray-700 border-gray-600 hover:bg-gray-600'}`}>ADMIN</button>
            </>
          )}
          
          {userRole !== 'admin' && (
            <span className="ml-2 bg-slate-900 px-2 py-1 rounded text-[10px] font-bold text-blue-300 border border-slate-600 uppercase">
              {userRole === 'depot' ? 'OIL DEPOT' : userRole === 'retail' ? 'RETAIL STORE' : userRole || 'USER'}
            </span>
          )}

          <button onClick={handleLogout} className="ml-2 bg-red-600 hover:bg-red-700 px-3 py-1 rounded-sm text-xs font-bold transition-colors border border-red-800">
            LOG OUT
          </button>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-gray-200 font-sans text-gray-900 selection:bg-blue-200">
      {renderNav()}

      <main className="container mx-auto p-3">
        {verifyModal && (
          <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex justify-center items-center p-4">
            <div className="bg-white border-2 border-black max-w-lg w-full p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <h2 className="text-base font-bold border-b-2 border-black pb-3 mb-4 uppercase">VERIFY GOODS: {verifyModal.challanNo}</h2>
              <div className="space-y-2 mb-6 max-h-72 overflow-y-auto">
                {verifyModal.items.map((item, idx) => (
                  <label key={idx} className={`flex items-center space-x-3 p-3 border-2 cursor-pointer transition-colors ${verifyModal.checks[idx] ? 'bg-green-100 border-green-600' : 'bg-gray-50 border-gray-300 hover:bg-gray-100'}`}>
                    <input type="checkbox" checked={verifyModal.checks[idx]} onChange={() => toggleVerifyCheck(idx)} className="w-5 h-5 cursor-pointer accent-black" />
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
          <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex justify-center items-center p-4">
            <div className="bg-white border-2 border-black max-w-xl w-full p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <h2 className="text-base font-bold border-b-2 border-black pb-3 mb-4 uppercase">REVIEW & DISPATCH: {editPOModal.groupId}</h2>
              <div className="space-y-2 mb-6 max-h-72 overflow-y-auto">
                <div className="flex text-xs font-bold text-gray-500 px-2 uppercase"><span className="flex-1">ITEM DESCRIPTION</span><span className="w-20 text-center">REQ</span><span className="w-20 text-center">DISPATCH</span></div>
                {editPOModal.items.map((item, idx) => (
                  <div key={idx} className="flex items-center space-x-3 bg-gray-100 border border-gray-300 p-2">
                    <span className="flex-1 text-sm font-bold text-gray-800 truncate" title={item.item_desc}>{item.item_desc}</span>
                    <span className="text-sm font-bold text-gray-600 w-20 text-center">{getDisplayQty(item.item_desc, item.req_qty, item.unit)}</span>
                    <input type="number" value={item.edit_qty} onChange={(e) => handleEditPOQty(idx, e.target.value)} className="w-20 text-sm p-1.5 border-2 border-black text-center font-bold focus:bg-yellow-50 focus:outline-none" />
                  </div>
                ))}
              </div>
              <div className="flex space-x-3">
                <button onClick={() => setEditPOModal(null)} className="flex-1 border-2 border-black bg-gray-200 py-3 text-sm font-bold hover:bg-gray-300">CANCEL</button>
                <button onClick={confirmDispatchPO} className="flex-1 border-2 border-black bg-blue-800 text-white py-3 text-sm font-bold hover:bg-blue-900">GENERATE CHALLAN</button>
              </div>
            </div>
          </div>
        )}

        {processReturnModal && (
          <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex justify-center items-center p-4">
            <div className="bg-white border-2 border-black max-w-xl w-full p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <h2 className="text-base font-bold border-b-2 border-black pb-3 mb-4 uppercase text-red-800">PROCESS DEPOT REQUEST: {processReturnModal.groupId}</h2>
              <div className="space-y-2 mb-6 max-h-72 overflow-y-auto">
                <div className="flex text-xs font-bold text-gray-500 px-2 uppercase"><span className="flex-1">ITEM DESCRIPTION</span><span className="w-20 text-center">REQ</span><span className="w-20 text-center">DISPATCH</span></div>
                {processReturnModal.items.map((item, idx) => (
                  <div key={idx} className="flex items-center space-x-3 bg-red-50 border border-red-300 p-2">
                    <span className="flex-1 text-sm font-bold text-gray-800 truncate" title={item.item_desc}>{item.item_desc}</span>
                    <span className="text-sm font-bold text-gray-600 w-20 text-center">{getDisplayQty(item.item_desc, item.req_qty, item.unit)}</span>
                    <input type="number" value={item.edit_qty} onChange={(e) => handleProcessReturnQty(idx, e.target.value)} className="w-20 text-sm p-1.5 border-2 border-black text-center font-bold focus:bg-yellow-50 focus:outline-none" />
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

        {/* === TERMINAL VIEWS === */}

        {view === 'unassigned' && (
          <div className="flex items-center justify-center mt-20">
            <div className="bg-red-100 border-2 border-red-600 p-8 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-w-md">
              <h2 className="text-xl font-black text-red-800 mb-2">NO TERMINAL ASSIGNED</h2>
              <p className="font-bold text-gray-800 text-sm">Your account does not have a valid role (Depot, Retail, or Admin) assigned in the database.</p>
            </div>
          </div>
        )}

        {view === 'depot' && (
          <div className="flex flex-col-reverse md:grid md:grid-cols-2 gap-4 items-start">
            
            <div className="w-full space-y-4">
              <div className="w-full bg-white border-2 border-gray-400 shadow-sm flex flex-col">
                <div className="bg-gray-200 border-b-2 border-gray-400 px-4 py-2.5 font-bold text-sm uppercase text-gray-800 flex justify-between items-center">
                  <span>Pending PO Inbox</span>
                  <span className="bg-gray-800 text-white px-2.5 py-0.5 rounded text-xs leading-none">{Object.keys(pendingPOs).length}</span>
                </div>
                <div className="p-3">
                  {Object.keys(pendingPOs).length === 0 ? <p className="text-sm text-gray-500 font-bold text-center py-4">NO PENDING ORDERS</p> : (
                    <div className="space-y-3">
                      {Object.entries(pendingPOs).map(([groupId, items]) => (
                        <div key={groupId} className="border-2 border-gray-300 bg-gray-50 p-3">
                          <div className="font-bold text-xs mb-2 text-gray-600 border-b border-gray-200 pb-1">{groupId}</div>
                          <table className="w-full mb-3 border-collapse text-sm">
                            <tbody>
                              {items.map((item, idx) => (
                                <tr key={idx} className="border-b border-gray-300 last:border-0">
                                  <td className="py-2 pr-2 font-medium text-gray-800">{item.item_desc}</td>
                                  <td className="py-2 text-right font-bold w-32 whitespace-nowrap">{getDisplayQty(item.item_desc, item.req_qty, item.unit || getUnit(item.item_desc))}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <button onClick={() => openEditPOModal(groupId, items)} className="w-full bg-blue-800 hover:bg-blue-900 text-white font-bold text-xs py-2 border-2 border-blue-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none">REVIEW & DISPATCH</button>
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
                <div className="p-3 max-h-64 overflow-y-auto">
                  {Object.keys(pendingReturns).length === 0 ? <p className="text-sm text-gray-500 font-bold text-center py-4">NO INCOMING RETURNS</p> : (
                    <div className="space-y-3">
                      {Object.entries(pendingReturns).map(([challanNo, items]) => (
                        <div key={challanNo} className="border-2 border-red-300 bg-red-50 p-3">
                          <div className="flex justify-between items-center mb-3 border-b-2 border-red-200 pb-2">
                            <span className="font-bold text-sm text-red-900">{challanNo}</span>
                            <button onClick={() => printPDF(challanNo, items)} className="text-[11px] font-bold bg-white border border-gray-400 px-3 py-1.5 shadow-sm hover:bg-gray-100 active:translate-y-px">VIEW DOC</button>
                          </div>
                          <button onClick={() => openVerifyModal(challanNo, items)} className="w-full bg-red-700 hover:bg-red-800 text-white font-bold text-xs py-2.5 border-2 border-red-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none">VERIFY & ACCEPT</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="w-full bg-white border-2 border-gray-400 shadow-sm flex flex-col">
              <div className="bg-gray-200 border-b-2 border-gray-400 px-4 py-2 font-bold flex space-x-2 text-sm uppercase text-gray-800">
                <button onClick={() => setDepotMode('DISPATCH')} className={`flex-1 py-1 rounded-sm border shadow-sm ${depotMode === 'DISPATCH' ? 'bg-white border-black text-black' : 'bg-gray-200 border-gray-400 text-gray-500 hover:bg-gray-300'}`}>DISPATCH GOODS</button>
                <button onClick={() => setDepotMode('RETURN_REQUEST')} className={`flex-1 py-1 rounded-sm border shadow-sm ${depotMode === 'RETURN_REQUEST' ? 'bg-red-50 border-red-500 text-red-800' : 'bg-gray-200 border-gray-400 text-gray-500 hover:bg-gray-300'}`}>REQUEST RETURN</button>
              </div>
              <div className="p-3 flex-1 flex flex-col">
                {depotCart.length > 0 && (
                  <div className={`${depotMode === 'RETURN_REQUEST' ? 'bg-red-50 border-red-300' : 'bg-blue-50 border-blue-300'} border-2 p-3 mb-4`}>
                    <table className="w-full border-collapse mb-3 text-sm">
                      <tbody>
                        {depotCart.map((item, idx) => (
                          <tr key={idx} className={`border-b ${depotMode === 'RETURN_REQUEST' ? 'border-red-200 hover:bg-red-100' : 'border-blue-200 hover:bg-blue-100'} last:border-0`}>
                            <td className="py-2 flex items-center gap-2">
                              <button onClick={() => removeDepotCartItem(idx)} className="text-red-600 bg-white border border-red-300 font-bold px-2 py-0.5 hover:bg-red-100 rounded shadow-sm">✕</button>
                              <span className="font-bold text-gray-900">{item.description}</span>
                            </td>
                            <td className="py-2 text-right w-40">
                              <div className="flex items-center justify-end gap-1">
                                <input type="number" value={item.disp_qty} onChange={(e) => updateDepotCartQty(idx, e.target.value)} className={`w-16 border-2 ${depotMode === 'RETURN_REQUEST' ? 'border-red-400 focus:border-red-600' : 'border-blue-400 focus:border-blue-600'} p-1 text-center font-bold focus:outline-none focus:bg-yellow-50`} />
                                <span className={`font-normal text-[10px] ${depotMode === 'RETURN_REQUEST' ? 'text-red-900' : 'text-blue-900'} whitespace-nowrap`}>{item.unit || getUnit(item.description)}</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {depotMode === 'RETURN_REQUEST' && (
                      <input 
                        type="text" 
                        value={depotReturnNote} 
                        onChange={(e) => setDepotReturnNote(e.target.value)} 
                        placeholder="ADD RETURN REMARKS / NOTE (OPTIONAL)" 
                        className="w-full border-2 border-red-400 p-2 text-sm font-bold focus:outline-none focus:border-red-600 focus:bg-yellow-50 mb-3" 
                      />
                    )}
                    <button onClick={submitDepotAction} className={`w-full text-white font-bold text-sm py-2.5 border-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none ${depotMode === 'RETURN_REQUEST' ? 'bg-red-700 hover:bg-red-800 border-red-900' : 'bg-blue-800 hover:bg-blue-900 border-blue-900'}`}>
                      {depotMode === 'RETURN_REQUEST' ? `SUBMIT REQUEST (${depotCart.length})` : `ISSUE CHALLAN (${depotCart.length})`}
                    </button>
                  </div>
                )}
                
                <form onSubmit={addToDepotCart} className="mt-auto bg-gray-100 border-2 border-gray-300 p-3">
                  <div className="flex flex-col space-y-3">
                    <div className="relative">
                      <label className="block text-xs font-bold text-gray-700 mb-1">SEARCH ITEM</label>
                      <input type="text" value={searchQuery} onKeyDown={(e) => handleKeyDown(e, depotFilteredItems, setSelectedItem, setSearchQuery, null, setSelectedUnit, 'depot-item')} onChange={(e) => { setSearchQuery(e.target.value); setSelectedItem(null); setHighlightIndex(-1); }} className="w-full border-2 border-gray-400 p-2.5 text-sm font-bold focus:outline-none focus:border-black focus:bg-yellow-50" placeholder="TYPE TO SEARCH..." />
                      {searchQuery.length > 0 && depotFilteredItems.length > 0 && !selectedItem && (
                        <div className="absolute z-10 w-full max-h-56 overflow-y-auto bg-white border-2 border-gray-400 mt-1 shadow-xl text-sm font-bold">
                          {depotFilteredItems.map((item, i) => <div id={`depot-item-${i}`} key={i} onClick={() => handleItemSelect(item, setSelectedItem, setSelectedUnit, setSearchQuery, null)} className={`p-3 cursor-pointer border-b border-gray-200 ${highlightIndex === i ? 'bg-gray-800 text-white' : 'hover:bg-gray-100'}`}>{item.description}</div>)}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-gray-700 mb-1">QTY</label>
                        <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} className="w-full border-2 border-gray-400 p-2.5 text-sm font-bold focus:outline-none focus:border-black focus:bg-yellow-50" placeholder="0" />
                      </div>
                      <div className="w-28">
                        <label className="block text-xs font-bold text-gray-700 mb-1">UNIT</label>
                        {selectedItem?.category === 'TVS' ? (
                           <select value={selectedUnit} onChange={(e) => setSelectedUnit(e.target.value)} className="w-full border-2 border-gray-400 p-2.5 bg-white text-sm font-bold focus:outline-none cursor-pointer">
                              <option value="PCS">PCS</option>
                              <option value="SET">SET</option>
                           </select>
                        ) : (
                           <input type="text" value={selectedUnit} disabled className="w-full border-2 border-gray-200 p-2.5 bg-gray-200 text-gray-500 text-sm font-bold" />
                        )}
                      </div>
                    </div>
                    <button type="submit" className={`w-full text-white font-bold text-xs py-2.5 border-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none mt-2 ${depotMode === 'RETURN_REQUEST' ? 'bg-red-800 hover:bg-red-900 border-black' : 'bg-gray-800 hover:bg-black border-black'}`}>
                      + ADD TO {depotMode === 'RETURN_REQUEST' ? 'RETURN' : 'CART'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {view === 'retail' && (
          <div className="flex flex-col-reverse md:grid md:grid-cols-2 gap-4 items-start">
            <div className="w-full bg-white border-2 border-gray-400 shadow-sm flex flex-col">
              <div className="bg-gray-200 border-b-2 border-gray-400 px-4 py-2.5 font-bold text-sm uppercase text-gray-800">Incoming Deliveries & Backorders</div>
              <div className="p-3 flex-1 overflow-y-auto">
                
                <div className="mb-4">
                  <h3 className="text-xs font-bold text-gray-500 mb-2 border-b border-gray-300 pb-1">TO RECEIVE</h3>
                  {Object.keys(incomingDeliveries).length === 0 ? <p className="text-sm text-gray-400 font-bold text-center py-2">NO INCOMING GOODS</p> : (
                    <div className="space-y-4">
                      {Object.entries(incomingDeliveries).map(([challanNo, items]) => (
                        <div key={challanNo} className="border-2 border-gray-300 bg-gray-50 p-3">
                          <div className="flex justify-between items-center mb-3 border-b-2 border-gray-200 pb-2">
                            <span className="font-bold text-sm text-gray-900">{challanNo}</span>
                            <button onClick={() => printPDF(challanNo, items)} className="text-[11px] font-bold bg-white border border-gray-400 px-3 py-1.5 shadow-sm hover:bg-gray-100 active:translate-y-px">VIEW DOC</button>
                          </div>
                          <button onClick={() => openVerifyModal(challanNo, items)} className="w-full bg-green-700 hover:bg-green-800 text-white font-bold text-xs py-2.5 border-2 border-green-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none">START VERIFICATION</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <h3 className="text-xs font-bold text-red-500 mb-2 border-b border-gray-300 pb-1">DEPOT RETURN REQUESTS</h3>
                  {Object.keys(pendingDepotReturns).length === 0 ? <p className="text-sm text-gray-400 font-bold text-center py-2">NO PENDING REQUESTS</p> : (
                    <div className="space-y-3">
                      {Object.entries(pendingDepotReturns).map(([groupId, items]) => (
                        <div key={groupId} className="border border-red-300 bg-red-50 p-2">
                          <div className="font-bold text-[10px] text-red-800 mb-1">{groupId}</div>
                          {items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-xs text-gray-800 pb-1">
                              <span className="truncate pr-2 font-bold">{item.item_desc}</span>
                              <span className="font-bold whitespace-nowrap">{getDisplayQty(item.item_desc, item.req_qty, item.unit || getUnit(item.item_desc))}</span>
                            </div>
                          ))}
                          <button onClick={() => openProcessReturnModal(groupId, items)} className="w-full mt-2 bg-red-700 hover:bg-red-800 text-white font-bold text-[11px] py-2 border-2 border-red-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none">PROCESS REQUEST</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-xs font-bold text-gray-500 mb-2 border-b border-gray-300 pb-1">BACKORDERS / PROCESSING</h3>
                  {Object.keys(pendingPOs).length === 0 ? <p className="text-sm text-gray-400 font-bold text-center py-2">NO PENDING POs</p> : (
                    <div className="space-y-3">
                      {Object.entries(pendingPOs).map(([groupId, items]) => (
                        <div key={groupId} className="border border-orange-300 bg-orange-50 p-2">
                          <div className="font-bold text-[10px] text-orange-800 mb-1">{groupId}</div>
                          {items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-xs text-gray-800 pb-1">
                              <span className="truncate pr-2 font-bold">{item.item_desc}</span>
                              <span className="font-bold whitespace-nowrap">{getDisplayQty(item.item_desc, item.req_qty, item.unit || getUnit(item.item_desc))}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>

            <div className="w-full bg-white border-2 border-gray-400 shadow-sm flex flex-col">
              <div className="bg-gray-200 border-b-2 border-gray-400 px-4 py-2 font-bold flex space-x-2 text-sm uppercase text-gray-800">
                <button onClick={() => setRetailMode('PO')} className={`flex-1 py-1 rounded-sm border shadow-sm ${retailMode === 'PO' ? 'bg-white border-black text-black' : 'bg-gray-200 border-gray-400 text-gray-500 hover:bg-gray-300'}`}>ORDER GOODS</button>
                <button onClick={() => setRetailMode('RETURN')} className={`flex-1 py-1 rounded-sm border shadow-sm ${retailMode === 'RETURN' ? 'bg-red-50 border-red-500 text-red-800' : 'bg-gray-200 border-gray-400 text-gray-500 hover:bg-gray-300'}`}>RETURN GOODS</button>
              </div>
              <div className="p-3 flex-1 flex flex-col">
                {retailCart.length > 0 && (
                  <div className={`${retailMode === 'RETURN' ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'} border-2 p-3 mb-4`}>
                    <table className="w-full border-collapse mb-3 text-sm">
                      <tbody>
                        {retailCart.map((item, idx) => (
                          <tr key={idx} className={`border-b ${retailMode === 'RETURN' ? 'border-red-200 hover:bg-red-100' : 'border-green-200 hover:bg-green-100'} last:border-0`}>
                            <td className="py-2 flex items-center gap-2">
                              <button onClick={() => removeRetailCartItem(idx)} className="text-red-600 bg-white border border-red-300 font-bold px-2 py-0.5 hover:bg-red-100 rounded shadow-sm">✕</button>
                              <span className="font-bold text-gray-900">{item.description}</span>
                            </td>
                            <td className="py-2 text-right w-40">
                               <div className="flex items-center justify-end gap-1">
                                <input type="number" value={item.req_qty} onChange={(e) => updateRetailCartQty(idx, e.target.value)} className={`w-16 border-2 ${retailMode === 'RETURN' ? 'border-red-400 focus:border-red-600' : 'border-green-400 focus:border-green-600'} p-1 text-center font-bold focus:outline-none focus:bg-yellow-50`} />
                                <span className={`font-normal text-[10px] ${retailMode === 'RETURN' ? 'text-red-900' : 'text-green-900'} whitespace-nowrap`}>{item.unit || getUnit(item.description)}</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {retailMode === 'RETURN' && (
                      <input 
                        type="text" 
                        value={retailReturnNote} 
                        onChange={(e) => setRetailReturnNote(e.target.value)} 
                        placeholder="ADD RETURN REMARKS / NOTE (OPTIONAL)" 
                        className="w-full border-2 border-red-400 p-2 text-sm font-bold focus:outline-none focus:border-red-600 focus:bg-yellow-50 mb-3" 
                      />
                    )}
                    <button onClick={submitRetailAction} className={`w-full text-white font-bold text-sm py-2.5 border-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none ${retailMode === 'RETURN' ? 'bg-red-700 hover:bg-red-800 border-red-900' : 'bg-green-700 hover:bg-green-800 border-green-900'}`}>
                      {retailMode === 'RETURN' ? `SUBMIT RETURN (${retailCart.length})` : `SUBMIT P.O. (${retailCart.length})`}
                    </button>
                  </div>
                )}
                
                <form onSubmit={addToRetailCart} className="mt-auto bg-gray-100 border-2 border-gray-300 p-3">
                  <div className="flex flex-col space-y-3">
                    <div className="relative">
                      <label className="block text-xs font-bold text-gray-700 mb-1">SEARCH ITEM</label>
                      <input type="text" value={retailSearch} onFocus={() => setIsRetailDropdownOpen(true)} onKeyDown={(e) => handleKeyDown(e, retailFilteredItems, setRetailSelectedItem, setRetailSearch, setIsRetailDropdownOpen, setRetailSelectedUnit, 'retail-item')} onChange={(e) => { setRetailSearch(e.target.value); setRetailSelectedItem(null); setIsRetailDropdownOpen(true); setHighlightIndex(-1); }} className="w-full border-2 border-gray-400 p-2.5 text-sm font-bold focus:outline-none focus:border-black focus:bg-yellow-50" placeholder="TYPE TO SEARCH..." />
                      {retailSearch.length > 0 && isRetailDropdownOpen && (
                        <div className="absolute z-10 w-full max-h-56 overflow-y-auto bg-white border-2 border-gray-400 mt-1 shadow-xl text-sm font-bold">
                          {retailFilteredItems.map((item, i) => <div id={`retail-item-${i}`} key={i} onClick={() => handleItemSelect(item, setRetailSelectedItem, setRetailSelectedUnit, setRetailSearch, setIsRetailDropdownOpen)} className={`p-3 cursor-pointer border-b border-gray-200 ${highlightIndex === i ? 'bg-gray-800 text-white' : 'hover:bg-gray-100'}`}><span className="text-[10px] font-bold text-gray-500 mr-2">[{item.category}]</span>{item.description}</div>)}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-gray-700 mb-1">QTY</label>
                        <input type="number" value={retailQty} onChange={(e) => setRetailQty(e.target.value)} className="w-full border-2 border-gray-400 p-2.5 text-sm font-bold focus:outline-none focus:border-black focus:bg-yellow-50" placeholder="0" />
                      </div>
                      <div className="w-28">
                        <label className="block text-xs font-bold text-gray-700 mb-1">UNIT</label>
                        {retailSelectedItem?.category === 'TVS' ? (
                           <select value={retailSelectedUnit} onChange={(e) => setRetailSelectedUnit(e.target.value)} className="w-full border-2 border-gray-400 p-2.5 bg-white text-sm font-bold focus:outline-none cursor-pointer">
                              <option value="PCS">PCS</option>
                              <option value="SET">SET</option>
                           </select>
                        ) : (
                           <input type="text" value={retailSelectedUnit} disabled className="w-full border-2 border-gray-200 p-2.5 bg-gray-200 text-gray-500 text-sm font-bold" />
                        )}
                      </div>
                    </div>
                    <button type="submit" className={`w-full text-white font-bold text-xs py-2.5 border-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none mt-2 ${retailMode === 'RETURN' ? 'bg-red-800 hover:bg-red-900 border-black' : 'bg-gray-800 hover:bg-black border-black'}`}>
                      + ADD TO {retailMode === 'RETURN' ? 'RETURN' : 'ORDER'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ADMIN SCREEN */}
        {view === 'admin' && isAdminAuth && (
          <div className="bg-white border-2 border-gray-400 shadow-sm flex flex-col">
              <div className="p-3 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-gray-100 border-2 border-gray-300 p-3 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-sm text-gray-800">Item Register</div>
                      <div className="text-[10px] font-bold text-gray-600 mt-1 uppercase">{uploadStatus}</div>
                    </div>
                    <label className="bg-white border-2 border-gray-400 hover:bg-gray-200 px-4 py-2 rounded-sm text-xs font-bold cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none">
                      UPLOAD EXCEL <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
                    </label>
                  </div>
                  <div className="bg-gray-100 border-2 border-gray-300 p-3 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-sm text-gray-800">Export Ledger</div>
                      <div className="text-[10px] font-bold text-gray-600 mt-1">Excel File</div>
                    </div>
                    <button onClick={downloadLedger} className="bg-blue-800 hover:bg-blue-900 text-white font-bold px-4 py-2 border-2 border-blue-900 text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none">DOWNLOAD</button>
                  </div>
                </div>

                <div className="border-2 border-gray-400 bg-white shadow-sm">
                  <div className="overflow-x-auto max-h-[60vh]">
                    <table className="w-full text-left border-collapse whitespace-nowrap text-sm">
                      <thead className="sticky top-0 bg-gray-100 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
                        <tr className="text-gray-800 border-b-2 border-gray-400">
                          <th className="p-3 font-bold border-r border-gray-300 w-24 text-center">DATE / TIME</th>
                          <th className="p-3 font-bold border-r border-gray-300">CHALLAN NO</th>
                          <th className="p-3 font-bold border-r border-gray-300 w-1/2">ITEM DESCRIPTION</th>
                          <th className="p-3 font-bold text-center border-r border-gray-300">NOS</th>
                          <th className="p-3 font-bold border-r border-gray-300 text-center">QTY</th>
                          <th className="p-3 font-bold text-center">ACTION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.values(
                          ledgerData.reduce((acc, row) => {
                            const key = row.challan_no || row.group_id; 
                            if (!acc[key]) {
                                acc[key] = { 
                                    date: row.timestamp, 
                                    challan_no: row.challan_no, 
                                    group_id: row.group_id, 
                                    status: row.status, 
                                    items: [], 
                                    admin_note: row.admin_note || '', 
                                    keyField: row.challan_no ? 'challan_no' : 'group_id', 
                                    keyValue: key 
                                };
                            }
                            if (row.admin_note && !acc[key].admin_note) {
                                acc[key].admin_note = row.admin_note;
                            }
                            acc[key].items.push(row);
                            return acc;
                          }, {})
                        ).sort((a, b) => new Date(b.date) - new Date(a.date)).length === 0 ? (
                          <tr><td colSpan="6" className="p-6 text-center text-gray-500 font-bold text-sm">NO RECORDS FOUND</td></tr>
                        ) : (
                          Object.values(
                            ledgerData.reduce((acc, row) => {
                              const key = row.challan_no || row.group_id; 
                              if (!acc[key]) {
                                  acc[key] = { 
                                      date: row.timestamp, 
                                      challan_no: row.challan_no, 
                                      group_id: row.group_id, 
                                      status: row.status, 
                                      items: [], 
                                      admin_note: row.admin_note || '', 
                                      keyField: row.challan_no ? 'challan_no' : 'group_id', 
                                      keyValue: key 
                                  };
                              }
                              if (row.admin_note && !acc[key].admin_note) {
                                  acc[key].admin_note = row.admin_note;
                              }
                              acc[key].items.push(row);
                              return acc;
                            }, {})
                          ).sort((a, b) => new Date(b.date) - new Date(a.date)).map((group, idx) => {
                            
                            let rowBg = "bg-white hover:bg-gray-50";
                            if(group.status === "ACCEPTED") rowBg = "bg-green-50 hover:bg-green-100";
                            else if(group.status === "RETURN_ACCEPTED") rowBg = "bg-red-50 hover:bg-red-100";
                            else if(group.status === "DISPATCHED") rowBg = "bg-blue-50 hover:bg-blue-100";

                            return (
                              <tr key={idx} className={`border-b border-gray-200 ${rowBg} align-top`}>
                                <td className="p-3 border-r border-gray-200 text-gray-900 font-bold text-xs text-center leading-tight">
                                  {formatDate(group.date)}<br/><span className="text-gray-900 font-bold text-xs">{formatTime(group.date)}</span>
                                </td>
                                <td className="p-3 border-r border-gray-200 font-bold text-gray-900 text-xs">
                                  {group.challan_no || '-'}
                                  
                                  {/* NEW ADMIN NOTE UI SECTION */}
                                  {group.status !== 'RETURN_ACCEPTED' && (
                                    <div className="mt-3 bg-gray-50 border border-gray-300 p-2 shadow-inner rounded max-w-[200px]">
                                      <div className="flex justify-between items-center mb-1">
                                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wide">ADMIN NOTE</span>
                                        {!editingNoteId || editingNoteId !== group.keyValue ? (
                                          <button 
                                            onClick={() => { setEditingNoteId(group.keyValue); setTempNoteText(group.admin_note || ""); }}
                                            className="text-[9px] text-blue-600 hover:text-blue-800 font-bold underline"
                                          >
                                            EDIT
                                          </button>
                                        ) : null}
                                      </div>
                                      
                                      {editingNoteId === group.keyValue ? (
                                        <div className="space-y-2">
                                          <textarea
                                            className="w-full border border-gray-400 p-1.5 text-[11px] font-bold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none whitespace-pre-wrap break-words"
                                            rows="3"
                                            value={tempNoteText}
                                            onChange={(e) => setTempNoteText(e.target.value)}
                                            placeholder="ENTER NOTE..."
                                            autoFocus
                                          />
                                          <div className="flex space-x-2">
                                            <button onClick={() => saveAdminNote(group.keyField, group.keyValue)} className="bg-blue-600 text-white px-2 py-1 text-[10px] font-bold uppercase hover:bg-blue-700 flex-1 rounded-sm shadow-sm">SAVE</button>
                                            <button onClick={() => setEditingNoteId(null)} className="bg-gray-200 text-gray-800 px-2 py-1 text-[10px] font-bold uppercase hover:bg-gray-300 flex-1 rounded-sm border border-gray-300 shadow-sm">CANCEL</button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="min-h-[40px] text-[11px] font-bold text-gray-800 whitespace-pre-wrap break-words">
                                          {group.admin_note ? group.admin_note : <span className="italic text-gray-400 font-normal">No note added.</span>}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                </td>
                                <td className="p-3 border-r border-gray-200">
                                  <ul className="space-y-1">
                                    {group.items.map((item, i) => (
                                      <li key={i} className="h-7 flex items-center text-sm font-bold text-gray-800">
                                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full flex-shrink-0 mr-2"></span>
                                        <span className="truncate max-w-[200px] md:max-w-[400px]" title={item.item_desc}>{item.item_desc}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </td>
                                <td className="p-3 border-r border-gray-200 text-center">
                                  <ul className="space-y-1">
                                    {group.items.map((item, i) => {
                                      const rawQty = parseInt(item.disp_qty || item.req_qty) || 0;
                                      return (
                                        <li key={i} className={`h-7 flex items-center justify-center text-xs font-bold ${group.status === 'RETURN_ACCEPTED' ? 'text-red-900' : 'text-gray-900'}`}>
                                          {group.status === 'RETURN_ACCEPTED' ? '-' : ''}{String(rawQty).padStart(2, '0')}
                                        </li>
                                      )
                                    })}
                                  </ul>
                                </td>
                                <td className="p-3 border-r border-gray-200 text-center">
                                  <ul className="space-y-1">
                                    {group.items.map((item, i) => {
                                      const rawQty = parseInt(item.disp_qty || item.req_qty) || 0;
                                      // STRICT MATH CHECK HERE
                                      const reqQ = Number(item.req_qty);
                                      const dispQ = Number(item.disp_qty);
                                      const isChanged = Boolean(item.req_qty) && Boolean(item.disp_qty) && reqQ > 0 && dispQ > 0 && reqQ !== dispQ;
                                      
                                      return (
                                        <li key={i} className={`h-7 flex items-center justify-center text-xs font-bold ${isChanged || group.status === 'RETURN_ACCEPTED' ? 'text-red-600' : 'text-gray-900'}`}>
                                          {getDisplayQty(item.item_desc, rawQty, item.unit || getUnit(item.item_desc))}
                                        </li>
                                      )
                                    })}
                                  </ul>
                                </td>
                                <td className="p-3 text-center">
                                  {group.challan_no && isWithin30Days(group.date) ? (
                                    <button onClick={() => {
                                        const fullChallanItems = ledgerData.filter(i => i.challan_no === group.challan_no);
                                        printPDF(group.challan_no, fullChallanItems);
                                      }} 
                                      className="mt-1 text-[10px] font-bold bg-white border border-gray-400 text-gray-800 hover:bg-gray-100 px-2.5 py-1 rounded-sm shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-y-px active:shadow-none"
                                    >
                                      PDF
                                    </button>
                                  ) : group.challan_no ? (
                                    <span className="mt-1 inline-block text-[10px] text-gray-400 font-bold">LOCKED</span>
                                  ) : (
                                    <span className="mt-1 inline-block text-gray-300">-</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
          </div>
        )}
      </main>
    </div>
  );
}