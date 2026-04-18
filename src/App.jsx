/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/no-unescaped-entities */
import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

// --- HARDWARE ENGINES (Audio & Haptics) ---
let globalAudioCtx = null;
const initAudio = () => {
  if (!globalAudioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) globalAudioCtx = new AudioCtx();
  }
  if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
    globalAudioCtx.resume();
  }
};

const playChime = () => {
  try {
    if (!globalAudioCtx) return;
    const osc = globalAudioCtx.createOscillator();
    const gainNode = globalAudioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, globalAudioCtx.currentTime); 
    osc.frequency.exponentialRampToValueAtTime(440, globalAudioCtx.currentTime + 0.3); 
    gainNode.gain.setValueAtTime(0.3, globalAudioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, globalAudioCtx.currentTime + 0.5);
    osc.connect(gainNode);
    gainNode.connect(globalAudioCtx.destination);
    osc.start();
    osc.stop(globalAudioCtx.currentTime + 0.5);
  } catch (e) { console.warn("Audio API failed"); }
};

const triggerHaptic = (pattern = 40) => {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch (e) { /* ignore */ }
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

// --- HYPER-STRICT DATA CLEANERS ---
const cleanDesc = (d) => String(d).replace(/\s+/g, ' ').trim().toUpperCase();
const normalizeString = (str) => {
    if (!str) return '';
    return String(str).toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
};

export default function App() {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false); 
  const [workerName, setWorkerName] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // ANTI-DOUBLE-CLICK LOCK
  const [isProcessing, setIsProcessing] = useState(false);

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState(() => {
    const saved = localStorage.getItem('god_offline_queue');
    return saved ? JSON.parse(saved) : [];
  });
  const [isSyncing, setIsSyncing] = useState(false);

  const [view, setView] = useState(''); 
  const [masterItems, setMasterItems] = useState([]);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [uploadStatus, setUploadStatus] = useState('WAITING UPLOAD');
  const [ledgerData, setLedgerData] = useState([]);
  
  const [ledgerLimit, setLedgerLimit] = useState(50);
  const [ledgerMonth, setLedgerMonth] = useState(new Date().getMonth());
  const [ledgerYear, setLedgerYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([new Date().getFullYear()]);
  const [availableMonths, setAvailableMonths] = useState([new Date().getMonth()]);
  
  const [openNoteId, setOpenNoteId] = useState(null);
  const [tempNoteText, setTempNoteText] = useState("");
  
  // SMART ACCORDION STATE
  const [expandedGroups, setExpandedGroups] = useState({});

  const [depotMode, setDepotMode] = useState('DISPATCH'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [qty, setQty] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState('NOS'); 
  const [depotCart, setDepotCart] = useState([]); 
  const [depotReturnNote, setDepotReturnNote] = useState(''); 
  const [isDepotDropdownOpen, setIsDepotDropdownOpen] = useState(false);

  const [retailMode, setRetailMode] = useState('PO'); 
  const [retailSearch, setRetailSearch] = useState('');
  const [retailQty, setRetailQty] = useState('');
  const [retailSelectedItem, setRetailSelectedItem] = useState(null);
  const [retailSelectedUnit, setRetailSelectedUnit] = useState('NOS'); 
  const [retailReturnNote, setRetailReturnNote] = useState(''); 
  const [isRetailDropdownOpen, setIsRetailDropdownOpen] = useState(false);
  const [retailCart, setRetailCart] = useState([]); 
  
  const [pendingPOs, setPendingPOs] = useState({}); 
  const [incomingDeliveries, setIncomingDeliveries] = useState({});
  const [pendingReturns, setPendingReturns] = useState({});
  const [pendingDepotReturns, setPendingDepotReturns] = useState({});

  const [verifyModal, setVerifyModal] = useState(null);
  const [editPOModal, setEditPOModal] = useState(null);
  const [processReturnModal, setProcessReturnModal] = useState(null);

  const [deleteModal, setDeleteModal] = useState(null);
  const [masterEditModal, setMasterEditModal] = useState(null);
  const [settingsModal, setSettingsModal] = useState(false);
  const [emergencyUrl, setEmergencyUrl] = useState(() => localStorage.getItem('god_emg_url') || '');

  const [actionableCount, setActionableCount] = useState(0);

  const [toasts, setToasts] = useState([]);
  
  const triggerSystemAlert = (title, body, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, title, body, type }]);
    setTimeout(() => { setToasts(prev => prev.filter(t => t.id !== id)); }, 4000);

    if (document.visibilityState !== 'visible') {
      playChime();
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body: body, icon: '/pwa-512x512.png' });
      }
    }
  };

  const depotSearchRef = useRef(null);
  const depotQtyRef = useRef(null);
  const retailSearchRef = useRef(null);
  const retailQtyRef = useRef(null);

  const monthNames = ["JAN", "FEB", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUG", "SEPT", "OCT", "NOV", "DEC"];

  useEffect(() => {
    const timer = setTimeout(() => {
       if(loadingAuth) setLoadingAuth(false);
    }, 4500);
    return () => clearTimeout(timer);
  }, [loadingAuth]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('click', initAudio, { once: true });
    window.addEventListener('touchstart', initAudio, { once: true });
    window.addEventListener('keydown', initAudio, { once: true });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('god_offline_queue', JSON.stringify(offlineQueue));
    if (isOnline && offlineQueue.length > 0) syncOfflineQueue();
  }, [offlineQueue, isOnline]);

  useEffect(() => {
    if (isOnline && session) {
      const fetchMonths = async () => {
        const startDate = new Date(ledgerYear, 0, 1).toISOString();
        const endDate = new Date(ledgerYear, 11, 31, 23, 59, 59, 999).toISOString();
        const { data } = await supabase.from('transactions').select('timestamp').gte('timestamp', startDate).lte('timestamp', endDate);
        if (data && data.length > 0) {
            const months = [...new Set(data.map(d => new Date(d.timestamp).getMonth()))].sort((a,b) => b - a);
            setAvailableMonths(months);
            if (!months.includes(ledgerMonth)) setLedgerMonth(months[0]);
        } else {
            setAvailableMonths([new Date().getMonth()]);
        }
      };
      fetchMonths();
    }
  }, [ledgerYear, isOnline, session]);

  useEffect(() => {
    document.title = "GOD eChallan";
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (session) {
          setSession(session);
          await fetchRole(session.user.id);
        } else {
          setLoadingAuth(false);
        }
      } catch (err) { setLoadingAuth(false); }
    };
    
    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setSession(null); setUserRole(null); setView(''); setLoadingAuth(false);
      } else if (session) {
        setSession(session); fetchRole(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const isDesktop = window.innerWidth > 768;
    if (isDesktop) {
      if (view === 'depot') setTimeout(() => depotSearchRef.current?.focus(), 100);
      if (view === 'retail') setTimeout(() => retailSearchRef.current?.focus(), 100);
    }
  }, [view, depotMode, retailMode]);

  async function fetchRole(userId) {
    try {
      const { data, error } = await supabase.from('users').select('role').eq('id', userId).single();
      if (error) throw error;
      if (data) {
        const currentRole = data.role ? data.role.toLowerCase().trim() : 'unassigned';
        setUserRole(currentRole);
        fetchAvailableYears();

        if (currentRole === 'master' || currentRole === 'admin') setView('ledger'); 
        else if (currentRole === 'retail') setView('retail'); 
        else if (currentRole === 'depot') setView('depot'); 
        else setView('unassigned'); 
      }
    } catch (err) {
    } finally { setLoadingAuth(false); }
  }

  async function handleLogin(e) {
    e.preventDefault(); 
    triggerHaptic([30, 50]);
    initAudio(); 
    if (!isOnline) { setLoginError("Internet required for initial login."); return; }
    setLoginError(''); setIsLoggingIn(true); 
    const hiddenEmail = `${workerName.trim().toLowerCase()}@god.com.in`;
    const { data, error } = await supabase.auth.signInWithPassword({ email: hiddenEmail, password: "123456" });
    if (error) { setLoginError(`System Error: ${error.message}`); setIsLoggingIn(false); return; }
    
    if (data?.user) {
      await fetchRole(data.user.id);
      
      if (window.OneSignalDeferred) {
        window.OneSignalDeferred.push(async function(OneSignal) {
          await OneSignal.init({
            appId: "YOUR_ONESIGNAL_APP_ID_HERE", 
            safari_web_id: "web.onesignal.auto.YOUR_SAFARI_ID", 
            notifyButton: { enable: true },
          });
          OneSignal.User.PushSubscription.optIn();
          const { data: roleData } = await supabase.from('users').select('role').eq('id', data.user.id).single();
          if (roleData && roleData.role) {
             OneSignal.User.addTag("role", roleData.role.toLowerCase().trim());
          }
        });
      }
      
      if ("Notification" in window && Notification.permission === "default" && !localStorage.getItem("god_notif_asked")) {
        Notification.requestPermission().then(() => { localStorage.setItem("god_notif_asked", "true"); });
      }
    }
    setIsLoggingIn(false);
  }

  const fetchAvailableYears = async () => {
    if(!isOnline) return;
    try {
      const { data } = await supabase.from('transactions').select('timestamp').order('timestamp', { ascending: true }).limit(1);
      const currentYear = new Date().getFullYear();
      if (data && data.length > 0) {
        const firstYear = new Date(data[0].timestamp).getFullYear();
        const years = []; for (let i = firstYear; i <= currentYear; i++) years.push(i);
        setAvailableYears(years.reverse());
      } else { setAvailableYears([currentYear]); }
    } catch(e) {}
  };

  const fetchMasterItems = async () => {
    if(!isOnline) return;
    try {
      const { data, error } = await supabase.from('master_items').select('*');
      if (error) throw error;
      if (data && data.length > 0) {
        setMasterItems(data); setUploadStatus(`${data.length} SKUs AVAILABLE`);
        localStorage.setItem('god_cached_items', JSON.stringify(data));
      } else {
        const cached = localStorage.getItem('god_cached_items');
        if (cached) { setMasterItems(JSON.parse(cached)); setUploadStatus('OFFLINE CACHE ACTIVE'); }
        else { setMasterItems([]); setUploadStatus('WAITING UPLOAD'); }
      }
    } catch (err) {
      const cached = localStorage.getItem('god_cached_items');
      if (cached) { setMasterItems(JSON.parse(cached)); setUploadStatus('OFFLINE CACHE ACTIVE'); }
    }
  };

  const fetchPendingData = async () => {
    if(!isOnline) return;
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

  const fetchLedgerData = async () => {
    if (!session || !isOnline) return;
    const startDate = new Date(ledgerYear, ledgerMonth, 1).toISOString();
    const endDate = new Date(ledgerYear, ledgerMonth + 1, 0, 23, 59, 59, 999).toISOString();
    const { data } = await supabase.from('transactions').select('*').in('status', ['ACCEPTED', 'DISPATCHED', 'RETURN_ACCEPTED', 'DELETED']).gte('timestamp', startDate).lte('timestamp', endDate).order('timestamp', { ascending: false }).limit(ledgerLimit);
    if (data) setLedgerData(data);
  };

  const refreshAllData = async () => {
    if (!session) return;
    await Promise.all([ fetchMasterItems(), fetchPendingData(), fetchLedgerData() ]);
  };

  useEffect(() => { refreshAllData(); }, [session, ledgerMonth, ledgerYear, ledgerLimit]);

  useEffect(() => {
    let count = 0;
    if (userRole === 'depot') count = Object.keys(pendingPOs).length + Object.keys(pendingReturns).length;
    else if (userRole === 'retail') count = Object.keys(incomingDeliveries).length + Object.keys(pendingDepotReturns).length;
    else if (userRole === 'admin' || userRole === 'master') count = Object.keys(pendingPOs).length + Object.keys(pendingDepotReturns).length + Object.keys(incomingDeliveries).length + Object.keys(pendingReturns).length;
    
    setActionableCount(count);
    if (navigator.setAppBadge) {
      if (count > 0) navigator.setAppBadge(count).catch(() => {});
      else navigator.clearAppBadge().catch(() => {});
    }
  }, [pendingPOs, pendingDepotReturns, incomingDeliveries, pendingReturns, userRole]);

  useEffect(() => {
    if (!session || !userRole || !isOnline) return;
    const channel = supabase.channel('realtime-system').on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            if (payload.new.status === 'PO_PLACED' && (userRole === 'admin' || userRole === 'master' || userRole === 'depot')) { triggerSystemAlert("New Order", `Order ${payload.new.group_id} has been received.`); refreshAllData(); }
            if (payload.new.status === 'RETURN_REQUESTED' && (userRole === 'admin' || userRole === 'master' || userRole === 'retail')) { triggerSystemAlert("Return Request", `Return Request ${payload.new.group_id} has been submitted.`); refreshAllData(); }
          }
          if (payload.eventType === 'UPDATE') {
             if (payload.old.status === 'PO_PLACED' && payload.new.status === 'DISPATCHED' && userRole === 'retail') { triggerSystemAlert("Goods Dispatched", `Goods dispatched under Challan ${payload.new.challan_no}`); refreshAllData(); }
             if (payload.old.status === 'RETURN_REQUESTED' && payload.new.status === 'RETURN_INITIATED' && userRole === 'depot') { triggerSystemAlert("Incoming Return", `Incoming Return: ${payload.new.challan_no}`); refreshAllData(); }
          }
          if (payload.eventType === 'DELETE' && userRole === 'retail') { triggerSystemAlert("Order Cancelled", "A pending item has been cancelled by the Depot."); refreshAllData(); }
        }).subscribe();
    return () => supabase.removeChannel(channel);
  }, [session, userRole, isOnline]);

  const syncOfflineQueue = async () => {
    if (!isOnline || offlineQueue.length === 0 || isSyncing) return;
    setIsSyncing(true); let remaining = [...offlineQueue]; let syncedCount = 0;
    for (const item of offlineQueue) {
      const { error } = await supabase.from('transactions').insert(item.payload);
      if (!error) { remaining = remaining.filter(q => q.id !== item.id); syncedCount++; }
    }
    setOfflineQueue(remaining); setIsSyncing(false);
    if (syncedCount > 0) { triggerSystemAlert("Sync Complete", `${syncedCount} offline record(s) uploaded.`); refreshAllData(); }
  };

  const executeTransaction = async (txPayload, alertTitle, alertMsg, onSuccess) => {
    if (onSuccess) onSuccess(); 
    if (isOnline) {
      const { error } = await supabase.from('transactions').insert(txPayload);
      if (error) {
         setOfflineQueue(prev => [...prev, { id: Date.now(), payload: txPayload }]);
         triggerSystemAlert("Saved Offline", `${alertMsg} (Network issue, will sync later)`, 'warning');
      } else { 
         triggerSystemAlert(alertTitle, alertMsg, 'success'); 
         refreshAllData(); 
      }
    } else {
      setOfflineQueue(prev => [...prev, { id: Date.now(), payload: txPayload }]);
      triggerSystemAlert("Saved Offline", `${alertMsg} (Will sync when connection restores)`, 'warning');
    }
  };

  const saveAdminNote = async (keyField, keyValue) => {
    if(!isOnline) { triggerSystemAlert("Error", "Internet required to save notes.", "error"); return; }
    try {
      const { error } = await supabase.from('transactions').update({ admin_note: tempNoteText }).eq(keyField, keyValue);
      if (error) throw error; 
      triggerSystemAlert("Note Saved", "Ledger updated.", "success");
      await fetchLedgerData(); setOpenNoteId(null);
    } catch (error) { triggerSystemAlert("Failed", error.message, "error"); }
  };

  const executeDelete = async (type) => {
    if(!isOnline) { triggerSystemAlert("Error", "Internet required to delete records.", "error"); return; }
    setIsProcessing(true);
    triggerHaptic([50, 50, 100]);
    
    if (type === 'SOFT') {
      const { error } = await supabase.from('transactions').update({ status: 'DELETED' }).eq(deleteModal.keyField, deleteModal.keyValue);
      if (error) triggerSystemAlert("Failed", error.message, "error"); 
      else triggerSystemAlert("Voided", `Record ${deleteModal.keyValue} marked as deleted.`, "success");
    } else {
      const { error } = await supabase.from('transactions').delete().eq(deleteModal.keyField, deleteModal.keyValue);
      if (error) triggerSystemAlert("Failed", error.message, "error"); 
      else triggerSystemAlert("Wiped", `Record ${deleteModal.keyValue} permanently erased.`, "success");
    }
    
    setIsProcessing(false);
    setDeleteModal(null);
    refreshAllData();
  };

  const confirmMasterEdit = async () => {
    if (!isOnline) { triggerSystemAlert("Error", "Internet required to edit records.", "error"); return; }
    setIsProcessing(true); triggerHaptic([40, 40, 100]);

    for (const item of masterEditModal.items) {
      const newQty = parseInt(item.edit_qty) || 0;
      
      if (newQty === 0) {
          await supabase.from('transactions').delete().eq('id', item.id);
      } else {
          const updatePayload = { 
              [masterEditModal.keyField]: masterEditModal.newKeyValue,
              item_desc: cleanDesc(item.item_desc),
              unit: getUnit(item.item_desc) 
          };
          if (item.disp_qty !== null) updatePayload.disp_qty = newQty;
          if (item.req_qty !== null) updatePayload.req_qty = newQty;
          await supabase.from('transactions').update(updatePayload).eq('id', item.id);
      }
    }

    setIsProcessing(false);
    setMasterEditModal(null);
    triggerSystemAlert("Record Updated", `Successfully modified ${masterEditModal.newKeyValue}`, "success");
    refreshAllData();
  };

  const saveSettings = (e) => {
      e.preventDefault();
      localStorage.setItem('god_emg_url', emergencyUrl);
      setSettingsModal(false);
      triggerSystemAlert("Settings Saved", "Emergency URL updated successfully.", "success");
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
    try {
      if (!isOnline) throw new Error("Offline");
      const { data, error } = await supabase.from('transactions').select(column).like(column, `${prefix}%`).order(column, { ascending: false }).limit(1);
      if (error) throw error;
      if (data && data.length > 0 && data[0][column]) return `${prefix}${String(parseInt(data[0][column].replace(prefix, '')) + 1).padStart(3, '0')}`;
      return `${prefix}001`;
    } catch (e) { return `${prefix}-OFF-${Math.floor(Date.now() / 1000)}`; }
  };

  const getCategory = (desc) => {
    const normDesc = normalizeString(desc);
    const item = masterItems.find(i => normalizeString(i.description) === normDesc); 
    if (item && item.category) return item.category;
    if (normDesc.includes('TYRE') || normDesc.includes('TUBE') || normDesc.match(/\d{2,3}\d{2,3}/)) return 'TVS';
    return 'SERVO';
  };

  const getUnit = (desc) => {
    if (!desc) return 'NOS'; 
    const normDesc = normalizeString(desc);
    let cat = getCategory(desc);
    if (cat === 'SERVO') {
      if (normDesc.includes('210L') || normDesc.includes('182KG')) return 'BRL';
      if (normDesc.includes('50L')) return 'DRUM';
      if (normDesc.includes('75L') || normDesc.includes('10L') || normDesc.includes('15L') || normDesc.includes('20L') || normDesc.includes('26L') || normDesc.includes('26KG')) return 'BUC';
      return 'NOS';
    } else {
      const learned = JSON.parse(localStorage.getItem('god_tvs_units') || '{}');
      if (learned[normDesc]) return learned[normDesc]; 
      return normDesc.includes('TT') ? 'SET' : 'PCS';
    }
  };

  const getDisplayQty = (desc, qty, rawUnit) => {
    if (!desc) return `0 NOS`;
    let unit = rawUnit;
    if (!unit || unit.toUpperCase() === 'CANS') unit = 'NOS'; 
    
    const normDesc = normalizeString(desc);
    const item = masterItems.find(i => normalizeString(i.description) === normDesc);
    const isNegative = qty < 0; const absQty = Math.abs(qty); const sign = isNegative ? '- ' : '';
    
    if (item && item.category === 'SERVO' && item.ratio && !isNaN(parseFloat(item.ratio)) && parseFloat(item.ratio) > 1) {
        const ratio = parseFloat(item.ratio); const cases = Math.floor(absQty / ratio); const cans = absQty % ratio;
        let parts = []; if (cases > 0) parts.push(`${cases} CAR`); if (cans > 0) parts.push(`${cans} ${unit}`);
        return parts.length > 0 ? sign + parts.join(' + ') : `0 ${unit}`;
    }
    return `${isNegative ? '-' : ''}${absQty || 0} ${unit}`;
  };

  const handleItemSelect = (item, setItemState, setUnitState, setSearchState, setDropdownState, searchQueryStr, focusRef) => {
    setItemState(item); setSearchState(item.description); 
    let newUnit = getUnit(item.description); setUnitState(newUnit);
    
    if (item.category === 'TVS') {
        const learnedUnits = JSON.parse(localStorage.getItem('god_tvs_units') || '{}');
        learnedUnits[normalizeString(item.description)] = newUnit; localStorage.setItem('god_tvs_units', JSON.stringify(learnedUnits));
    }
    setHighlightIndex(-1); if(setDropdownState) setDropdownState(false);

    if (searchQueryStr && searchQueryStr.length >= 2) {
        const sq = normalizeString(searchQueryStr);
        if (sq !== normalizeString(item.description) && (!item.sku || sq !== normalizeString(item.sku))) {
            const aliases = JSON.parse(localStorage.getItem('god_aliases') || '{}');
            aliases[sq] = item.description; localStorage.setItem('god_aliases', JSON.stringify(aliases));
        }
    }
    
    triggerHaptic(30);
    const isDesktop = window.innerWidth > 768;
    if (isDesktop) setTimeout(() => focusRef?.current?.focus(), 50);
  };

  const smartSearch = (query) => {
    if (!query) return []; 
    const sq = normalizeString(query);
    const aliases = JSON.parse(localStorage.getItem('god_aliases') || '{}');
    const aliasedDesc = aliases[sq];
    
    const terms = query.toUpperCase().split(' ').filter(Boolean); 
    let results = masterItems.filter(item => {
       if (aliasedDesc && normalizeString(item.description) === normalizeString(aliasedDesc)) return true;
       if (item.sku && normalizeString(item.sku) === sq) return true;
       const desc = cleanDesc(item.description); const sku = item.sku ? cleanDesc(item.sku) : '';
       return terms.every(term => desc.includes(term) || sku.includes(term));
    });
    
    if (aliasedDesc) {
        const exactMatch = results.find(i => normalizeString(i.description) === normalizeString(aliasedDesc));
        if (exactMatch) {
            results = results.filter(i => normalizeString(i.description) !== normalizeString(aliasedDesc));
            results.unshift(exactMatch);
        }
    }
    return results.slice(0, 50);
  };

  // --- REWRITTEN ENTERPRISE PDF ENGINE ---
  const printPDF = (challanNo, itemsList) => {
    const doc = new jsPDF({ format: 'a5' }); const isReturn = challanNo.startsWith('RT');
    const txTimestamp = (itemsList.length > 0 && itemsList[0].timestamp) ? new Date(itemsList[0].timestamp) : new Date();
    
    let totalNos = 0;
    
    const drawPageTemplate = () => {
        doc.setFillColor(235, 235, 235); doc.rect(5, 5, 138, 16, 'F'); 
        doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.text("GUJARAT OIL DEPOT", 74, 12, { align: "center" });
        doc.setFontSize(10); doc.text(isReturn ? "RETURN CHALLAN" : "DELIVERY CHALLAN", 74, 18, { align: "center" });
        
        doc.setLineWidth(0.4); 
        doc.line(5, 21, 143, 21); // Header Divider
        
        // Metadata
        doc.setFontSize(9);
        doc.text(isReturn ? `RETURN NO :` : `CHALLAN NO :`, 8, 27); doc.setFont("helvetica", "normal"); doc.text(challanNo, 32, 27);
        doc.setFont("helvetica", "bold"); doc.text(`DATE :`, 104, 27); doc.setFont("helvetica", "normal"); doc.text(formatDate(txTimestamp), 116, 27);
        doc.setFont("helvetica", "bold"); doc.text(`BILLED TO :`, 8, 33); doc.setFont("helvetica", "normal"); doc.text(`SOUTH GUJARAT DISTRIBUTORS`, 28, 33); doc.text(`RETAIL STORE`, 28, 38);
        
        // Table Header Background
        doc.setFillColor(245, 245, 245); doc.rect(5.2, 41.2, 137.6, 6.6, 'F'); 
        
        // Table Grid (Full Page Pre-Print)
        doc.rect(5, 5, 138, 190); // Master Outer Box
        doc.line(5, 41, 143, 41); // Top of Table Header
        doc.line(5, 48, 143, 48); // Bottom of Table Header
        
        doc.line(15, 41, 15, 175); // SR Divider (Goes to bottom of items)
        doc.line(100, 41, 100, 175); // DESC Divider
        doc.line(120, 41, 120, 175); // NOS Divider
        doc.line(5, 175, 143, 175); // Bottom of Items Area

        doc.setFont("helvetica", "bold"); doc.setFontSize(9);
        doc.text("SR", 10, 46, { align: "center" }); 
        doc.text("ITEM DESCRIPTION", 17, 46, { align: "left" }); 
        doc.text("NOS", 110, 46, { align: "right" }); 
        doc.text("QTY", 140, 46, { align: "right" });
        doc.setFont("helvetica", "normal");
    };

    drawPageTemplate();
    let y = 53;
    const maxY = 170; 

    itemsList.forEach((item, index) => {
      const desc = item.description || item.item_desc; const splitDesc = doc.splitTextToSize(desc, 75); 
      const rawQty = parseInt(item.disp_qty || item.req_qty) || 0; totalNos += rawQty;
      const displayStr = getDisplayQty(desc, rawQty, item.unit || getUnit(desc)); const paddedQty = String(rawQty).padStart(2, '0');
      const rowHeight = (splitDesc.length * 4) + 1;
      
      // Page Break
      if (y + rowHeight > maxY) {
          doc.addPage();
          drawPageTemplate();
          y = 53;
      }

      doc.text(`${index + 1}`, 10, y, { align: "center" }); doc.text(splitDesc, 17, y); 
      doc.setFont("helvetica", "bold"); 
      doc.text(paddedQty, 110, y, { align: "right" }); 
      doc.setFontSize(8); 
      doc.text(displayStr, 140, y, { align: "right" });
      doc.setFontSize(9); doc.setFont("helvetica", "normal");
      
      if (index < itemsList.length - 1) { 
        doc.setLineWidth(0.1); 
        doc.setDrawColor(200, 200, 200); // Light Gray row divider
        doc.line(5, y + rowHeight - 2, 143, y + rowHeight - 2); 
        doc.setDrawColor(0, 0, 0); // Reset to black
      }
      y += rowHeight + 2; 
    });

    // TOTAL BOX (Y: 175 to 182)
    doc.setFillColor(235, 235, 235); doc.rect(5.2, 175.2, 137.6, 6.6, 'F');
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL", 96, 180, { align: "right" }); 
    doc.text(String(totalNos).padStart(2, '0'), 110, 180, { align: "right" });
    doc.setLineWidth(0.4); doc.line(5, 182, 143, 182); // Bottom of Total Box

    // SIGNATURE BLOCK (Y: 182 to 195)
    const sigY = 191; 
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.text("Receiver's Signature / Stamp", 8, sigY);
    if (itemsList.length > 0 && (itemsList[0].status === 'ACCEPTED' || itemsList[0].status === 'RETURN_ACCEPTED')) {
      doc.setTextColor(0, 128, 0); doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.text("Digitally Verified", 8, sigY - 4); 
      doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.text(`Verified: ${formatDate(txTimestamp)} ${formatTime(txTimestamp)}`, 8, sigY + 2);
    }
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text("For GUJARAT OIL DEPOT", 140, sigY - 5, { align: "right" });
    doc.setTextColor(0, 51, 153); doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.text("Electronically Signed Document", 140, sigY, { align: "right" });
    doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "normal"); doc.setFontSize(6); doc.text(`Auth: ${formatDate(txTimestamp)} ${formatTime(txTimestamp)}`, 140, sigY + 3, { align: "right" });
    
    // PAGINATION GENERATOR (Page 1 of X)
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(`Page ${i} of ${totalPages}`, 140, 200, { align: "right" });
    }

    doc.save(`${challanNo}.pdf`);
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
              return { description: cleanDesc(norm.description), ratio: parseFloat(norm.ratio) || 1, category: sheetName, sku: norm.sku || norm.code || norm.shortname || null };
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
      const desc = cleanDesc(row.item_desc); const q = parseInt(row.disp_qty || row.req_qty) || 0;
      if(!itemSummary[desc]) itemSummary[desc] = { qty: 0, unit: row.unit || getUnit(desc), category: getCategory(desc), rawItemDesc: row.item_desc };
      
      if (row.status !== 'DELETED') {
        if (row.status === 'RETURN_ACCEPTED') itemSummary[desc].qty -= q; 
        else if (row.status === 'ACCEPTED' || row.status === 'DISPATCHED') itemSummary[desc].qty += q;
      }
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
      let bgColor = group.status === "DELETED" ? "#f3f4f6" : group.status === "ACCEPTED" ? "#dcfce7" : "#dbeafe"; 
      let qtyColor = group.status === "DELETED" ? 'color: #9ca3af;' : 'color: #000;';
      
      let challanText = group.challan_no || '-';
      if (group.status === 'DELETED') challanText += " (DELETED)";

      group.items.forEach((row, i) => {
        const rawQty = parseInt(row.disp_qty || row.req_qty) || 0; 
        if (group.status !== 'DELETED') globalTxTotal += rawQty; 

        leftRowsFlat.push({
          type: 'data', isReturn: false, isFirst: i === 0, rowspan: group.items.length,
          date: `${formatDate(group.date)}<br style="mso-data-placement:same-cell;"/>${formatTime(group.date)}`,
          challan: challanText, desc: cleanDesc(row.item_desc), nos: String(rawQty).padStart(2, '0'),
          qty: getDisplayQty(row.item_desc, rawQty, row.unit || getUnit(row.item_desc)).toUpperCase(),
          adminNote: group.admin_note || '', color: bgColor, qtyColor: qtyColor 
        });
      });
    });
    if (dispatchedGroups.length > 0) leftRowsFlat.push({ type: 'global_total', color: '#d1d5db', total: String(globalTxTotal).padStart(2, '0') });

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
            challan: row.challan_no || '-', desc: cleanDesc(row.item_desc), nos: String(rawQty).padStart(2, '0'),
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
            rightRowsFlat.push({ type: 'summary_data', desc: cleanDesc(data.rawItemDesc), nos: String(data.qty).padStart(2, '0'), qty: getDisplayQty(desc, data.qty, data.unit).toUpperCase(), bgColor: '#fef9c3' }); 
        });
        rightRowsFlat.push({ type: 'summary_total', total: String(servoTotal).padStart(2, '0'), color: '#fef08a' });
    }
    if (tvsEntries.length > 0) {
        rightRowsFlat.push({ type: 'group_title', title: 'TVS TYRES & TUBES', bgColor: '#fde047' });
        let tvsTotal = 0;
        tvsEntries.forEach(([desc, data]) => { 
            tvsTotal += data.qty;
            rightRowsFlat.push({ type: 'summary_data', desc: cleanDesc(data.rawItemDesc), nos: String(data.qty).padStart(2, '0'), qty: getDisplayQty(desc, data.qty, data.unit).toUpperCase(), bgColor: '#fef9c3' }); 
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
                html += `<td rowspan="${l.rowspan}" style="mso-number-format:'\\@'; background-color: ${l.color}; border: 1px solid black; vertical-align: middle; text-align: center; font-weight: bold; padding: 8px; ${l.qtyColor} white-space: nowrap;">${l.challan}</td>`;
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

  const handleKeyDown = (e, itemsList, setSelected, setSearch, setDropdownOpen, setUnitState, listIdPrefix, focusRef, currentSelectedItem) => {
    if (e.key === 'Delete') {
        e.preventDefault(); triggerHaptic(30);
        setSelected(null); setSearch(''); setUnitState('NOS');
        if (setDropdownOpen) setDropdownOpen(false);
        return;
    }
    if (e.key === 'Backspace' && currentSelectedItem) {
        e.preventDefault(); triggerHaptic(30);
        setSelected(null); setSearch(''); setUnitState('NOS');
        if (setDropdownOpen) setDropdownOpen(false);
        return;
    }
    if (e.key === 'ArrowDown') { 
      e.preventDefault(); setHighlightIndex(p => { const next = p < itemsList.length - 1 ? p + 1 : p; document.getElementById(`${listIdPrefix}-${next}`)?.scrollIntoView({ block: 'nearest' }); return next; }); 
    } else if (e.key === 'ArrowUp') { 
      e.preventDefault(); setHighlightIndex(p => { const next = p > 0 ? p - 1 : 0; document.getElementById(`${listIdPrefix}-${next}`)?.scrollIntoView({ block: 'nearest' }); return next; }); 
    } else if (e.key === 'Enter') {
      e.preventDefault(); 
      if (highlightIndex >= 0 && itemsList[highlightIndex]) {
          handleItemSelect(itemsList[highlightIndex], setSelected, setUnitState, setSearch, setDropdownOpen, e.target.value, focusRef);
      }
    } else if (e.key === 'Tab' || e.key === 'Escape') {
      if (setDropdownOpen) setDropdownOpen(false);
    }
  };

  const toggleGroupExpand = (groupId) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const retailFilteredItems = smartSearch(retailSearch);
  
  const addToRetailCart = (e) => {
    if (e) e.preventDefault();
    if (!retailSelectedItem || !retailQty || parseInt(retailQty) === 0) return;
    
    triggerHaptic(40);
    let finalQty = parseInt(retailQty);
    if (finalQty < 0) {
        setRetailMode('RETURN');
        finalQty = Math.abs(finalQty);
    }

    setRetailCart([...retailCart, { ...retailSelectedItem, req_qty: finalQty, unit: retailSelectedUnit }]);
    setRetailSearch(''); setRetailQty(''); setRetailSelectedItem(null);
    const isDesktop = window.innerWidth > 768;
    if (isDesktop) setTimeout(() => retailSearchRef.current?.focus(), 50); 
  };
  
  const updateRetailCartQty = (index, val) => { const updated = [...retailCart]; updated[index].req_qty = val; setRetailCart(updated); };
  const removeRetailCartItem = (index) => setRetailCart(retailCart.filter((_, i) => i !== index));

  const submitRetailAction = async (e) => {
    if (e) e.preventDefault();
    if (retailCart.length === 0 || isProcessing) return; 
    
    triggerHaptic([40, 40, 100]);
    setIsProcessing(true);
    
    const isReturn = retailMode === 'RETURN'; const groupId = await getNextSequence(isReturn ? 'RT' : 'PO');
    const tx = retailCart.map(item => ({ 
      group_id: groupId, item_desc: item.description, req_qty: parseInt(item.req_qty), 
      unit: item.unit, status: isReturn ? 'RETURN_INITIATED' : 'PO_PLACED',
      challan_no: isReturn ? groupId : null, note: isReturn ? (retailReturnNote || null) : null
    }));
    
    executeTransaction(tx, `${isReturn ? 'Return' : 'P.O.'} Submitted`, `Group ID: ${groupId}`, () => {
      setRetailCart([]); setRetailReturnNote('');
      setIsProcessing(false);
    });
  };

  const depotFilteredItems = smartSearch(searchQuery);
  
  const addToDepotCart = (e) => {
    if (e) e.preventDefault();
    if (!selectedItem || !qty || parseInt(qty) === 0) return;
    
    triggerHaptic(40);
    let finalQty = parseInt(qty);
    if (finalQty < 0) {
        setDepotMode('RETURN_REQUEST');
        finalQty = Math.abs(finalQty);
    }

    setDepotCart([...depotCart, { ...selectedItem, disp_qty: finalQty, unit: selectedUnit }]); 
    setSearchQuery(''); setQty(''); setSelectedItem(null);
    const isDesktop = window.innerWidth > 768;
    if (isDesktop) setTimeout(() => depotSearchRef.current?.focus(), 50); 
  };

  const updateDepotCartQty = (index, val) => { const updated = [...depotCart]; updated[index].disp_qty = val; setDepotCart(updated); };
  const removeDepotCartItem = (index) => setDepotCart(depotCart.filter((_, i) => i !== index));

  const submitDepotAction = async (e) => {
    e.preventDefault(); 
    if (depotCart.length === 0 || isProcessing) return;
    
    triggerHaptic([40, 40, 100]);
    setIsProcessing(true);

    if (depotMode === 'DISPATCH') {
      const challanNo = await getNextSequence('CN'); const groupId = 'MANUAL-' + Date.now();
      const tx = depotCart.map(item => ({ group_id: groupId, challan_no: challanNo, item_desc: item.description, disp_qty: parseInt(item.disp_qty), unit: item.unit, status: 'DISPATCHED' }));
      executeTransaction(tx, "Challan Issued", `Challan: ${challanNo}`, () => {
        printPDF(challanNo, depotCart); setDepotCart([]); 
        setIsProcessing(false);
      });
    } else {
      const groupId = await getNextSequence('RR');
      const tx = depotCart.map(item => ({ 
        group_id: groupId, item_desc: item.description, req_qty: parseInt(item.disp_qty), 
        unit: item.unit, status: 'RETURN_REQUESTED', note: depotReturnNote || null 
      }));
      executeTransaction(tx, "Return Request Submitted", `Group ID: ${groupId}`, () => {
        setDepotCart([]); setDepotReturnNote('');
        setIsProcessing(false);
      });
    }
  };

  const openVerifyModal = (challanNo, items) => {
    triggerHaptic(30);
    const checks = {}; items.forEach((_, i) => checks[i] = false);
    setVerifyModal({ 
      challanNo, 
      items: items.map(i => ({ ...i, edit_qty: i.disp_qty || i.req_qty })), 
      checks, 
      isDepotReturn: challanNo ? String(challanNo).startsWith('RT') : false
    });
  };

  const toggleVerifyCheck = (index) => {
      triggerHaptic(20);
      setVerifyModal(prev => ({ ...prev, checks: { ...prev.checks, [index]: !prev.checks[index] } }));
  };

  const acceptDelivery = async () => {
    if (!isOnline) { alert("You must be online to verify and accept deliveries."); return; }
    if (!verifyModal || isProcessing) return; 
    
    triggerHaptic([40, 40, 100]);
    setIsProcessing(true);
    const newStatus = verifyModal.isDepotReturn ? 'RETURN_ACCEPTED' : 'ACCEPTED';
    
    for (let i = 0; i < verifyModal.items.length; i++) {
        if (verifyModal.checks[i]) {
            const item = verifyModal.items[i];
            const finalQty = parseInt(item.edit_qty) || 0;
            await supabase.from('transactions').update({ status: newStatus, disp_qty: finalQty, req_qty: finalQty }).eq('id', item.id);
        }
    }
    
    setIsProcessing(false);
    setVerifyModal(null); 
    refreshAllData();
  };

  const openEditPOModal = (groupId, items) => { 
      triggerHaptic(30);
      setEditPOModal({ groupId, items: items.map(i => ({ ...i, edit_qty: i.req_qty })) }); 
  };
  const handleEditPOQty = (index, val) => { const updated = [...editPOModal.items]; updated[index].edit_qty = val; setEditPOModal({ ...editPOModal, items: updated }); };
  
  const confirmDispatchPO = async () => {
    if (!isOnline) { alert("You must be online to process and dispatch Purchase Orders."); return; }
    if (!editPOModal || isProcessing) return; 
    
    triggerHaptic([40, 40, 100]);
    setIsProcessing(true);
    
    const challanNo = await getNextSequence('CN'); const backorders = []; const printItems = [];
    for (const item of editPOModal.items) {
      const dispatchQty = parseInt(item.edit_qty) || 0; const reqQty = parseInt(item.req_qty);
      if (dispatchQty === 0) { await supabase.from('transactions').update({ status: 'DELETED' }).eq('id', item.id); continue; }
      if (dispatchQty > 0) { await supabase.from('transactions').update({ status: 'DISPATCHED', challan_no: challanNo, disp_qty: dispatchQty }).eq('id', item.id); printItems.push({ ...item, disp_qty: dispatchQty }); }
      if (dispatchQty < reqQty) { const newPO = await getNextSequence('PO'); backorders.push({ group_id: newPO, item_desc: item.item_desc, req_qty: reqQty - dispatchQty, unit: item.unit, status: 'PO_PLACED' }); }
    }
    if (backorders.length > 0) await supabase.from('transactions').insert(backorders);
    if (printItems.length > 0) printPDF(challanNo, printItems);
    
    setIsProcessing(false);
    setEditPOModal(null); 
    refreshAllData();
  };

  const openProcessReturnModal = (groupId, items) => { 
      triggerHaptic(30);
      setProcessReturnModal({ groupId, items: items.map(i => ({ ...i, edit_qty: i.req_qty })) }); 
  };
  const handleProcessReturnQty = (index, val) => { const updated = [...processReturnModal.items]; updated[index].edit_qty = val; setProcessReturnModal({ ...processReturnModal, items: updated }); };

  const confirmProcessReturnRequest = async () => {
    if (!isOnline) { alert("You must be online to process return requests."); return; }
    if (!processReturnModal || isProcessing) return; 
    
    triggerHaptic([40, 40, 100]);
    setIsProcessing(true);
    
    const challanNo = await getNextSequence('RT'); const backorders = []; const printItems = [];
    for (const item of processReturnModal.items) {
      const dispatchQty = parseInt(item.edit_qty) || 0; const reqQty = parseInt(item.req_qty);
      if (dispatchQty === 0) { await supabase.from('transactions').update({ status: 'DELETED' }).eq('id', item.id); continue; }
      if (dispatchQty > 0) { await supabase.from('transactions').update({ status: 'RETURN_INITIATED', challan_no: challanNo, disp_qty: dispatchQty }).eq('id', item.id); printItems.push({ ...item, disp_qty: dispatchQty }); }
      if (dispatchQty < reqQty) { const newRR = await getNextSequence('RR'); backorders.push({ group_id: newRR, item_desc: item.item_desc, req_qty: reqQty - dispatchQty, unit: item.unit, status: 'RETURN_REQUESTED' }); }
    }
    if (backorders.length > 0) await supabase.from('transactions').insert(backorders);
    if (printItems.length > 0) printPDF(challanNo, printItems);
    
    setIsProcessing(false);
    setProcessReturnModal(null); 
    refreshAllData();
  };

  if (loadingAuth) return (
    <div className="min-h-screen bg-gray-200 p-3 md:p-4 font-sans flex flex-col gap-4 select-none">
      <div className="h-14 bg-gray-300 border-2 border-gray-400 animate-pulse shadow-sm"></div>
      <div className="flex flex-col md:flex-row gap-4">
        <div className="w-full md:w-1/2 h-[60vh] bg-gray-300 border-2 border-gray-400 animate-pulse shadow-sm"></div>
        <div className="w-full md:w-1/2 h-[60vh] bg-gray-300 border-2 border-gray-400 animate-pulse shadow-sm"></div>
      </div>
    </div>
  );
  
  if (!session) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-200 font-sans select-none">
      <div className="bg-white border-2 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-sm w-full relative">
        {!isOnline && <div className="absolute top-0 left-0 w-full bg-red-600 text-white text-center text-[10px] font-black py-0.5">OFFLINE MODE</div>}
        <h2 className="text-2xl font-black text-center mb-6 uppercase border-b-4 border-black pb-2 mt-2">GOD LOGIN</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="text" value={workerName} onChange={(e) => setWorkerName(e.target.value)} placeholder="WORKER NAME" className="w-full border-2 border-black p-3 md:p-4 font-bold text-center uppercase focus:bg-yellow-50 outline-none select-text transition-colors" required />
          <button type="submit" disabled={isLoggingIn} className="w-full bg-black text-white py-3 md:py-4 font-bold uppercase border-2 border-black hover:bg-gray-800 active:translate-y-1 transition-all disabled:opacity-50">{isLoggingIn ? 'VERIFYING...' : 'ACCESS DASHBOARD'}</button>
          {loginError && <p className="text-red-600 font-bold text-center text-sm uppercase">{loginError}</p>}
        </form>
      </div>
    </div>
  );

  const hasRetailInbox = Object.keys(incomingDeliveries).length > 0 || Object.keys(pendingDepotReturns).length > 0 || Object.keys(pendingPOs).length > 0;
  const hasDepotInbox = Object.keys(pendingPOs).length > 0 || Object.keys(pendingReturns).length > 0;

  return (
    <div className="min-h-screen bg-gray-200 text-gray-900 pb-10 font-sans selection:bg-blue-200 select-none">
      
      {/* --- IN-APP TOAST CONTAINER --- */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-2 border-black font-bold uppercase text-sm animate-slide-in flex items-center gap-3 w-72 bg-white text-black`}>
            <span className="text-xl">{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : '⚠️'}</span>
            <div>
              <div className="text-[11px] text-gray-500 tracking-wider mb-0.5">{toast.title}</div>
              <div className="leading-tight">{toast.body}</div>
            </div>
          </div>
        ))}
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slide-in { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-slide-in { animation: slide-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
      `}} />

      {/* --- SETTINGS MODAL (EMERGENCY URL) --- */}
      {settingsModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex justify-center items-center p-3 md:p-4 z-[70]">
            <div className="bg-white border-2 border-black max-w-md w-full p-4 md:p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <h2 className="text-lg font-black border-b-2 border-black pb-2 mb-4 uppercase text-gray-800">SYSTEM CONFIGURATION</h2>
                <label className="block text-[11px] font-bold text-gray-700 mb-1.5 uppercase">Emergency Portal (Google Script URL)</label>
                <input type="text" value={emergencyUrl} onChange={(e) => setEmergencyUrl(e.target.value)} placeholder="https://script.google.com/macros/s/..." className="w-full border-2 border-black p-3 text-[13px] md:text-sm font-bold focus:outline-none focus:bg-yellow-50 select-text mb-4" />
                <div className="flex gap-2">
                    <button onClick={() => { triggerHaptic(30); setSettingsModal(false); }} className="flex-1 bg-gray-200 border-2 border-black p-3 text-[13px] md:text-sm font-bold hover:bg-gray-300 text-center transition-colors">CANCEL</button>
                    <button onClick={saveSettings} className="flex-1 bg-blue-800 text-white border-2 border-black p-3 text-[13px] md:text-sm font-bold hover:bg-blue-900 text-center transition-colors">SAVE LINK</button>
                </div>
            </div>
        </div>
      )}

      {/* --- MASTER DELETE MODAL --- */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex justify-center items-center p-3 md:p-4 z-[60]">
            <div className="bg-white border-2 border-black max-w-md w-full p-4 md:p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <h2 className="text-lg font-black border-b-2 border-black pb-2 mb-4 uppercase text-red-800">DELETE RECORD: {deleteModal.keyValue}</h2>
                <p className="text-[13px] md:text-sm font-bold text-gray-700 mb-6">How would you like to remove this record?</p>
                
                <div className="flex flex-col gap-3">
                    <button onClick={() => executeDelete('SOFT')} disabled={isProcessing} className="w-full bg-gray-200 border-2 border-black p-3 text-left hover:bg-gray-300 transition-colors disabled:opacity-50">
                        <span className="block text-black font-black text-sm">1. VOID (Soft Delete)</span>
                        <span className="block text-[11px] md:text-xs font-bold text-gray-600 mt-1 uppercase">Zeroes quantities but keeps the Challan/PO number in the ledger for auditing transparency.</span>
                    </button>
                    
                    <button onClick={() => executeDelete('HARD')} disabled={isProcessing} className="w-full bg-red-100 border-2 border-red-900 p-3 text-left hover:bg-red-200 transition-colors disabled:opacity-50">
                        <span className="block text-red-900 font-black text-sm">2. WIPE COMPLETELY (Hard Delete)</span>
                        <span className="block text-[11px] md:text-xs font-bold text-red-700 mt-1 uppercase">Erases all history permanently. Frees up the number to be reused.</span>
                    </button>
                    
                    <button onClick={() => { triggerHaptic(30); setDeleteModal(null); }} disabled={isProcessing} className="w-full bg-black text-white border-2 border-black p-3 text-[13px] md:text-sm font-bold mt-2 hover:bg-gray-800 text-center transition-colors">CANCEL</button>
                </div>
            </div>
        </div>
      )}

      {/* --- MASTER EDIT MODAL --- */}
      {masterEditModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex justify-center items-center p-3 md:p-4 z-[60]">
            <div className="bg-white border-2 border-black max-w-xl w-full p-4 md:p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <h2 className="font-bold border-b-2 border-black pb-2 md:pb-3 mb-3 md:mb-4 uppercase text-lg">EDIT RECORD: {masterEditModal.keyValue}</h2>
              
              <div className="mb-4">
                  <label className="block text-[11px] font-bold text-gray-700 mb-1 uppercase">Challan / PO Number</label>
                  <input type="text" value={masterEditModal.newKeyValue} onChange={(e) => setMasterEditModal({...masterEditModal, newKeyValue: e.target.value.toUpperCase()})} className="w-full border-2 border-black p-2 md:p-3 text-[13px] md:text-sm font-bold focus:outline-none focus:bg-yellow-50 select-text transition-colors" />
              </div>

              <div className="space-y-2 mb-4 md:mb-6 max-h-56 overflow-y-auto pr-2">
                <div className="flex text-[11px] md:text-[13px] font-bold text-gray-500 px-2 uppercase"><span className="flex-1">ITEM DESCRIPTION</span><span className="w-24 text-center">EDIT QTY</span></div>
                {masterEditModal.items.map((item, idx) => (
                  <div key={idx} className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 bg-gray-100 border border-gray-300 p-2">
                    <input type="text" list="masterItemsList" value={item.item_desc} onChange={(e) => {
                        const updated = [...masterEditModal.items]; updated[idx].item_desc = e.target.value; setMasterEditModal({...masterEditModal, items: updated});
                    }} className="flex-1 text-[13px] md:text-sm p-1.5 border-2 border-black font-bold focus:bg-yellow-50 focus:outline-none select-text uppercase" />
                    <input type="number" value={item.edit_qty} onChange={(e) => {
                        const updated = [...masterEditModal.items]; updated[idx].edit_qty = e.target.value; setMasterEditModal({...masterEditModal, items: updated});
                    }} className="w-full md:w-24 text-[13px] md:text-sm p-1 md:p-1.5 border-2 border-black text-center font-bold focus:bg-yellow-50 focus:outline-none select-text" />
                  </div>
                ))}
                <datalist id="masterItemsList">
                    {masterItems.map((m, i) => <option key={i} value={m.description} />)}
                </datalist>
              </div>
              <div className="flex space-x-2">
                <button onClick={() => { triggerHaptic(30); setMasterEditModal(null); }} className="flex-1 border-2 border-black bg-gray-200 py-2 md:py-3 text-[13px] md:text-sm font-bold hover:bg-gray-300 transition-colors">CANCEL</button>
                <button onClick={confirmMasterEdit} disabled={isProcessing} className="flex-1 border-2 border-black bg-blue-800 text-white py-2 md:py-3 text-[13px] md:text-sm font-bold hover:bg-blue-900 uppercase transition-all disabled:opacity-50">{isProcessing ? 'SAVING...' : 'SAVE CHANGES'}</button>
              </div>
            </div>
        </div>
      )}

      {/* --- SLIM MOBILE NAVIGATION BAR --- */}
      <nav className="bg-gray-800 text-white border-b-2 border-black p-2 md:p-3 sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center font-bold uppercase text-[10px] md:text-sm">
          
          <div className="flex items-center gap-1 md:gap-2">
            <span className="tracking-widest">Gujarat Oil Depot</span>
            <button onClick={() => {
                triggerHaptic(50);
                if (emergencyUrl) window.open(emergencyUrl, '_blank');
                else alert("Emergency URL not set. Please ask Master user to configure it in Settings.");
            }} className="ml-1 md:ml-2 hover:scale-110 transition-transform text-sm md:text-lg cursor-pointer bg-transparent border-none p-0" title="Emergency Fallback Portal">🚨</button>
            {actionableCount > 0 && (
              <span className="relative flex h-2 w-2 md:h-3 md:w-3 -mt-3 -ml-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 md:h-3 md:w-3 bg-blue-500"></span>
              </span>
            )}
            {!isOnline && <span className="ml-2 md:ml-4 bg-red-600 text-white px-1.5 md:px-2 py-0.5 rounded text-[8px] md:text-[10px] font-black animate-pulse shadow-sm border border-red-800">OFFLINE</span>}
            {isOnline && offlineQueue.length > 0 && <span className="ml-1 md:ml-2 bg-yellow-500 text-black px-1.5 md:px-2 py-0.5 rounded text-[8px] md:text-[10px] font-black cursor-pointer shadow-sm border border-yellow-700" onClick={syncOfflineQueue}>{isSyncing ? 'SYNCING...' : `SYNC (${offlineQueue.length})`}</span>}
            
            {/* SETTINGS ICON FOR MASTER */}
            {(userRole === 'admin' || userRole === 'master') && (
                <button onClick={() => { triggerHaptic(20); setSettingsModal(true); }} className="ml-1 md:ml-2 text-gray-400 hover:text-white transition-colors text-sm md:text-lg" title="System Settings">⚙️</button>
            )}
          </div>
          
          <div className="flex gap-1 md:gap-2 items-center">
            {userRole && (
              <div className="p-0.5 md:p-1 flex gap-0.5 md:gap-1 rounded bg-gray-700">
                {(userRole === 'admin' || userRole === 'master' || userRole === 'depot') && (
                  <button onClick={() => { triggerHaptic(30); setView('depot'); }} className={`px-2 md:px-3 py-1 md:py-1.5 text-[9px] md:text-xs font-bold transition-colors ${view === 'depot' ? 'bg-white text-black' : 'text-gray-300 hover:text-white'}`}>DEPOT</button>
                )}
                {(userRole === 'admin' || userRole === 'master' || userRole === 'retail') && (
                  <button onClick={() => { triggerHaptic(30); setView('retail'); }} className={`px-2 md:px-3 py-1 md:py-1.5 text-[9px] md:text-xs font-bold transition-colors ${view === 'retail' ? 'bg-white text-black' : 'text-gray-300 hover:text-white'}`}>RETAIL</button>
                )}
                <button onClick={() => { triggerHaptic(30); setView('ledger'); setLedgerLimit(50); }} className={`px-2 md:px-3 py-1 md:py-1.5 text-[9px] md:text-xs font-bold transition-colors ${view === 'ledger' ? 'bg-white text-black' : 'text-gray-300 hover:text-white'}`}>LEDGER</button>
              </div>
            )}
            <button onClick={() => { triggerHaptic([30,50]); supabase.auth.signOut(); }} className="bg-red-600 px-2 md:px-4 py-1 md:py-1.5 text-[9px] md:text-xs border border-black hover:bg-red-700 transition-colors">LOGOUT</button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto p-3 md:p-4">
        
        {/* ================= VIEWS ================= */}
        {view === 'unassigned' && (
          <div className="flex items-center justify-center mt-20">
            <div className="bg-red-100 border-2 border-red-600 p-8 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-w-md">
              <h2 className="text-xl font-black text-red-800 mb-2">NO TERMINAL ASSIGNED</h2>
              <p className="font-bold text-gray-800 text-sm">Your account does not have a valid role assigned in the database.</p>
            </div>
          </div>
        )}

        {view === 'ledger' && (
          <div className="space-y-3 md:space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white border-2 border-black p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] gap-3 md:gap-4">
              <div className="flex items-center gap-3 md:gap-4">
                <span className="font-black text-[13px] uppercase">{uploadStatus}</span>
                {(userRole === 'admin' || userRole === 'master') && (
                  <label className="bg-gray-200 border border-black hover:bg-gray-300 px-3 md:px-4 py-1.5 md:py-2 rounded-sm text-[11px] md:text-[13px] font-bold cursor-pointer transition-colors">
                    UPDATE EXCEL DB <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
                  </label>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-[11px] md:text-[13px] font-bold uppercase mr-1">Ledger Month:</span>
                <select value={ledgerMonth} onChange={(e) => setLedgerMonth(Number(e.target.value))} className="border-2 border-black p-1 md:p-1.5 text-[13px] md:text-sm font-bold uppercase focus:outline-none cursor-pointer select-text">
                  {availableMonths.map(m => <option key={m} value={m}>{monthNames[m]}</option>)}
                </select>
                <select value={ledgerYear} onChange={(e) => setLedgerYear(Number(e.target.value))} className="border-2 border-black p-1 md:p-1.5 text-[13px] md:text-sm font-bold uppercase focus:outline-none cursor-pointer select-text">
                  {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                {(userRole === 'admin' || userRole === 'master') && (
                  <button onClick={downloadLedger} className="bg-blue-800 border-2 border-black hover:bg-blue-900 text-white px-4 md:px-5 py-1.5 md:py-2 font-bold text-[11px] md:text-[13px] ml-2 transition-colors">EXPORT EXCEL</button>
                )}
              </div>
            </div>

            <div className="bg-white border-2 border-black overflow-hidden shadow-sm">
              <div className="max-h-[65vh] overflow-y-auto">
                <table className="w-full text-left border-collapse text-[13px] md:text-sm">
                  <thead className="bg-gray-100 border-b-2 border-black font-bold uppercase sticky top-0 z-10 shadow-sm text-[13px] md:text-sm">
                    <tr>
                      <th className="p-2 md:p-3 border-r border-gray-300 w-24 md:w-28 text-center select-text whitespace-nowrap">DATE / TIME</th>
                      <th className="p-2 md:p-3 border-r border-gray-300 select-text whitespace-nowrap">CHALLAN NO</th>
                      <th className="p-2 md:p-3 border-r border-gray-300 w-1/2 select-text whitespace-nowrap">ITEM DESCRIPTION</th>
                      <th className="p-2 md:p-3 text-right border-r border-gray-300 select-text whitespace-nowrap">NOS</th>
                      <th className="p-2 md:p-3 text-right border-r border-gray-300 whitespace-nowrap select-text">QTY</th>
                      <th className="p-2 md:p-3 text-center border-r border-gray-300 w-40 md:w-48 select-none whitespace-nowrap">ADMIN NOTE</th>
                      <th className="p-2 md:p-3 text-center w-16 md:w-20 select-none whitespace-nowrap">PDF</th>
                      {userRole === 'master' && <th className="p-2 md:p-3 text-center w-24 md:w-28 select-none bg-gray-200 text-black whitespace-nowrap border-l border-gray-300">MASTER</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(ledgerData.reduce((acc, row) => {
                      const key = row.challan_no || row.group_id; 
                      if (!acc[key]) acc[key] = { ...row, items: [], keyValue: key, keyField: row.challan_no ? 'challan_no' : 'group_id' };
                      if (row.admin_note && !acc[key].admin_note) acc[key].admin_note = row.admin_note;
                      acc[key].items.push(row); return acc;
                    }, {})).length === 0 ? (
                      <tr><td colSpan={userRole === 'master' ? "8" : "7"} className="p-6 md:p-8 text-center text-gray-500 font-bold uppercase text-[13px] md:text-base">No records for {monthNames[ledgerMonth]} {ledgerYear}</td></tr>
                    ) : Object.values(ledgerData.reduce((acc, row) => {
                      const key = row.challan_no || row.group_id; 
                      if (!acc[key]) acc[key] = { ...row, items: [], keyValue: key, keyField: row.challan_no ? 'challan_no' : 'group_id' };
                      if (row.admin_note && !acc[key].admin_note) acc[key].admin_note = row.admin_note;
                      acc[key].items.push(row); return acc;
                    }, {})).sort((a, b) => new Date(b.date) - new Date(a.date)).map((group, idx) => {
                      
                      // ALPHABETICAL SORT
                      const sortedItems = [...group.items].sort((a,b) => a.item_desc.localeCompare(b.item_desc));
                      const isExpanded = expandedGroups[group.keyValue];
                      const visibleItems = isExpanded ? sortedItems : sortedItems.slice(0, 3);
                      const hiddenCount = sortedItems.length - 3;

                      return (
                      <tr key={idx} className={`border-b border-gray-300 align-top hover:bg-gray-50 transition-colors ${group.status === 'DELETED' ? 'bg-gray-200 opacity-60' : group.status === 'ACCEPTED' ? 'bg-green-50' : group.status === 'RETURN_ACCEPTED' ? 'bg-red-50' : 'bg-blue-50'} select-text`}>
                        <td className="p-2 md:p-3 border-r border-gray-300 text-center font-bold leading-tight">
                          {formatDate(group.timestamp)}<br/><span className="text-gray-600 font-normal text-[11px] md:text-[13px]">{formatTime(group.timestamp)}</span>
                        </td>
                        <td className="p-2 md:p-3 border-r border-gray-200 font-bold text-gray-900">
                          {group.challan_no || 'PENDING'}
                          {group.status === 'DELETED' && <span className="block text-red-600 font-black text-[10px] md:text-[11px] mt-1">DELETED</span>}
                        </td>
                        <td className="p-2 md:p-3 border-r border-gray-200">
                          <ul className="space-y-1 md:space-y-1.5">
                            {visibleItems.map((i, k) => <li key={k} className={`font-bold border-b border-gray-200 last:border-0 pb-1 uppercase truncate max-w-[250px] md:max-w-[300px] xl:max-w-[400px] ${group.status === 'DELETED' ? 'line-through text-gray-500' : ''}`} title={i.item_desc}><span className="w-1.5 h-1.5 bg-gray-400 inline-block rounded-full mr-1 md:mr-2 mb-0.5"></span>{i.item_desc}</li>)}
                            {hiddenCount > 0 && !isExpanded && <li className="text-blue-700 cursor-pointer font-black text-[11px] mt-1 uppercase" onClick={() => toggleGroupExpand(group.keyValue)}>+ {hiddenCount} MORE ITEMS</li>}
                            {hiddenCount > 0 && isExpanded && <li className="text-blue-700 cursor-pointer font-black text-[11px] mt-1 uppercase" onClick={() => toggleGroupExpand(group.keyValue)}>SHOW LESS</li>}
                          </ul>
                        </td>
                        <td className="p-2 md:p-3 border-r border-gray-200 text-right pr-4">
                          <ul className="space-y-1 md:space-y-1.5">
                            {visibleItems.map((i, k) => <li key={k} className={`font-bold pb-1 ${group.status==='RETURN_ACCEPTED'?'text-red-900':''} ${group.status === 'DELETED' ? 'line-through text-gray-500' : ''}`}>{group.status === 'RETURN_ACCEPTED' ? '-' : ''}{i.disp_qty || i.req_qty}</li>)}
                          </ul>
                        </td>
                        <td className="p-2 md:p-3 border-r border-gray-200 text-right pr-4 whitespace-nowrap">
                           <ul className="space-y-1 md:space-y-1.5">
                            {visibleItems.map((i, k) => <li key={k} className={`font-bold pb-1 ${group.status==='RETURN_ACCEPTED'?'text-red-600':''} ${group.status === 'DELETED' ? 'line-through text-gray-500' : ''}`}>{getDisplayQty(i.item_desc, i.disp_qty || i.req_qty, i.unit)}</li>)}
                          </ul>
                        </td>
                        <td className="p-2 md:p-3 border-r border-gray-200 align-top select-none">
                          {group.status !== 'RETURN_ACCEPTED' ? (
                            <div className="flex flex-col gap-1.5 md:gap-2 min-w-[120px] md:min-w-[140px] max-w-[200px]">
                              {(userRole === 'admin' || userRole === 'master') ? (
                                openNoteId === group.keyValue ? (
                                  <div className="flex flex-col gap-1 md:gap-1.5 w-full mt-1">
                                    <textarea
                                      className="w-full border-2 border-black p-1.5 md:p-2 text-[11px] md:text-[13px] font-bold focus:outline-none focus:bg-yellow-50 resize-none whitespace-pre-wrap break-words select-text"
                                      rows="3"
                                      value={tempNoteText}
                                      onChange={(e) => setTempNoteText(e.target.value)}
                                      placeholder="Enter note..."
                                      autoFocus
                                    />
                                    <div className="flex gap-1 md:gap-1.5 mt-1">
                                      <button onClick={() => saveAdminNote(group.keyField, group.keyValue)} className="bg-blue-600 text-white px-1.5 md:px-2 py-1 md:py-1.5 text-[10px] md:text-[11px] font-bold uppercase flex-1 border-2 border-blue-800 active:translate-y-px">SAVE</button>
                                      <button onClick={() => setOpenNoteId(null)} className="bg-gray-200 text-gray-800 px-1.5 md:px-2 py-1 md:py-1.5 text-[10px] md:text-[11px] font-bold uppercase flex-1 border-2 border-gray-400 active:translate-y-px">CANCEL</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-start gap-1">
                                    <button 
                                      onClick={() => { triggerHaptic(20); setOpenNoteId(group.keyValue); setTempNoteText(group.admin_note || ""); }}
                                      className="text-[10px] md:text-[11px] px-2 md:px-2.5 py-1 md:py-1.5 border border-gray-400 rounded shadow-sm font-bold uppercase bg-white hover:bg-gray-100 transition-colors"
                                    >
                                      {group.admin_note ? 'EDIT NOTE' : '+ ADD NOTE'}
                                    </button>
                                    {group.admin_note && (
                                      <div className="text-[11px] md:text-[13px] font-bold text-gray-800 whitespace-pre-wrap break-words leading-tight mt-1 md:mt-1.5">
                                        {group.admin_note}
                                      </div>
                                    )}
                                  </div>
                                )
                              ) : (
                                <div className="flex flex-col items-start gap-1">
                                  {group.admin_note ? (
                                    <div className="text-[11px] md:text-[13px] font-bold text-gray-800 whitespace-pre-wrap break-words leading-tight mt-1 md:mt-1.5">
                                      {group.admin_note}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 text-[11px] md:text-[13px] italic mt-1 md:mt-1.5">No Note</span>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-center text-gray-400 text-[13px] md:text-sm">-</div>
                          )}
                        </td>
                        <td className="p-2 md:p-3 text-center vertical-middle select-none">
                          {group.challan_no && group.status !== 'DELETED' && isWithin30Days(group.timestamp) ? (
                            <button onClick={() => {
                                triggerHaptic(30);
                                const fullChallanItems = ledgerData.filter(i => i.challan_no === group.challan_no);
                                printPDF(group.challan_no, fullChallanItems);
                              }} 
                              className="text-[10px] md:text-[11px] font-bold bg-white border border-gray-400 text-gray-800 hover:bg-gray-100 px-2 md:px-2.5 py-1 md:py-1.5 rounded shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-y-px active:shadow-none transition-colors"
                            >
                              PDF
                            </button>
                          ) : group.challan_no ? (
                            <span className="text-[10px] md:text-[11px] text-gray-400 font-bold">{group.status === 'DELETED' ? 'VOID' : 'LOCKED'}</span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        {userRole === 'master' && (
                          <td className="p-2 md:p-3 text-center vertical-middle select-none border-l border-gray-300">
                            <div className="flex justify-center gap-2 md:gap-3">
                               <button onClick={() => { triggerHaptic(20); setMasterEditModal({ keyField: group.keyField, keyValue: group.keyValue, newKeyValue: group.keyValue, items: group.items.map(i => ({ ...i, edit_qty: i.disp_qty || i.req_qty })) }); }} className="text-base md:text-lg hover:scale-110 active:scale-95 transition-transform" title="Edit Record">✏️</button>
                               <button onClick={() => { triggerHaptic(20); setDeleteModal({ keyField: group.keyField, keyValue: group.keyValue }); }} className="text-base md:text-lg hover:scale-110 active:scale-95 transition-transform" title="Delete Record">🗑️</button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
              {ledgerData.length >= ledgerLimit && (
                 <div className="bg-gray-100 border-t-2 border-black p-2 flex justify-center">
                    <button onClick={() => setLedgerLimit(prev => prev + 50)} className="bg-black text-white px-5 md:px-6 py-1.5 md:py-2 text-[11px] md:text-xs font-bold uppercase hover:bg-gray-800 transition-colors">Load Older Records</button>
                 </div>
              )}
            </div>
          </div>
        )}

        {view === 'depot' && (
          <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-start">
            
            {/* DATA ENTRY SIDE */}
            <div className="w-full md:w-1/2 flex flex-col gap-3 md:gap-4 order-1 md:order-1">
              <div className="w-full bg-white border-2 border-gray-400 shadow-sm flex flex-col">
                <div className="bg-gray-200 border-b-2 border-gray-400 px-3 md:px-4 py-1.5 md:py-2 font-bold flex space-x-2 text-[13px] md:text-sm uppercase text-gray-800">
                  <button onClick={() => { triggerHaptic(30); setDepotMode('DISPATCH'); }} className={`flex-1 py-1 md:py-1.5 rounded-sm border shadow-sm transition-colors ${depotMode === 'DISPATCH' ? 'bg-white border-black text-black' : 'bg-gray-200 border-gray-400 text-gray-500 hover:bg-gray-300'}`}>DISPATCH GOODS</button>
                  <button onClick={() => { triggerHaptic(30); setDepotMode('RETURN_REQUEST'); }} className={`flex-1 py-1 md:py-1.5 rounded-sm border shadow-sm transition-colors ${depotMode === 'RETURN_REQUEST' ? 'bg-red-50 border-red-500 text-red-800' : 'bg-gray-200 border-gray-400 text-gray-500 hover:bg-gray-300'}`}>REQUEST RETURN</button>
                </div>
              </div>

              <form onSubmit={submitDepotAction} className="w-full bg-gray-100 border-2 border-gray-400 shadow-sm p-3 md:p-4">
                <div className="flex flex-col space-y-3 md:space-y-4">
                  <div className="relative">
                    <label className="block text-[11px] md:text-[13px] font-bold text-gray-700 mb-1 md:mb-1.5">SEARCH ITEM / SKU</label>
                    <input ref={depotSearchRef} type="text" value={searchQuery} onBlur={() => setTimeout(() => setIsDepotDropdownOpen(false), 200)} onFocus={() => { if(searchQuery.length > 0) setIsDepotDropdownOpen(true); }} onKeyDown={(e) => handleKeyDown(e, depotFilteredItems, setSelectedItem, setSearchQuery, setIsDepotDropdownOpen, setSelectedUnit, 'depot-item', depotQtyRef, selectedItem)} onChange={(e) => { setSearchQuery(e.target.value); setSelectedItem(null); setIsDepotDropdownOpen(true); setHighlightIndex(-1); }} className="w-full border-2 border-gray-400 p-2 md:p-3 text-[13px] md:text-sm font-bold focus:outline-none focus:border-black focus:bg-yellow-50 select-text transition-colors" placeholder="TYPE TO SEARCH..." />
                    {searchQuery.length > 0 && isDepotDropdownOpen && depotFilteredItems.length > 0 && !selectedItem && (
                      <div className="absolute z-10 w-full max-h-56 overflow-y-auto bg-white border-2 border-gray-400 mt-1 shadow-xl text-[13px] md:text-sm font-bold">
                        {depotFilteredItems.map((item, i) => <div id={`depot-item-${i}`} key={i} onClick={() => handleItemSelect(item, setSelectedItem, setSelectedUnit, setSearchQuery, setIsDepotDropdownOpen, searchQuery, depotQtyRef)} className={`p-2.5 md:p-3 cursor-pointer border-b border-gray-200 uppercase transition-colors ${highlightIndex === i ? 'bg-gray-800 text-white' : 'hover:bg-gray-100'}`}><span className="text-[9px] md:text-[10px] font-bold text-gray-500 mr-2">[{item.category}{item.sku ? ` | ${item.sku}` : ''}]</span>{item.description}</div>)}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3 md:gap-4">
                    <div className="flex-1">
                      <label className="block text-[11px] md:text-[13px] font-bold text-gray-700 mb-1 md:mb-1.5">QTY</label>
                      <input ref={depotQtyRef} type="number" value={qty} onChange={(e) => setQty(e.target.value)} onKeyDown={(e) => { if(e.key==='Enter') addToDepotCart(e); }} className="w-full border-2 border-gray-400 p-2 md:p-3 text-[13px] md:text-sm font-bold focus:outline-none focus:border-black focus:bg-yellow-50 select-text transition-colors" placeholder="0" />
                    </div>
                    <div className="w-28 md:w-32">
                      <label className="block text-[11px] md:text-[13px] font-bold text-gray-700 mb-1 md:mb-1.5">UNIT</label>
                      {selectedItem?.category === 'TVS' ? (
                         <select value={selectedUnit} onChange={(e) => {
                             setSelectedUnit(e.target.value);
                             const learnedUnits = JSON.parse(localStorage.getItem('god_tvs_units') || '{}');
                             learnedUnits[normalizeString(selectedItem.description)] = e.target.value;
                             localStorage.setItem('god_tvs_units', JSON.stringify(learnedUnits));
                           }} className="w-full border-2 border-gray-400 p-2 md:p-3 bg-white text-[13px] md:text-sm font-bold focus:outline-none cursor-pointer select-text transition-colors">
                            <option value="PCS">PCS</option><option value="SET">SET</option>
                         </select>
                      ) : (
                         <input type="text" value={selectedUnit} disabled className="w-full border-2 border-gray-200 p-2 md:p-3 bg-gray-200 text-gray-500 text-[13px] md:text-sm font-bold select-text" />
                      )}
                    </div>
                  </div>
                  <button type="button" onClick={addToDepotCart} disabled={isProcessing} className="w-full text-white font-bold text-[13px] py-2.5 md:py-3 border-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none mt-1 md:mt-2 bg-gray-800 hover:bg-black border-black transition-all disabled:opacity-50">
                    + ADD TO {depotMode === 'RETURN_REQUEST' ? 'RETURN' : 'ORDER'}
                  </button>
                </div>
              </form>
            </div>

            {/* CART & INBOX SIDE */}
            <div className="w-full md:w-1/2 flex flex-col gap-3 md:gap-4 order-2 md:order-2">
              
              {/* THE CART */}
              {depotCart.length > 0 && (
                <div className={`w-full bg-white border-2 shadow-sm flex flex-col p-3 md:p-4 ${depotMode === 'RETURN_REQUEST' ? 'border-red-400' : 'border-blue-400'}`}>
                  <table className="w-full border-collapse mb-3 md:mb-4 text-[13px] md:text-sm">
                    <tbody>
                      {depotCart.map((item, idx) => (
                        <tr key={idx} className={`border-b ${depotMode === 'RETURN_REQUEST' ? 'border-red-200 hover:bg-red-50' : 'border-blue-200 hover:bg-blue-50'} last:border-0 transition-colors`}>
                          <td className="py-2 md:py-2.5 flex items-center gap-2 md:gap-3">
                            <button onClick={() => { triggerHaptic(30); removeDepotCartItem(idx); }} className="text-red-600 bg-white border border-red-300 font-bold px-2 py-0.5 md:px-2.5 md:py-1 hover:bg-red-100 rounded shadow-sm transition-colors">✕</button>
                            <span className="font-bold text-gray-900 uppercase select-text text-[13px] md:text-sm">{item.description}</span>
                          </td>
                          <td className="py-2 md:py-2.5 text-right w-40 md:w-48 whitespace-nowrap select-text">
                            <div className="flex items-center justify-end gap-1.5 md:gap-2">
                              <input type="number" value={item.disp_qty} onChange={(e) => updateDepotCartQty(idx, e.target.value)} className={`w-16 md:w-20 border-2 ${depotMode === 'RETURN_REQUEST' ? 'border-red-400 focus:border-red-600' : 'border-blue-400 focus:border-blue-600'} p-1 md:p-1.5 text-center font-bold focus:outline-none focus:bg-yellow-50 select-text transition-colors`} />
                              <span className={`font-normal text-[11px] md:text-[13px] ${depotMode === 'RETURN_REQUEST' ? 'text-red-900' : 'text-blue-900'}`}>{item.unit || getUnit(item.description)}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {depotMode === 'RETURN_REQUEST' && (
                    <input type="text" value={depotReturnNote} onChange={(e) => setDepotReturnNote(e.target.value)} placeholder="ADD OPTIONAL RETURN NOTE" className="w-full border-2 border-red-400 p-2.5 md:p-3 text-[13px] md:text-sm font-bold focus:outline-none focus:border-red-600 focus:bg-yellow-50 mb-3 md:mb-4 select-text transition-colors" />
                  )}
                  <button onClick={submitDepotAction} disabled={isProcessing} className={`w-full mt-auto text-white font-bold text-[13px] py-2.5 md:py-3 border-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all disabled:opacity-50 ${depotMode === 'RETURN_REQUEST' ? 'bg-red-700 hover:bg-red-800 border-red-900' : 'bg-blue-800 hover:bg-blue-900 border-blue-900'}`}>
                    {isProcessing ? 'PROCESSING...' : depotMode === 'RETURN_REQUEST' ? `SUBMIT REQUEST (${depotCart.length})` : `ISSUE CHALLAN (${depotCart.length})`}
                  </button>
                </div>
              )}

              {/* INBOXES */}
              {!hasDepotInbox && depotCart.length === 0 && (
                <div className="w-full border-2 border-dashed border-gray-400 bg-gray-50 text-gray-400 text-center p-8 font-black uppercase text-sm">
                  NO PENDING INBOX TASKS
                </div>
              )}

              {Object.keys(pendingPOs).length > 0 && (
                <div className="w-full bg-white border-2 border-gray-400 shadow-sm flex flex-col transition-all">
                  <div className="bg-gray-200 border-b-2 border-gray-400 px-3 md:px-4 py-2 md:py-2.5 font-bold text-[13px] md:text-sm uppercase text-gray-800 flex justify-between items-center">
                    <span>Pending PO Inbox</span>
                    <span className="bg-gray-800 text-white px-2 md:px-2.5 py-0.5 rounded text-[11px] md:text-xs leading-none">{Object.keys(pendingPOs).length}</span>
                  </div>
                  <div className="p-3 md:p-4 max-h-[40vh] overflow-y-auto">
                    <div className="space-y-3 md:space-y-4">
                      {Object.entries(pendingPOs).map(([groupId, items]) => (
                        <div key={groupId} className="border-2 border-gray-300 bg-gray-50 p-3 md:p-4 hover:border-gray-400 transition-colors">
                          <div className="font-bold text-[11px] md:text-[13px] mb-2 md:mb-3 text-gray-600 border-b border-gray-200 pb-1 md:pb-1.5">{groupId}</div>
                          <table className="w-full mb-3 md:mb-4 border-collapse text-[13px] md:text-sm">
                            <tbody>
                              {items.map((item, idx) => (
                                <tr key={idx} className="border-b border-gray-300 last:border-0">
                                  <td className="py-1.5 md:py-2.5 pr-2 font-medium text-gray-800 uppercase text-[11px] md:text-xs">{item.item_desc}</td>
                                  <td className="py-1.5 md:py-2.5 text-right font-bold w-20 md:w-24 whitespace-nowrap text-[11px] md:text-xs">{getDisplayQty(item.item_desc, item.req_qty, item.unit)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <button onClick={() => openEditPOModal(groupId, items)} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold text-[11px] md:text-[13px] py-2 md:py-2.5 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all">REVIEW & DISPATCH</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {Object.keys(pendingReturns).length > 0 && (
                <div className="w-full bg-white border-2 border-red-400 shadow-sm flex flex-col transition-all">
                  <div className="bg-red-100 border-b-2 border-red-400 px-3 md:px-4 py-2 md:py-2.5 font-bold text-[13px] md:text-sm uppercase text-red-800 flex justify-between items-center">
                    <span>Incoming Returns</span>
                    <span className="bg-red-800 text-white px-2 md:px-2.5 py-0.5 rounded text-[11px] md:text-xs leading-none">{Object.keys(pendingReturns).length}</span>
                  </div>
                  <div className="p-3 md:p-4 max-h-[30vh] overflow-y-auto">
                    <div className="space-y-3 md:space-y-4">
                      {Object.entries(pendingReturns).map(([challanNo, items]) => (
                        <div key={challanNo} className="border-2 border-red-300 bg-red-50 p-3 md:p-4 hover:border-red-400 transition-colors">
                          <div className="flex justify-between items-center mb-4 border-b-2 border-red-200 pb-2">
                            <span className="font-bold text-sm text-red-900 select-text">{challanNo}</span>
                            <button onClick={() => { triggerHaptic(30); printPDF(challanNo, items); }} className="text-[10px] md:text-[11px] font-bold bg-white border border-gray-400 px-2 md:px-3 py-1 md:py-1.5 shadow-sm hover:bg-gray-100 transition-colors">VIEW DOC</button>
                          </div>
                          <table className="w-full mb-3 border-collapse text-[13px] md:text-sm">
                            <tbody>
                              {items.map((item, idx) => (
                                <tr key={idx} className="border-b border-red-200 last:border-0">
                                  <td className="py-1.5 md:py-2 pr-2 font-medium text-gray-800 uppercase text-[11px] md:text-xs">{item.item_desc}</td>
                                  <td className="py-1.5 md:py-2 text-right font-bold w-20 md:w-24 whitespace-nowrap text-[11px] md:text-xs">{getDisplayQty(item.item_desc, item.disp_qty, item.unit)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <button onClick={() => openVerifyModal(challanNo, items)} className="w-full bg-red-700 hover:bg-red-800 text-white font-bold text-[11px] md:text-[13px] py-2 md:py-2.5 border-2 border-red-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all">VERIFY & ACCEPT</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* RETAIL VIEW */}
        {view === 'retail' && (
          <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-start">
            
            {/* DATA ENTRY SIDE */}
            <div className="w-full md:w-1/2 flex flex-col gap-3 md:gap-4 order-1 md:order-1">
              <div className="w-full bg-white border-2 border-gray-400 shadow-sm flex flex-col">
                <div className="bg-gray-200 border-b-2 border-gray-400 px-3 md:px-4 py-1.5 md:py-2 font-bold flex space-x-2 text-[13px] md:text-sm uppercase text-gray-800">
                  <button onClick={() => { triggerHaptic(30); setRetailMode('PO'); }} className={`flex-1 py-1 md:py-1.5 rounded-sm border shadow-sm transition-colors ${retailMode === 'PO' ? 'bg-white border-black text-black' : 'bg-gray-200 border-gray-400 text-gray-500 hover:bg-gray-300'}`}>ORDER GOODS</button>
                  <button onClick={() => { triggerHaptic(30); setRetailMode('RETURN'); }} className={`flex-1 py-1 md:py-1.5 rounded-sm border shadow-sm transition-colors ${retailMode === 'RETURN' ? 'bg-red-50 border-red-500 text-red-800' : 'bg-gray-200 border-gray-400 text-gray-500 hover:bg-gray-300'}`}>RETURN GOODS</button>
                </div>
              </div>

              <form onSubmit={submitRetailAction} className="w-full bg-gray-100 border-2 border-gray-400 shadow-sm p-3 md:p-4">
                <div className="flex flex-col space-y-3 md:space-y-4">
                  <div className="relative">
                    <label className="block text-[11px] md:text-[13px] font-bold text-gray-700 mb-1 md:mb-1.5">SEARCH ITEM / SKU</label>
                    <input ref={retailSearchRef} type="text" value={retailSearch} onBlur={() => setTimeout(() => setIsRetailDropdownOpen(false), 200)} onFocus={() => { if (retailSearch.length > 0) setIsRetailDropdownOpen(true); }} onKeyDown={(e) => handleKeyDown(e, retailFilteredItems, setRetailSelectedItem, setRetailSearch, setIsRetailDropdownOpen, setRetailSelectedUnit, 'retail-item', retailQtyRef, retailSelectedItem)} onChange={(e) => { setRetailSearch(e.target.value); setRetailSelectedItem(null); setIsRetailDropdownOpen(true); setHighlightIndex(-1); }} className="w-full border-2 border-gray-400 p-2 md:p-3 text-[13px] md:text-sm font-bold focus:outline-none focus:border-black focus:bg-yellow-50 select-text transition-colors" placeholder="TYPE TO SEARCH..." />
                    {retailSearch.length > 0 && isRetailDropdownOpen && (
                      <div className="absolute z-10 w-full max-h-56 overflow-y-auto bg-white border-2 border-gray-400 mt-1 shadow-xl text-[13px] md:text-sm font-bold">
                        {retailFilteredItems.map((item, i) => <div id={`retail-item-${i}`} key={i} onClick={() => handleItemSelect(item, setRetailSelectedItem, setRetailSelectedUnit, setRetailSearch, setIsRetailDropdownOpen, retailSearch, retailQtyRef)} className={`p-2.5 md:p-3 cursor-pointer border-b border-gray-200 uppercase transition-colors ${highlightIndex === i ? 'bg-gray-800 text-white' : 'hover:bg-gray-100'}`}><span className="text-[9px] md:text-[10px] font-bold text-gray-500 mr-2">[{item.category}{item.sku ? ` | ${item.sku}` : ''}]</span>{item.description}</div>)}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3 md:gap-4">
                    <div className="flex-1">
                      <label className="block text-[11px] md:text-[13px] font-bold text-gray-700 mb-1 md:mb-1.5">QTY</label>
                      <input ref={retailQtyRef} type="number" value={retailQty} onChange={(e) => setRetailQty(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') addToRetailCart(e); }} className="w-full border-2 border-gray-400 p-2 md:p-3 text-[13px] md:text-sm font-bold focus:outline-none focus:border-black focus:bg-yellow-50 select-text transition-colors" placeholder="0" />
                    </div>
                    <div className="w-28 md:w-32">
                      <label className="block text-[11px] md:text-[13px] font-bold text-gray-700 mb-1 md:mb-1.5">UNIT</label>
                      {retailSelectedItem?.category === 'TVS' ? (
                         <select value={retailSelectedUnit} onChange={(e) => {
                             setRetailSelectedUnit(e.target.value);
                             const learnedUnits = JSON.parse(localStorage.getItem('god_tvs_units') || '{}');
                             learnedUnits[normalizeString(retailSelectedItem.description)] = e.target.value;
                             localStorage.setItem('god_tvs_units', JSON.stringify(learnedUnits));
                           }} className="w-full border-2 border-gray-400 p-2 md:p-3 bg-white text-[13px] md:text-sm font-bold focus:outline-none cursor-pointer select-text transition-colors">
                            <option value="PCS">PCS</option><option value="SET">SET</option>
                         </select>
                      ) : (
                         <input type="text" value={retailSelectedUnit} disabled className="w-full border-2 border-gray-200 p-2 md:p-3 bg-gray-200 text-gray-500 text-[13px] md:text-sm font-bold select-text" />
                      )}
                    </div>
                  </div>
                  <button type="button" onClick={addToRetailCart} disabled={isProcessing} className={`w-full text-white font-bold text-[13px] py-2.5 md:py-3 border-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none mt-1 md:mt-2 bg-gray-800 hover:bg-black border-black transition-all disabled:opacity-50`}>
                    + ADD TO {retailMode === 'RETURN' ? 'RETURN' : 'ORDER'}
                  </button>
                </div>
              </form>
            </div>

            {/* CART & INBOX SIDE */}
            <div className="w-full md:w-1/2 flex flex-col gap-3 md:gap-4 order-2 md:order-2">
              
              {/* THE CART */}
              {retailCart.length > 0 && (
                <div className={`w-full bg-white border-2 shadow-sm flex flex-col p-3 md:p-4 ${retailMode === 'RETURN' ? 'border-red-400' : 'border-slate-400'}`}>
                  <table className="w-full border-collapse mb-3 md:mb-4 text-[13px] md:text-sm">
                    <tbody>
                      {retailCart.map((item, idx) => (
                        <tr key={idx} className={`border-b ${retailMode === 'RETURN' ? 'border-red-200 hover:bg-red-50' : 'border-slate-200 hover:bg-slate-50'} last:border-0 transition-colors`}>
                          <td className="py-2 md:py-2.5 flex items-center gap-2 md:gap-3">
                            <button onClick={() => { triggerHaptic(30); removeRetailCartItem(idx); }} className="text-red-600 bg-white border border-red-300 font-bold px-2 py-0.5 md:px-2.5 md:py-1 hover:bg-red-100 rounded shadow-sm transition-colors">✕</button>
                            <span className="font-bold text-gray-900 uppercase select-text text-[13px] md:text-sm">{item.description}</span>
                          </td>
                          <td className="py-2 md:py-2.5 text-right w-40 md:w-48 whitespace-nowrap select-text">
                             <div className="flex items-center justify-end gap-1.5 md:gap-2">
                              <input type="number" value={item.req_qty} onChange={(e) => updateRetailCartQty(idx, e.target.value)} className={`w-16 md:w-20 border-2 ${retailMode === 'RETURN' ? 'border-red-400 focus:border-red-600' : 'border-slate-400 focus:border-slate-600'} p-1 md:p-1.5 text-center font-bold focus:outline-none focus:bg-yellow-50 select-text transition-colors`} />
                              <span className={`font-normal text-[11px] md:text-[13px] ${retailMode === 'RETURN' ? 'text-red-900' : 'text-slate-900'}`}>{item.unit || getUnit(item.description)}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {retailMode === 'RETURN' && (
                    <input type="text" value={retailReturnNote} onChange={(e) => setRetailReturnNote(e.target.value)} placeholder="ADD OPTIONAL RETURN NOTE" className="w-full border-2 border-red-400 p-2.5 md:p-3 text-[13px] md:text-sm font-bold focus:outline-none focus:border-red-600 focus:bg-yellow-50 mb-3 md:mb-4 select-text transition-colors" />
                  )}
                  <button onClick={submitRetailAction} disabled={isProcessing} className={`w-full mt-auto text-white font-bold text-[13px] py-2.5 md:py-3 border-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all disabled:opacity-50 ${retailMode === 'RETURN' ? 'bg-red-700 hover:bg-red-800 border-red-900' : 'bg-slate-800 hover:bg-slate-900 border-slate-900'}`}>
                    {isProcessing ? 'PROCESSING...' : retailMode === 'RETURN' ? `SUBMIT RETURN (${retailCart.length})` : `SUBMIT P.O. (${retailCart.length})`}
                  </button>
                </div>
              )}

              {/* INBOXES */}
              {!hasRetailInbox && retailCart.length === 0 && (
                <div className="w-full border-2 border-dashed border-gray-400 bg-gray-50 text-gray-400 text-center p-8 font-black uppercase text-sm">
                  NO PENDING INBOX TASKS
                </div>
              )}

              {Object.keys(incomingDeliveries).length > 0 && (
                <div className="w-full bg-white border-2 border-blue-500 shadow-sm flex flex-col transition-all">
                  <div className="bg-blue-600 border-b-2 border-blue-700 px-3 md:px-4 py-2 md:py-2.5 font-bold text-[13px] md:text-sm uppercase text-white flex justify-between items-center">
                    <span>Incoming Deliveries</span>
                    <span className="bg-white text-blue-800 px-2 md:px-2.5 py-0.5 rounded text-[11px] md:text-xs leading-none shadow-sm">{Object.keys(incomingDeliveries).length}</span>
                  </div>
                  <div className="p-3 md:p-4 max-h-[40vh] overflow-y-auto">
                    <div className="space-y-3 md:space-y-4">
                      {Object.entries(incomingDeliveries).map(([challanNo, items]) => (
                        <div key={challanNo} className="border-2 border-blue-300 bg-blue-50 p-3 md:p-4 hover:border-blue-400 transition-colors">
                          <div className="flex justify-between items-center mb-2 md:mb-3 border-b border-blue-200 pb-1.5 md:pb-2">
                            <span className="font-bold text-[13px] md:text-sm text-blue-900">{challanNo}</span>
                            <button onClick={() => { triggerHaptic(30); printPDF(challanNo, items); }} className="text-[10px] md:text-[11px] font-bold bg-white border border-gray-400 px-2 md:px-3 py-1 md:py-1.5 shadow-sm hover:bg-blue-100 text-blue-900 transition-colors">VIEW DOC</button>
                          </div>
                          <table className="w-full mb-2 md:mb-3 border-collapse text-[13px] md:text-sm">
                            <tbody>
                              {items.map((item, idx) => (
                                <tr key={idx} className="border-b border-blue-200 last:border-0">
                                  <td className="py-1.5 md:py-2 pr-2 font-medium text-gray-800 uppercase text-[11px] md:text-xs">{item.item_desc}</td>
                                  <td className="py-1.5 md:py-2 text-right font-bold w-20 md:w-24 whitespace-nowrap text-[11px] md:text-xs">{getDisplayQty(item.item_desc, item.disp_qty, item.unit)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <button onClick={() => openVerifyModal(challanNo, items)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] md:text-[13px] py-2 md:py-2.5 border-2 border-blue-800 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all">START VERIFICATION</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {Object.keys(pendingDepotReturns).length > 0 && (
                <div className="w-full bg-white border-2 border-red-400 shadow-sm flex flex-col transition-all">
                  <div className="bg-red-100 border-b-2 border-red-400 px-3 md:px-4 py-2 md:py-2.5 font-bold text-[13px] md:text-sm uppercase text-red-800 flex justify-between items-center">
                    <span>Depot Return Requests</span>
                    <span className="bg-red-800 text-white px-2 md:px-2.5 py-0.5 rounded text-[11px] md:text-xs leading-none">{Object.keys(pendingDepotReturns).length}</span>
                  </div>
                  <div className="p-3 md:p-4 max-h-[30vh] overflow-y-auto">
                    <div className="space-y-3 md:space-y-4">
                      {Object.entries(pendingDepotReturns).map(([groupId, items]) => (
                        <div key={groupId} className="border-2 border-red-300 bg-red-50 p-3 md:p-4 hover:border-red-400 transition-colors">
                          <div className="font-bold text-[13px] md:text-sm text-red-900 mb-1.5 md:mb-2 border-b border-red-200 pb-1">{groupId}</div>
                          <table className="w-full mb-2 md:mb-3 border-collapse text-[13px] md:text-sm">
                            <tbody>
                              {items.map((item, idx) => (
                                <tr key={idx} className="border-b border-red-200 last:border-0">
                                  <td className="py-1.5 md:py-2 pr-2 font-medium text-gray-800 uppercase text-[11px] md:text-xs">{item.item_desc}</td>
                                  <td className="py-1.5 md:py-2 text-right font-bold w-20 md:w-24 whitespace-nowrap text-[11px] md:text-xs">{getDisplayQty(item.item_desc, item.req_qty, item.unit)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <button onClick={() => openProcessReturnModal(groupId, items)} className="w-full bg-red-700 hover:bg-red-800 text-white font-bold text-[11px] md:text-[13px] py-2 md:py-2.5 border-2 border-red-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all">PROCESS RETURN</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {Object.keys(pendingPOs).length > 0 && (
                <div className="w-full bg-white border-2 border-orange-400 shadow-sm flex flex-col transition-all">
                  <div className="bg-orange-100 border-b-2 border-orange-400 px-3 md:px-4 py-2 md:py-2.5 font-bold text-[13px] md:text-sm uppercase text-orange-900 flex justify-between items-center">
                    <span>Backorders / Processing</span>
                    <span className="bg-orange-800 text-white px-2 md:px-2.5 py-0.5 rounded text-[11px] md:text-xs leading-none">{Object.keys(pendingPOs).length}</span>
                  </div>
                  <div className="p-3 md:p-4 max-h-[30vh] overflow-y-auto">
                    <div className="space-y-3 md:space-y-4">
                      {Object.entries(pendingPOs).map(([groupId, items]) => (
                        <div key={groupId} className="border border-orange-300 bg-orange-50 p-2.5 md:p-3 hover:border-orange-400 transition-colors">
                          <div className="font-bold text-[11px] md:text-xs text-orange-900 mb-1.5 md:mb-2 border-b border-orange-200 pb-1">{groupId}</div>
                          <table className="w-full border-collapse text-[13px] md:text-sm">
                            <tbody>
                              {items.map((item, idx) => (
                                <tr key={idx} className="border-b border-orange-200 last:border-0">
                                  <td className="py-1 md:py-1.5 pr-2 font-medium text-gray-700 uppercase text-[11px] md:text-xs">{item.item_desc}</td>
                                  <td className="py-1 md:py-1.5 text-right font-bold w-20 md:w-24 whitespace-nowrap text-[11px] md:text-xs">{getDisplayQty(item.item_desc, item.req_qty, item.unit)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </main>
    </div>
  );
}