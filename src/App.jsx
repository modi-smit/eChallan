// ==========================================
  // --- PDF GENERATOR (PRE-PRINTED GRID) ---
  // ==========================================
  const printPDF = (challanNo, itemsList) => {
    const doc = new jsPDF({ format: 'a5' }); 
    const isReturn = String(challanNo).startsWith('RT');
    const txTimestamp = itemsList[0]?.timestamp ? new Date(itemsList[0].timestamp) : new Date();
    
    let totalNos = 0;
    
    const drawPageHeaders = () => {
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.4);
        
        // 1. MASTER OUTER BORDER (148x210mm A5 Page)
        doc.rect(5, 5, 138, 195); 

        // 2. HEADER
        doc.setFillColor(235, 235, 235); 
        doc.rect(5, 5, 138, 16, 'F'); 
        doc.rect(5, 5, 138, 16); 
        
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold"); doc.setFontSize(18); 
        doc.text("GUJARAT OIL DEPOT", 74, 12, { align: "center" });
        doc.setFontSize(10); 
        doc.text(isReturn ? "RETURN CHALLAN" : "DELIVERY CHALLAN", 74, 18, { align: "center" });
        
        doc.setDrawColor(0, 0, 0);
        doc.line(5, 21, 143, 21); // Header Bottom Divider
        
        // 3. METADATA
        doc.setFontSize(9);
        doc.text(isReturn ? `RETURN NO :` : `CHALLAN NO :`, 8, 27); doc.setFont("helvetica", "normal"); doc.text(String(challanNo), 32, 27);
        doc.setFont("helvetica", "bold"); doc.text(`DATE :`, 104, 27); doc.setFont("helvetica", "normal"); doc.text(formatDate(txTimestamp), 116, 27);
        doc.setFont("helvetica", "bold"); doc.text(`BILLED TO :`, 8, 33); doc.setFont("helvetica", "normal"); doc.text(`SOUTH GUJARAT DISTRIBUTORS`, 28, 33); doc.text(`RETAIL STORE`, 28, 38);
        
        // 4. TABLE HEADER
        doc.setFillColor(245, 245, 245); 
        doc.rect(5, 41, 138, 7, 'F'); 
        doc.rect(5, 41, 138, 7); 
        
        doc.setFont("helvetica", "bold"); doc.setFontSize(9);
        doc.text("SR", 10, 46, { align: "center" }); 
        doc.text("ITEM DESCRIPTION", 17, 46, { align: "left" }); 
        doc.text("NOS", 115, 46, { align: "center" }); 
        doc.text("QTY", 134, 46, { align: "center" });
        doc.setFont("helvetica", "normal");
    };

    const drawPageGrid = (endY) => {
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.4);
        
        // Vertical Grid Lines
        doc.line(15, 48, 15, endY);   // SR
        doc.line(105, 48, 105, endY); // Desc
        doc.line(125, 48, 125, endY); // NOS
        
        // Bottom Closure Line
        doc.line(5, endY, 143, endY); 
    };

    const drawSignatures = (sigY) => {
        doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.text("Receiver's Signature / Stamp", 8, sigY);
        if (itemsList.length > 0 && (itemsList[0].status === 'ACCEPTED' || itemsList[0].status === 'RETURN_ACCEPTED')) {
          doc.setTextColor(0, 128, 0); doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.text("Digitally Verified", 8, sigY - 4); 
          doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.text(`Verified: ${formatDate(txTimestamp)} ${formatTime(txTimestamp)}`, 8, sigY + 2);
        }
        doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text("For GUJARAT OIL DEPOT", 140, sigY - 5, { align: "right" });
        doc.setTextColor(0, 51, 153); doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.text("Electronically Signed Document", 140, sigY, { align: "right" });
        doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "normal"); doc.setFontSize(6); doc.text(`Auth: ${formatDate(txTimestamp)} ${formatTime(txTimestamp)}`, 140, sigY + 3, { align: "right" });
    };

    drawPageHeaders();
    let y = 53;
    const maxY = 165; 

    itemsList.forEach((item, index) => {
      const desc = String(item.description || item.item_desc || ''); 
      const splitDesc = doc.splitTextToSize(desc, 85); 
      const rawQty = parseInt(item.disp_qty || item.req_qty) || 0; 
      totalNos += rawQty;
      
      const displayStr = String(getDisplayQty(desc, rawQty, item.unit || getUnit(desc))); 
      const paddedQty = String(rawQty).padStart(2, '0');
      const rowHeight = (splitDesc.length * 4) + 1;
      
      // Page Break Engine
      if (y + rowHeight > maxY) {
          drawPageGrid(maxY);
          drawSignatures(maxY + 15);
          
          doc.line(5, maxY, 5, maxY + 22);
          doc.line(143, maxY, 143, maxY + 22);
          doc.line(5, maxY + 22, 143, maxY + 22);

          doc.addPage();
          drawPageHeaders();
          y = 53;
      }

      doc.text(`${index + 1}`, 10, y, { align: "center" }); 
      doc.text(splitDesc, 17, y); 
      doc.setFont("helvetica", "bold"); 
      doc.text(paddedQty, 115, y, { align: "center" }); 
      doc.setFontSize(8); 
      doc.text(displayStr, 134, y, { align: "center" });
      doc.setFontSize(9); doc.setFont("helvetica", "normal");
      
      if (index < itemsList.length - 1 && y + rowHeight < maxY) { 
        doc.setLineWidth(0.1); 
        doc.setDrawColor(200, 200, 200); 
        doc.line(5.2, y + rowHeight - 2, 142.8, y + rowHeight - 2); 
        doc.setDrawColor(0, 0, 0); 
      }
      y += rowHeight + 2; 
    });

    // 9. LAST PAGE CLOSURE & TOTAL BOX
    drawPageGrid(y);
    doc.setFillColor(235, 235, 235); 
    doc.rect(5, y, 100, 7, 'F'); 
    doc.rect(105, y, 38, 7, 'F'); 
    doc.rect(5, y, 138, 7, 'S'); 
    doc.line(105, y, 105, y + 7); 

    doc.setFont("helvetica", "bold");
    doc.text("TOTAL", 100, y + 5, { align: "right" }); 
    doc.text(String(totalNos).padStart(2, '0'), 115, y + 5, { align: "center" });
    
    // 10. SIGNATURES & PAGINATION
    const sigY = y + 20;
    drawSignatures(sigY);

    doc.line(5, y + 7, 5, sigY + 7);
    doc.line(143, y + 7, 143, sigY + 7);
    doc.line(5, sigY + 7, 143, sigY + 7);

    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(`Page ${i} of ${totalPages}`, 140, 203, { align: "right" });
    }

    doc.save(`${challanNo}.pdf`);
  };

  // ==========================================
  // --- EXCEL EXPORTER ---
  // ==========================================
  const handleFileUpload = async (event) => {
    const file = event.target.files[0]; 
    if (!file) return; 
    setUploadStatus('Processing...');
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result); 
        const workbook = XLSX.read(data, { type: 'array' }); 
        let finalItemsToUpload = [];
        
        const normalizeRow = (row) => { 
            const normalized = {}; 
            for (let key in row) normalized[String(key).toLowerCase().trim()] = row[key]; 
            return normalized; 
        };
        
        ['SERVO', 'TVS'].forEach(sheetName => {
          const sheet = workbook.SheetNames.find(s => String(s).toUpperCase() === sheetName);
          if (sheet) {
            const formatted = XLSX.utils.sheet_to_json(workbook.Sheets[sheet]).map(row => {
              const norm = normalizeRow(row); 
              return { 
                  description: cleanDesc(norm.description), 
                  ratio: parseFloat(norm.ratio) || 1, 
                  category: sheetName, 
                  sku: norm.sku || norm.code || norm.shortname || null 
              };
            }).filter(item => item.description);
            finalItemsToUpload = [...finalItemsToUpload, ...formatted];
          }
        });
        
        await supabase.from('master_items').delete().neq('description', 'dummy'); 
        await supabase.from('master_items').insert(finalItemsToUpload);
        refreshAllData();
      } catch (error) { 
          setUploadStatus(`Error`); 
      }
    };
    reader.readAsArrayBuffer(file); 
  };

  const downloadLedger = () => {
    if(ledgerData.length === 0) { alert(`No data to export.`); return; }
    
    const dispatchedDataObj = {}; 
    const returnsDataObj = {};
    
    ledgerData.forEach(row => {
      const key = String(row.challan_no || row.group_id || 'UNKNOWN');
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
      const desc = cleanDesc(row.item_desc); 
      const q = parseInt(row.disp_qty || row.req_qty) || 0;
      
      if(!itemSummary[desc]) itemSummary[desc] = { qty: 0, unit: row.unit || getUnit(desc), category: getCategory(desc), rawItemDesc: row.item_desc };
      
      if (row.status !== 'DELETED') {
        if (row.status === 'RETURN_ACCEPTED') itemSummary[desc].qty -= q; 
        else if (row.status === 'ACCEPTED' || row.status === 'DISPATCHED') itemSummary[desc].qty += q;
      }
    });

    const sumEntries = Object.entries(itemSummary).filter(([_, data]) => data.qty !== 0); 
    const servoEntries = sumEntries.filter(([_, data]) => data.category === 'SERVO');
    const tvsEntries = sumEntries.filter(([_, data]) => data.category === 'TVS');

    let htmlArray = [];
    htmlArray.push(`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"></head><body>`);
    htmlArray.push(`<table border="0" cellpadding="5" cellspacing="0" style="font-family:Arial,sans-serif;border-collapse:collapse;font-size:13px;"><colgroup><col width="130"/><col width="110"/><col width="380"/><col width="50"/><col width="130"/><col width="180"/><col width="30"/><col width="380"/><col width="80"/><col width="140"/></colgroup>`);

    const cell = (bg, col, align, wrap, fw, isNum, text, rspan=1, cspan=1) => {
        let st = `background-color:${bg};color:${col};border:1px solid black;padding:8px;vertical-align:middle;text-align:${align};font-weight:${fw};`;
        st += wrap ? `white-space:normal;word-wrap:break-word;mso-style-textwrap:yes;` : `white-space:nowrap;`;
        if (isNum) st += `mso-number-format:'\\@';`;
        return `<td rowspan="${rspan}" colspan="${cspan}" style="${st}">${text}</td>`;
    };

    let leftRows = [];
    let rightRows = [];
    
    leftRows.push(cell('#d1d5db', '#000', 'left', false, 'bold', false, `GUJARAT OIL DEPOT - LEDGER`, 1, 6));
    leftRows.push(cell('#f3f4f6', '#000', 'left', false, 'bold', false, `BILLED TO: SOUTH GUJARAT DISTRIBUTORS`, 1, 6));
    leftRows.push(
        cell('#e5e7eb', '#000', 'center', false, 'bold', false, 'DATE/TIME') + 
        cell('#e5e7eb', '#000', 'center', false, 'bold', false, 'CHALLAN NO') + 
        cell('#e5e7eb', '#000', 'left', false, 'bold', false, 'ITEM DESCRIPTION') + 
        cell('#e5e7eb', '#000', 'center', false, 'bold', false, 'NOS') + 
        cell('#e5e7eb', '#000', 'center', false, 'bold', false, 'QTY') + 
        cell('#e5e7eb', '#000', 'center', false, 'bold', false, 'ADMIN NOTE')
    );

    let gTotal = 0;
    dispatchedGroups.forEach(g => {
        let bg = g.status === "DELETED" ? "#f3f4f6" : g.status === "ACCEPTED" ? "#dcfce7" : "#dbeafe";
        let tc = g.status === "DELETED" ? "#9ca3af" : "#000";
        let cText = g.status === "DELETED" ? `${g.challan_no||'-'} (DELETED)` : (g.challan_no||'-');
        
        g.items.forEach((r, i) => {
            let rq = parseInt(r.disp_qty || r.req_qty) || 0;
            if (g.status !== 'DELETED') gTotal += rq;
            let rowHtml = "";
            if (i === 0) {
                rowHtml += cell(bg, '#000', 'center', true, 'bold', true, `${formatDate(g.date)}<br style="mso-data-placement:same-cell;"/>${formatTime(g.date)}`, g.items.length);
                rowHtml += cell(bg, tc, 'center', false, 'bold', true, cText, g.items.length);
            }
            rowHtml += cell(bg, '#000', 'left', true, 'normal', false, cleanDesc(r.item_desc));
            rowHtml += cell(bg, tc, 'center', false, 'bold', false, String(rq).padStart(2, '0'));
            rowHtml += cell(bg, tc, 'center', false, 'bold', false, String(getDisplayQty(r.item_desc, rq, r.unit||getUnit(r.item_desc))).toUpperCase());
            if (i === 0) rowHtml += cell(bg, '#000', 'left', true, 'normal', false, String(g.admin_note || ''), g.items.length);
            leftRows.push(rowHtml);
        });
    });
    
    leftRows.push(cell('#d1d5db', '#000', 'right', false, 'bold', false, 'GRAND TOTAL:', 1, 3) + cell('#d1d5db', '#000', 'center', false, 'bold', false, String(gTotal).padStart(2, '0')) + cell('#d1d5db', '#000', 'left', false, 'normal', false, '', 1, 2));

    rightRows.push(cell('#fde047', '#000', 'left', false, 'bold', false, `ITEM WISE SUMMARY`, 1, 3));
    rightRows.push(cell('#fef08a', '#000', 'left', false, 'bold', false, `TOTAL SKUS: ${sumEntries.length}`, 1, 3));
    rightRows.push(cell('#fef9c3', '#000', 'left', false, 'bold', false, 'ITEM DESCRIPTION') + cell('#fef9c3', '#000', 'center', false, 'bold', false, 'TOTAL NOS') + cell('#fef9c3', '#000', 'center', false, 'bold', false, 'CONVERTED QTY'));
    
    if (servoEntries.length > 0) {
        rightRows.push(cell('#fde047', '#1e3a8a', 'center', false, 'bold', false, 'SERVO LUBRICANTS', 1, 3));
        let sTot = 0;
        servoEntries.forEach(([d, v]) => { 
            sTot += v.qty; 
            rightRows.push(cell('#fef9c3', '#000', 'left', true, 'normal', false, cleanDesc(v.rawItemDesc)) + cell('#fef9c3', '#000', 'center', false, 'bold', false, String(v.qty).padStart(2,'0')) + cell('#fef9c3', '#000', 'center', false, 'bold', false, String(getDisplayQty(d, v.qty, v.unit)).toUpperCase())); 
        });
        rightRows.push(cell('#fef08a', '#000', 'right', false, 'bold', false, 'GROUP TOTAL:', 1, 2) + cell('#fef08a', '#000', 'center', false, 'bold', false, String(sTot).padStart(2, '0')));
    }
    
    if (tvsEntries.length > 0) {
        rightRows.push(cell('#fde047', '#1e3a8a', 'center', false, 'bold', false, 'TVS TYRES & TUBES', 1, 3));
        let tTot = 0;
        tvsEntries.forEach(([d, v]) => { 
            tTot += v.qty; 
            rightRows.push(cell('#fef9c3', '#000', 'left', true, 'normal', false, cleanDesc(v.rawItemDesc)) + cell('#fef9c3', '#000', 'center', false, 'bold', false, String(v.qty).padStart(2,'0')) + cell('#fef9c3', '#000', 'center', false, 'bold', false, String(getDisplayQty(d, v.qty, v.unit)).toUpperCase())); 
        });
        rightRows.push(cell('#fef08a', '#000', 'right', false, 'bold', false, 'GROUP TOTAL:', 1, 2) + cell('#fef08a', '#000', 'center', false, 'bold', false, String(tTot).padStart(2, '0')));
    }

    const maxRows = Math.max(leftRows.length, rightRows.length);
    for(let i=0; i<maxRows; i++) {
        htmlArray.push(`<tr style="height:35px;">`);
        htmlArray.push(leftRows[i] ? leftRows[i] : `<td colspan="6" style="border:none;"></td>`);
        htmlArray.push(`<td style="border:none;width:30px;"></td>`);
        htmlArray.push(rightRows[i] ? rightRows[i] : `<td colspan="3" style="border:none;"></td>`);
        htmlArray.push(`</tr>`);
    }
    htmlArray.push(`</table></body></html>`);

    const blob = new Blob([htmlArray.join('')], { type: "application/vnd.ms-excel" }); 
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); 
    a.href = url; 
    a.download = `eChallan ${formatDate().replace(/\//g, '.')}.xls`;
    document.body.appendChild(a); 
    a.click(); 
    document.body.removeChild(a);
  };

  // ==========================================
  // --- ACTIONS (CART & MODALS) ---
  // ==========================================

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
  
  const updateRetailCartQty = (index, val) => { const updated = [...retailCart]; updated[index] = { ...updated[index], req_qty: val }; setRetailCart(updated); };
  const removeRetailCartItem = (index) => setRetailCart(retailCart.filter((_, i) => i !== index));

  const submitRetailAction = async (e) => {
    if (e) e.preventDefault();
    if (retailCart.length === 0 || isProcessing) return; 
    
    triggerHaptic([40, 40, 100]);
    setIsProcessing(true);
    
    try {
        const isReturn = retailMode === 'RETURN'; const groupId = await getNextSequence(isReturn ? 'RT' : 'PO');
        const tx = retailCart.map(item => ({ 
          group_id: groupId, item_desc: item.description, req_qty: parseInt(item.req_qty), 
          unit: item.unit, status: isReturn ? 'RETURN_INITIATED' : 'PO_PLACED',
          challan_no: isReturn ? groupId : null, note: isReturn ? (retailReturnNote || null) : null
        }));
        
        await executeTransaction(tx, `${isReturn ? 'Return' : 'P.O.'} Submitted`, `Group ID: ${groupId}`, () => {
          setRetailCart([]); setRetailReturnNote('');
        });
    } catch(err) {
        triggerSystemAlert("Error", err.message, "error");
    } finally {
        setIsProcessing(false);
    }
  };

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

  const updateDepotCartQty = (index, val) => { const updated = [...depotCart]; updated[index] = { ...updated[index], disp_qty: val }; setDepotCart(updated); };
  const removeDepotCartItem = (index) => setDepotCart(depotCart.filter((_, i) => i !== index));

  const submitDepotAction = async (e) => {
    e.preventDefault(); 
    if (depotCart.length === 0 || isProcessing) return;
    
    triggerHaptic([40, 40, 100]);
    setIsProcessing(true);

    try {
        if (depotMode === 'DISPATCH') {
          const challanNo = await getNextSequence('CN'); const groupId = getOfflineSequence('M');
          const tx = depotCart.map(item => ({ group_id: groupId, challan_no: challanNo, item_desc: item.description, disp_qty: parseInt(item.disp_qty), unit: item.unit, status: 'DISPATCHED' }));
          await executeTransaction(tx, "Challan Issued", `Challan: ${challanNo}`, () => {
            printPDF(challanNo, depotCart); setDepotCart([]); 
          });
        } else {
          const groupId = await getNextSequence('RR');
          const tx = depotCart.map(item => ({ 
            group_id: groupId, item_desc: item.description, req_qty: parseInt(item.disp_qty), 
            unit: item.unit, status: 'RETURN_REQUESTED', note: depotReturnNote || null 
          }));
          await executeTransaction(tx, "Return Request Submitted", `Group ID: ${groupId}`, () => {
            setDepotCart([]); setDepotReturnNote('');
          });
        }
    } catch(err) {
        triggerSystemAlert("Error", err.message, "error");
    } finally {
        setIsProcessing(false);
    }
  };

  const openVerifyModal = (challanNo, items) => {
    triggerHaptic(30);
    const checks = {}; items.forEach((_, i) => checks[i] = false);
    const sortedItems = [...items].sort((a,b) => String(a.item_desc || '').localeCompare(String(b.item_desc || '')));
    setVerifyModal({ 
      challanNo, 
      items: sortedItems.map(i => ({ ...i, edit_qty: i.disp_qty || i.req_qty })), 
      checks, 
      isDepotReturn: challanNo ? String(challanNo).startsWith('RT') : false
    });
  };

  const toggleVerifyCheck = (index) => {
      triggerHaptic(20);
      setVerifyModal(prev => ({ ...prev, checks: { ...prev.checks, [index]: !prev.checks[index] } }));
  };

  const acceptDelivery = async () => {
    if (!isOnline) { triggerSystemAlert("Error", "Internet required.", "error"); return; }
    if (!verifyModal || isProcessing) return; 

    // FIX: Requires at least one item using .some()
    const checkedIndexes = Object.keys(verifyModal.checks).filter(k => verifyModal.checks[k]);
    if (checkedIndexes.length === 0) {
        triggerSystemAlert("Action Required", "Please check off at least one item to verify.", "warning");
        return;
    }

    triggerHaptic([40, 40, 100]);
    setIsProcessing(true);
    
    try {
        const newStatus = verifyModal.isDepotReturn ? 'RETURN_ACCEPTED' : 'ACCEPTED';
        for (let i = 0; i < checkedIndexes.length; i++) {
            const index = checkedIndexes[i];
            const item = verifyModal.items[index];
            const finalQty = parseInt(item.edit_qty) || 0;
            await supabase.from('transactions').update({ status: newStatus, disp_qty: finalQty, req_qty: finalQty }).eq('id', item.id);
        }
        setVerifyModal(null); 
        refreshAllData();
        triggerSystemAlert("Accepted", `Items from ${verifyModal.challanNo} verified.`, "success");
    } catch (err) {
        triggerSystemAlert("Error", err.message, "error");
    } finally {
        setIsProcessing(false);
    }
  };

  const openEditPOModal = (groupId, items) => { 
      triggerHaptic(30);
      const sortedItems = [...items].sort((a,b) => String(a.item_desc || '').localeCompare(String(b.item_desc || '')));
      setEditPOModal({ groupId, items: sortedItems.map(i => ({ ...i, edit_qty: i.req_qty })) }); 
  };
  
  const handleEditPOQty = (index, val) => { 
      const updated = [...editPOModal.items]; 
      updated[index] = { ...updated[index], edit_qty: val }; 
      setEditPOModal({ ...editPOModal, items: updated }); 
  };
  
  const confirmDispatchPO = async () => {
    if (!isOnline) { triggerSystemAlert("Error", "Internet required.", "error"); return; }
    if (!editPOModal || isProcessing) return; 
    
    triggerHaptic([40, 40, 100]);
    setIsProcessing(true);
    
    try {
        const challanNo = await getNextSequence('CN'); 
        const backorders = []; 
        const printItems = [];
        let newPO = null;

        for (const item of editPOModal.items) {
          const dispatchQty = parseInt(item.edit_qty) || 0; 
          const reqQty = parseInt(item.req_qty) || 0;

          if (dispatchQty <= 0) { 
              await supabase.from('transactions').delete().eq('id', item.id); 
              continue; 
          }
          
          await supabase.from('transactions').update({ status: 'DISPATCHED', challan_no: challanNo, disp_qty: dispatchQty }).eq('id', item.id); 
          printItems.push({ ...item, disp_qty: dispatchQty }); 
          
          if (dispatchQty < reqQty) { 
              if (!newPO) newPO = await getNextSequence('PO');
              backorders.push({ group_id: newPO, item_desc: item.item_desc, req_qty: reqQty - dispatchQty, unit: item.unit, status: 'PO_PLACED' }); 
          }
        }

        if (backorders.length > 0) await supabase.from('transactions').insert(backorders);
        if (printItems.length > 0) printPDF(challanNo, printItems);
        
        setEditPOModal(null); 
        refreshAllData();
        triggerSystemAlert("Success", `Challan ${challanNo} Dispatched.`, "success");
    } catch(err) {
        triggerSystemAlert("Error", err.message, "error");
    } finally {
        setIsProcessing(false);
    }
  };

  const openProcessReturnModal = (groupId, items) => { 
      triggerHaptic(30);
      const sortedItems = [...items].sort((a,b) => String(a.item_desc || '').localeCompare(String(b.item_desc || '')));
      setProcessReturnModal({ groupId, items: sortedItems.map(i => ({ ...i, edit_qty: i.req_qty })) }); 
  };
  
  const handleProcessReturnQty = (index, val) => { 
      const updated = [...processReturnModal.items]; 
      updated[index] = { ...updated[index], edit_qty: val }; 
      setProcessReturnModal({ ...processReturnModal, items: updated }); 
  };

  const confirmProcessReturnRequest = async () => {
    if (!isOnline) { triggerSystemAlert("Error", "Internet required.", "error"); return; }
    if (!processReturnModal || isProcessing) return; 
    
    triggerHaptic([40, 40, 100]);
    setIsProcessing(true);
    
    try {
        const challanNo = await getNextSequence('RT'); 
        const backorders = []; 
        const printItems = [];
        let newRR = null;

        for (const item of processReturnModal.items) {
          const dispatchQty = parseInt(item.edit_qty) || 0; 
          const reqQty = parseInt(item.req_qty) || 0;

          if (dispatchQty <= 0) { 
              await supabase.from('transactions').delete().eq('id', item.id); 
              continue; 
          }

          await supabase.from('transactions').update({ status: 'RETURN_INITIATED', challan_no: challanNo, disp_qty: dispatchQty }).eq('id', item.id); 
          printItems.push({ ...item, disp_qty: dispatchQty }); 
          
          if (dispatchQty < reqQty) { 
              if (!newRR) newRR = await getNextSequence('RR');
              backorders.push({ group_id: newRR, item_desc: item.item_desc, req_qty: reqQty - dispatchQty, unit: item.unit, status: 'RETURN_REQUESTED' }); 
          }
        }

        if (backorders.length > 0) await supabase.from('transactions').insert(backorders);
        if (printItems.length > 0) printPDF(challanNo, printItems);
        
        setProcessReturnModal(null); 
        refreshAllData();
        triggerSystemAlert("Success", `Return ${challanNo} Generated.`, "success");
    } catch(err) {
        triggerSystemAlert("Error", err.message, "error");
    } finally {
        setIsProcessing(false);
    }
  };

  // ==========================================
  // --- UI RENDERING ---
  // ==========================================
  
  // INITIALIZATION
  if (loadingAuth) return (
    <div className="min-h-screen bg-gray-200 flex items-center justify-center font-sans select-none">
      <div className="bg-white p-6 md:p-8 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-center">
          <div className="text-gray-800 font-black tracking-widest uppercase text-lg">INITIALIZING SYSTEM...</div>
          <div className="text-xs font-bold text-gray-500 mt-2 uppercase animate-pulse">Connecting to Database</div>
      </div>
    </div>
  );

  // BLANK SCREEN / TIMEOUT RECOVERY
  if (session && view === '') return (
    <div className="min-h-screen bg-gray-200 flex items-center justify-center font-sans select-none">
      <div className="bg-yellow-100 border-2 border-yellow-600 p-8 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-w-md">
        <h2 className="text-xl font-black text-yellow-800 mb-2">NETWORK DELAY</h2>
        <p className="font-bold text-gray-800 text-sm mb-4">The database is taking too long to load your profile. Please refresh.</p>
        <button onClick={() => window.location.reload()} className="w-full bg-yellow-600 text-white py-3 font-bold uppercase border-2 border-yellow-800 hover:bg-yellow-700">FORCE REFRESH</button>
      </div>
    </div>
  );
  
  // LOGIN SCREEN
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
      
      {/* TOASTS */}
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
      <style dangerouslySetInnerHTML={{__html: `@keyframes slide-in { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } } .animate-slide-in { animation: slide-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }`}} />

      {/* SETTINGS MODAL */}
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

      {/* MASTER DELETE MODAL */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex justify-center items-center p-3 md:p-4 z-[60]">
            <div className="bg-white border-2 border-black max-w-md w-full p-4 md:p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <h2 className="text-lg font-black border-b-2 border-black pb-2 mb-4 uppercase text-red-800">DELETE RECORD: {deleteModal.keyValue}</h2>
                <p className="text-[13px] md:text-sm font-bold text-gray-700 mb-6">How would you like to remove this record?</p>
                <div className="flex flex-col gap-3">
                    <button onClick={() => executeDelete('SOFT')} disabled={isProcessing} className="w-full bg-gray-200 border-2 border-black p-3 text-left hover:bg-gray-300 transition-colors disabled:opacity-50">
                        <span className="block text-black font-black text-sm">1. VOID (Soft Delete)</span>
                        <span className="block text-[11px] md:text-xs font-bold text-gray-600 mt-1 uppercase">Zeroes quantities but keeps the sequence number in the ledger for auditing transparency.</span>
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

      {/* --- MASTER EDIT MODAL (MOBILE RESPONSIVE FIX) --- */}
      {masterEditModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex justify-center items-center p-3 md:p-4 z-[60]">
            <div className="bg-white border-2 border-black max-w-xl w-full p-4 md:p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <h2 className="font-bold border-b-2 border-black pb-2 md:pb-3 mb-3 md:mb-4 uppercase text-lg">EDIT RECORD: {masterEditModal.keyValue}</h2>
              
              <div className="space-y-3 mb-4 md:mb-6 max-h-[60vh] overflow-y-auto pr-2">
                <div className="hidden sm:flex text-[11px] md:text-[13px] font-bold text-gray-500 px-2 uppercase"><span className="flex-1">ITEM DESCRIPTION</span><span className="w-24 text-center">EDIT QTY</span></div>
                
                {masterEditModal.items.map((item, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-2 bg-gray-100 border border-gray-300 p-3 rounded">
                    <input type="text" list="masterItemsList" value={item.item_desc} onChange={(e) => {
                        const updated = [...masterEditModal.items]; 
                        updated[idx] = { ...updated[idx], item_desc: e.target.value }; 
                        setMasterEditModal({...masterEditModal, items: updated});
                    }} className="w-full sm:flex-1 text-[13px] md:text-sm p-2 border-2 border-black font-bold focus:bg-yellow-50 focus:outline-none select-text uppercase" />
                    
                    <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto mt-1 sm:mt-0">
                       <span className="text-[11px] font-bold text-gray-500 uppercase sm:hidden">Quantity:</span>
                       <input type="number" value={item.edit_qty} onChange={(e) => {
                          const updated = [...masterEditModal.items]; 
                          updated[idx] = { ...updated[idx], edit_qty: e.target.value }; 
                          setMasterEditModal({...masterEditModal, items: updated});
                       }} className="w-24 text-[13px] md:text-sm p-2 border-2 border-black text-center font-bold focus:bg-yellow-50 focus:outline-none select-text" />
                    </div>
                  </div>
                ))}
                <datalist id="masterItemsList">{masterItems.map((m, i) => <option key={i} value={m.description} />)}</datalist>
              </div>
              
              <div className="flex space-x-2">
                <button onClick={() => { triggerHaptic(30); setMasterEditModal(null); }} className="flex-1 border-2 border-black bg-gray-200 py-3 text-[13px] md:text-sm font-bold hover:bg-gray-300 transition-colors text-black">CANCEL</button>
                <button onClick={confirmMasterEdit} disabled={isProcessing} className="flex-1 border-2 border-black bg-blue-800 text-white py-3 text-[13px] md:text-sm font-bold hover:bg-blue-900 uppercase transition-all disabled:opacity-50">{isProcessing ? 'SAVING...' : 'SAVE CHANGES'}</button>
              </div>
            </div>
        </div>
      )}

      {/* VERIFY MODAL */}
      {verifyModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex justify-center items-center p-3 md:p-4 z-[60]">
            <div className="bg-white border-2 border-black max-w-lg w-full p-4 md:p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <h2 className="text-lg font-bold border-b-2 border-black pb-2 mb-4 uppercase text-blue-800">VERIFY GOODS: {verifyModal.challanNo}</h2>
                <div className="space-y-2 mb-4 max-h-[60vh] overflow-y-auto pr-2">
                  <div className="flex text-[11px] font-bold text-gray-500 px-2 uppercase"><span className="w-8 text-center">CHK</span><span className="flex-1">ITEM DESCRIPTION</span><span className="w-20 md:w-24 text-center">RCVD QTY</span></div>
                  {verifyModal.items.map((item, idx) => (
                    <label key={idx} className={`flex items-center space-x-2 md:space-x-3 p-2 border-2 cursor-pointer transition-colors ${verifyModal.checks[idx] ? 'bg-blue-50 border-blue-500' : 'bg-gray-50 border-gray-300 hover:bg-gray-100'}`}>
                      <div className="w-8 flex justify-center"><input type="checkbox" checked={verifyModal.checks[idx]} onChange={() => toggleVerifyCheck(idx)} className="w-6 h-6 cursor-pointer accent-blue-600" /></div>
                      <span className="flex-1 text-[13px] md:text-sm font-bold text-gray-800 truncate" title={item.item_desc}>{item.item_desc}</span>
                      <input type="number" value={item.edit_qty} onClick={(e) => e.stopPropagation()} onChange={(e) => {
                              const updated = [...verifyModal.items]; updated[idx] = { ...updated[idx], edit_qty: e.target.value }; setVerifyModal({ ...verifyModal, items: updated });
                          }} className="w-20 md:w-24 text-[13px] md:text-sm p-1.5 border-2 border-black text-center font-bold focus:bg-yellow-50 focus:outline-none" />
                    </label>
                  ))}
                </div>
                <div className="flex space-x-3">
                  <button onClick={() => { triggerHaptic(30); setVerifyModal(null); }} className="flex-1 border-2 border-black bg-gray-200 py-3 text-[13px] md:text-sm font-bold hover:bg-gray-300 text-black">CANCEL</button>
                  <button onClick={acceptDelivery} disabled={!Object.values(verifyModal.checks).some(Boolean) || isProcessing} className="flex-1 border-2 border-black bg-blue-700 text-white py-3 text-[13px] md:text-sm font-bold hover:bg-blue-800 disabled:opacity-50 transition-all">{isProcessing ? 'PROCESSING...' : 'CONFIRM MATCH'}</button>
                </div>
            </div>
        </div>
      )}

      {/* EDIT PO MODAL */}
      {editPOModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex justify-center items-center p-3 md:p-4 z-[60]">
            <div className="bg-white border-2 border-black max-w-xl w-full p-4 md:p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <h2 className="font-bold border-b-2 border-black pb-2 md:pb-3 mb-3 md:mb-4 uppercase text-lg">REVIEW & DISPATCH: {editPOModal.groupId}</h2>
              <div className="space-y-2 mb-4 md:mb-6 max-h-[60vh] overflow-y-auto pr-2">
                <div className="flex text-[11px] md:text-[13px] font-bold text-gray-500 px-2 uppercase"><span className="flex-1">ITEM DESCRIPTION</span><span className="w-16 text-center">REQ</span><span className="w-20 text-center">DISPATCH</span></div>
                {editPOModal.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-gray-100 border border-gray-300 p-2">
                    <span className="flex-1 min-w-0 text-[11px] md:text-[13px] font-bold truncate" title={item.item_desc}>{item.item_desc}</span>
                    <span className="text-[11px] md:text-[13px] font-bold text-gray-600 w-16 text-center whitespace-nowrap">{getDisplayQty(item.item_desc, item.req_qty, item.unit)}</span>
                    <input type="number" value={item.edit_qty} onChange={(e) => handleEditPOQty(idx, e.target.value)} className="w-16 md:w-20 text-[13px] md:text-sm p-1.5 border-2 border-black text-center font-bold focus:bg-yellow-50 focus:outline-none select-text" />
                  </div>
                ))}
              </div>
              <div className="flex space-x-2">
                <button onClick={() => { triggerHaptic(30); setEditPOModal(null); }} className="flex-1 border-2 border-black bg-gray-200 py-3 text-[13px] md:text-sm font-bold hover:bg-gray-300 transition-colors">CANCEL</button>
                <button onClick={confirmDispatchPO} disabled={isProcessing} className="flex-1 border-2 border-black bg-slate-800 text-white py-3 text-[13px] md:text-sm font-bold hover:bg-slate-900 uppercase transition-all disabled:opacity-50">{isProcessing ? 'GENERATING...' : 'GENERATE CHALLAN'}</button>
              </div>
            </div>
        </div>
      )}

      {/* PROCESS RETURN MODAL */}
      {processReturnModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex justify-center items-center p-3 md:p-4 z-[60]">
            <div className="bg-white border-2 border-black max-w-xl w-full p-4 md:p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <h2 className="text-lg font-bold border-b-2 border-black pb-2 md:pb-3 mb-3 md:mb-4 uppercase text-red-800">PROCESS DEPOT REQUEST: {processReturnModal.groupId}</h2>
              <div className="space-y-2 mb-4 md:mb-6 max-h-[60vh] overflow-y-auto pr-2">
                <div className="flex text-[11px] md:text-[13px] font-bold text-gray-500 px-2 uppercase"><span className="flex-1">ITEM DESCRIPTION</span><span className="w-16 text-center">REQ</span><span className="w-20 text-center">DISPATCH</span></div>
                {processReturnModal.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-red-50 border border-red-300 p-2">
                    <span className="flex-1 min-w-0 text-[11px] md:text-[13px] font-bold truncate" title={item.item_desc}>{item.item_desc}</span>
                    <span className="text-[11px] md:text-[13px] font-bold text-gray-600 w-16 text-center whitespace-nowrap">{getDisplayQty(item.item_desc, item.req_qty, item.unit)}</span>
                    <input type="number" value={item.edit_qty} onChange={(e) => handleProcessReturnQty(idx, e.target.value)} className="w-16 md:w-20 text-[11px] md:text-[13px] p-1.5 border-2 border-black text-center font-bold focus:bg-yellow-50 focus:outline-none select-text" />
                  </div>
                ))}
              </div>
              <div className="flex space-x-3">
                <button onClick={() => { triggerHaptic(30); setProcessReturnModal(null); }} className="flex-1 border-2 border-black bg-gray-200 py-3 text-[13px] md:text-sm font-bold hover:bg-gray-300 transition-colors">CANCEL</button>
                <button onClick={confirmProcessReturnRequest} disabled={isProcessing} className="flex-1 border-2 border-black bg-red-800 text-white py-3 text-[13px] md:text-sm font-bold hover:bg-red-900 transition-all disabled:opacity-50">{isProcessing ? 'GENERATING...' : 'GENERATE RETURN'}</button>
              </div>
            </div>
        </div>
      )}

      {/* --- RESPONSIVE MOBILE NAVBAR (FIXED) --- */}
      <nav className="bg-gray-800 text-white border-b-2 border-black p-3 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 w-full font-bold uppercase">
          
          <div className="flex items-center justify-between w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <span className="tracking-widest text-base">GOD</span>
              <button onClick={() => {
                  triggerHaptic(50);
                  if (emergencyUrl) window.open(emergencyUrl, '_blank');
                  else alert("Emergency URL not set. Ask Master to configure Settings.");
              }} className="ml-2 hover:scale-110 transition-transform text-lg cursor-pointer bg-transparent border-none p-0" title="Emergency Fallback Portal">🚨</button>
              {actionableCount > 0 && (
                <span className="relative flex h-3 w-3 -ml-1 -mt-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                </span>
              )}
              {!isOnline && <span className="ml-2 bg-red-600 text-white px-2 py-0.5 rounded text-[10px] font-black animate-pulse shadow-sm border border-red-800">OFFLINE</span>}
            </div>

            {(userRole === 'admin' || userRole === 'master') && (
                <button onClick={() => { triggerHaptic(20); setSettingsModal(true); }} className="text-gray-400 hover:text-white transition-colors text-xl sm:ml-4" title="System Settings">⚙️</button>
            )}
          </div>
          
          <div className="flex flex-row gap-2 items-center w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 hide-scrollbar whitespace-nowrap">
            {userRole && (
              <div className="p-1 flex flex-row gap-1 rounded bg-gray-700 flex-nowrap">
                {(userRole === 'admin' || userRole === 'master' || userRole === 'depot') && (
                  <button onClick={() => { triggerHaptic(30); setView('depot'); }} className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded shadow-sm transition-colors ${view === 'depot' ? 'bg-white text-black' : 'text-gray-300 hover:text-white'}`}>DEPOT</button>
                )}
                {(userRole === 'admin' || userRole === 'master' || userRole === 'retail') && (
                  <button onClick={() => { triggerHaptic(30); setView('retail'); }} className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded shadow-sm transition-colors ${view === 'retail' ? 'bg-white text-black' : 'text-gray-300 hover:text-white'}`}>RETAIL</button>
                )}
                <button onClick={() => { triggerHaptic(30); setView('ledger'); setLedgerLimit(50); }} className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded shadow-sm transition-colors ${view === 'ledger' ? 'bg-white text-black' : 'text-gray-300 hover:text-white'}`}>LEDGER</button>
              </div>
            )}
            <button onClick={() => { triggerHaptic([30,50]); supabase.auth.signOut(); }} className="bg-red-600 px-4 py-2.5 text-xs sm:text-sm font-bold border border-black rounded shadow-sm hover:bg-red-700 transition-colors ml-auto sm:ml-2">LOGOUT</button>
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
                      const key = String(row?.challan_no || row?.group_id || ''); 
                      if (!acc[key]) acc[key] = { ...row, items: [], keyValue: key, keyField: row.challan_no ? 'challan_no' : 'group_id' };
                      if (row.admin_note && !acc[key].admin_note) acc[key].admin_note = row.admin_note;
                      acc[key].items.push(row); return acc;
                    }, {})).length === 0 ? (
                      <tr><td colSpan={userRole === 'master' ? "8" : "7"} className="p-6 md:p-8 text-center text-gray-500 font-bold uppercase text-[13px] md:text-base">No records for {monthNames[ledgerMonth]} {ledgerYear}</td></tr>
                    ) : Object.values(ledgerData.reduce((acc, row) => {
                      const key = String(row?.challan_no || row?.group_id || ''); 
                      if (!acc[key]) acc[key] = { ...row, items: [], keyValue: key, keyField: row.challan_no ? 'challan_no' : 'group_id' };
                      if (row.admin_note && !acc[key].admin_note) acc[key].admin_note = row.admin_note;
                      acc[key].items.push(row); return acc;
                    }, {}))
                    .sort((a, b) => String(b.keyValue).localeCompare(String(a.keyValue))) 
                    .map((group, idx) => {
                      
                      const sortedItems = [...group.items].sort((a,b) => String(a?.item_desc || '').localeCompare(String(b?.item_desc || '')));
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
                            {visibleItems.map((i, k) => <li key={k} className={`font-bold border-b border-gray-200 last:border-0 pb-1 uppercase truncate max-w-[250px] md:max-w-[300px] xl:max-w-[400px] ${group.status === 'DELETED' ? 'line-through text-gray-500' : ''}`} title={i?.item_desc}><span className="w-1.5 h-1.5 bg-gray-400 inline-block rounded-full mr-1 md:mr-2 mb-0.5"></span>{i?.item_desc}</li>)}
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
                            {visibleItems.map((i, k) => <li key={k} className={`font-bold pb-1 ${group.status==='RETURN_ACCEPTED'?'text-red-600':''} ${group.status === 'DELETED' ? 'line-through text-gray-500' : ''}`}>{getDisplayQty(i?.item_desc, i.disp_qty || i.req_qty, i.unit)}</li>)}
                          </ul>
                        </td>
                        <td className="p-2 md:p-3 border-r border-gray-200 align-top select-none">
                          {group.status !== 'RETURN_ACCEPTED' ? (
                            <div className="flex flex-col gap-1.5 md:gap-2 min-w-[120px] md:min-w-[140px] max-w-[200px]">
                              {(userRole === 'admin' || userRole === 'master') ? (
                                openNoteId === group.keyValue ? (
                                  <div className="flex flex-col gap-1 md:gap-1.5 w-full mt-1">
                                    <textarea className="w-full border-2 border-black p-1.5 md:p-2 text-[11px] md:text-[13px] font-bold focus:outline-none focus:bg-yellow-50 resize-none whitespace-pre-wrap break-words select-text" rows="3" value={tempNoteText} onChange={(e) => setTempNoteText(e.target.value)} placeholder="Enter note..." autoFocus />
                                    <div className="flex gap-1 md:gap-1.5 mt-1">
                                      <button onClick={() => saveAdminNote(group.keyField, group.keyValue)} className="bg-blue-600 text-white px-1.5 md:px-2 py-1 md:py-1.5 text-[10px] md:text-[11px] font-bold uppercase flex-1 border-2 border-blue-800 active:translate-y-px">SAVE</button>
                                      <button onClick={() => setOpenNoteId(null)} className="bg-gray-200 text-gray-800 px-1.5 md:px-2 py-1 md:py-1.5 text-[10px] md:text-[11px] font-bold uppercase flex-1 border-2 border-gray-400 active:translate-y-px">CANCEL</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-start gap-1">
                                    <button onClick={() => { triggerHaptic(20); setOpenNoteId(group.keyValue); setTempNoteText(group.admin_note || ""); }} className="text-[10px] md:text-[11px] px-2 md:px-2.5 py-1 md:py-1.5 border border-gray-400 rounded shadow-sm font-bold uppercase bg-white hover:bg-gray-100 transition-colors">
                                      {group.admin_note ? 'EDIT NOTE' : '+ ADD NOTE'}
                                    </button>
                                    {group.admin_note && (<div className="text-[11px] md:text-[13px] font-bold text-gray-800 whitespace-pre-wrap break-words leading-tight mt-1 md:mt-1.5">{group.admin_note}</div>)}
                                  </div>
                                )
                              ) : (
                                <div className="flex flex-col items-start gap-1">
                                  {group.admin_note ? (<div className="text-[11px] md:text-[13px] font-bold text-gray-800 whitespace-pre-wrap break-words leading-tight mt-1 md:mt-1.5">{group.admin_note}</div>) : (<span className="text-gray-400 text-[11px] md:text-[13px] italic mt-1 md:mt-1.5">No Note</span>)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-center text-gray-400 text-[13px] md:text-sm">-</div>
                          )}
                        </td>
                        <td className="p-2 md:p-3 text-center vertical-middle select-none">
                          {group.challan_no && group.status !== 'DELETED' && isWithin30Days(group.timestamp) ? (
                            <button onClick={() => { triggerHaptic(30); const fullChallanItems = ledgerData.filter(i => i.challan_no === group.challan_no); printPDF(group.challan_no, fullChallanItems); }} className="text-[10px] md:text-[11px] font-bold bg-white border border-gray-400 text-gray-800 hover:bg-gray-100 px-2 md:px-2.5 py-1 md:py-1.5 rounded shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-y-px active:shadow-none transition-colors">PDF</button>
                          ) : group.challan_no ? (<span className="text-[10px] md:text-[11px] text-gray-400 font-bold">{group.status === 'DELETED' ? 'VOID' : 'LOCKED'}</span>) : (<span className="text-gray-300">-</span>)}
                        </td>
                        {userRole === 'master' && (
                          <td className="p-2 md:p-3 text-center vertical-middle select-none border-l border-gray-300">
                            <div className="flex justify-center gap-2 md:gap-3">
                               <button onClick={() => { triggerHaptic(20); setMasterEditModal({ keyField: group.keyField, keyValue: group.keyValue, newKeyValue: group.keyValue, items: sortedItems.map(i => ({ ...i, original_item_desc: i.item_desc, edit_qty: i.disp_qty || i.req_qty })) }); }} className="text-base md:text-lg hover:scale-110 active:scale-95 transition-transform" title="Edit Record">✏️</button>
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

            <div className="w-full md:w-1/2 flex flex-col gap-3 md:gap-4 order-2 md:order-2">
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

              {!hasDepotInbox && depotCart.length === 0 && (
                <div className="w-full border-2 border-dashed border-gray-400 bg-gray-50 text-gray-400 text-center p-8 font-black uppercase text-sm">NO PENDING INBOX TASKS</div>
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

        {view === 'retail' && (
          <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-start">
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

            <div className="w-full md:w-1/2 flex flex-col gap-3 md:gap-4 order-2 md:order-2">
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

              {!hasRetailInbox && retailCart.length === 0 && (
                <div className="w-full border-2 border-dashed border-gray-400 bg-gray-50 text-gray-400 text-center p-8 font-black uppercase text-sm">NO PENDING INBOX TASKS</div>
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
// ==========================================
  // --- PDF GENERATOR (PRE-PRINTED GRID) ---
  // ==========================================
  const printPDF = (challanNo, itemsList) => {
    const doc = new jsPDF({ format: 'a5' }); const isReturn = String(challanNo).startsWith('RT'); const txTimestamp = itemsList[0]?.timestamp ? new Date(itemsList[0].timestamp) : new Date(); let totalNos = 0;
    const drawPageHeaders = () => {
        doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.4);
        doc.setFillColor(235, 235, 235); doc.rect(5, 5, 138, 16, 'F'); doc.rect(5, 5, 138, 16, 'S'); 
        doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.text("GUJARAT OIL DEPOT", 74, 12, { align: "center" });
        doc.setFontSize(10); doc.text(isReturn ? "RETURN CHALLAN" : "DELIVERY CHALLAN", 74, 18, { align: "center" });
        doc.setDrawColor(0, 0, 0); doc.line(5, 21, 143, 21); 
        doc.setFontSize(9); doc.text(isReturn ? `RETURN NO :` : `CHALLAN NO :`, 8, 27); doc.setFont("helvetica", "normal"); doc.text(String(challanNo), 32, 27);
        doc.setFont("helvetica", "bold"); doc.text(`DATE :`, 104, 27); doc.setFont("helvetica", "normal"); doc.text(formatDate(txTimestamp), 116, 27);
        doc.setFont("helvetica", "bold"); doc.text(`BILLED TO :`, 8, 33); doc.setFont("helvetica", "normal"); doc.text(`SOUTH GUJARAT DISTRIBUTORS`, 28, 33); doc.text(`RETAIL STORE`, 28, 38);
        doc.setFillColor(245, 245, 245); doc.rect(5, 41, 138, 7, 'F'); doc.rect(5, 41, 138, 7, 'S'); 
        doc.setFont("helvetica", "bold"); doc.setFontSize(9);
        doc.text("SR", 10, 46, { align: "center" }); doc.text("ITEM DESCRIPTION", 17, 46, { align: "left" }); doc.text("NOS", 115, 46, { align: "center" }); doc.text("QTY", 134, 46, { align: "center" });
        doc.setFont("helvetica", "normal");
    };
    const drawPageGrid = (endY) => {
        doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.4);
        doc.line(5, 48, 5, endY); doc.line(143, 48, 143, endY); 
        doc.line(15, 48, 15, endY); doc.line(105, 48, 105, endY); doc.line(125, 48, 125, endY); doc.line(5, endY, 143, endY); 
    };
    const drawSignatures = (sigY) => {
        doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.text("Receiver's Signature / Stamp", 8, sigY);
        if (itemsList.length > 0 && (itemsList[0].status === 'ACCEPTED' || itemsList[0].status === 'RETURN_ACCEPTED')) {
          doc.setTextColor(0, 128, 0); doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.text("Digitally Verified", 8, sigY - 4); 
          doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.text(`Verified: ${formatDate(txTimestamp)} ${formatTime(txTimestamp)}`, 8, sigY + 2);
        }
        doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text("For GUJARAT OIL DEPOT", 140, sigY - 5, { align: "right" });
        doc.setTextColor(0, 51, 153); doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.text("Electronically Signed Document", 140, sigY, { align: "right" });
        doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "normal"); doc.setFontSize(6); doc.text(`Auth: ${formatDate(txTimestamp)} ${formatTime(txTimestamp)}`, 140, sigY + 3, { align: "right" });
    };

    drawPageHeaders(); let y = 53; const maxY = 165; 
    itemsList.forEach((item, index) => {
      const desc = String(item.description || item.item_desc || ''); const splitDesc = doc.splitTextToSize(desc, 85); 
      const rawQty = parseInt(item.disp_qty || item.req_qty) || 0; totalNos += rawQty;
      const displayStr = String(getDisplayQty(desc, rawQty, item.unit || getUnit(desc))); const paddedQty = String(rawQty).padStart(2, '0');
      const rowHeight = (splitDesc.length * 4) + 1;
      
      if (y + rowHeight > maxY) {
          drawPageGrid(maxY); drawSignatures(maxY + 15);
          doc.line(5, maxY, 5, maxY + 22); doc.line(143, maxY, 143, maxY + 22); doc.line(5, maxY + 22, 143, maxY + 22);
          doc.addPage(); drawPageHeaders(); y = 53;
      }
      doc.text(`${index + 1}`, 10, y, { align: "center" }); doc.text(splitDesc, 17, y); doc.setFont("helvetica", "bold"); doc.text(paddedQty, 115, y, { align: "center" }); doc.setFontSize(8); doc.text(displayStr, 134, y, { align: "center" }); doc.setFontSize(9); doc.setFont("helvetica", "normal");
      if (index < itemsList.length - 1 && y + rowHeight < maxY) { doc.setLineWidth(0.1); doc.setDrawColor(200, 200, 200); doc.line(5.2, y + rowHeight - 2, 142.8, y + rowHeight - 2); doc.setDrawColor(0, 0, 0); }
      y += rowHeight + 2; 
    });

    drawPageGrid(y);
    doc.setFillColor(235, 235, 235); doc.rect(5, y, 100, 7, 'F'); doc.rect(105, y, 38, 7, 'F'); doc.rect(5, y, 138, 7, 'S'); doc.line(105, y, 105, y + 7); 
    doc.setFont("helvetica", "bold"); doc.text("TOTAL", 100, y + 5, { align: "right" }); doc.text(String(totalNos).padStart(2, '0'), 115, y + 5, { align: "center" });
    const sigY = y + 20; drawSignatures(sigY);
    doc.line(5, y + 7, 5, sigY + 7); doc.line(143, y + 7, 143, sigY + 7); doc.line(5, sigY + 7, 143, sigY + 7);
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) { doc.setPage(i); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.text(`Page ${i} of ${totalPages}`, 140, 203, { align: "right" }); }
    doc.save(`${challanNo}.pdf`);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0]; if (!file) return; setUploadStatus('Processing...'); const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result); const workbook = XLSX.read(data, { type: 'array' }); let finalItemsToUpload = [];
        const normalizeRow = (row) => { const normalized = {}; for (let key in row) normalized[String(key).toLowerCase().trim()] = row[key]; return normalized; };
        ['SERVO', 'TVS'].forEach(sheetName => {
          const sheet = workbook.SheetNames.find(s => String(s).toUpperCase() === sheetName);
          if (sheet) {
            const formatted = XLSX.utils.sheet_to_json(workbook.Sheets[sheet]).map(row => { const norm = normalizeRow(row); return { description: cleanDesc(norm.description), ratio: parseFloat(norm.ratio) || 1, category: sheetName, sku: norm.sku || norm.code || norm.shortname || null }; }).filter(item => item.description);
            finalItemsToUpload = [...finalItemsToUpload, ...formatted];
          }
        });
        await supabase.from('master_items').delete().neq('description', 'dummy'); await supabase.from('master_items').insert(finalItemsToUpload); refreshAllData();
      } catch (error) { setUploadStatus(`Error`); }
    }; reader.readAsArrayBuffer(file); 
  };

  const downloadLedger = () => {
    if(ledgerData.length === 0) { alert(`No data to export.`); return; }
    const dispatchedDataObj = {}; const returnsDataObj = {};
    ledgerData.forEach(row => {
      const key = String(row.challan_no || row.group_id || 'UNKNOWN');
      if (row.status === 'RETURN_ACCEPTED') {
         if (!returnsDataObj['RETURNS']) returnsDataObj['RETURNS'] = { isReturnGroup: true, items: [], date: row.timestamp };
         returnsDataObj['RETURNS'].items.push(row);
      } else {
         if (!dispatchedDataObj[key]) dispatchedDataObj[key] = { date: row.timestamp, challan_no: row.challan_no, status: row.status, items: [], admin_note: row.admin_note };
         if (row.admin_note && !dispatchedDataObj[key].admin_note) dispatchedDataObj[key].admin_note = row.admin_note;
         dispatchedDataObj[key].items.push(row);
      }
    });

    const dispatchedGroups = Object.values(dispatchedDataObj).sort((a, b) => new Date(b.date) - new Date(a.date)); const returnGroups = Object.values(returnsDataObj); const itemSummary = {};
    ledgerData.forEach(row => {
      const desc = cleanDesc(row.item_desc); const q = parseInt(row.disp_qty || row.req_qty) || 0;
      if(!itemSummary[desc]) itemSummary[desc] = { qty: 0, unit: row.unit || getUnit(desc), category: getCategory(desc), rawItemDesc: row.item_desc };
      if (row.status !== 'DELETED') { if (row.status === 'RETURN_ACCEPTED') itemSummary[desc].qty -= q; else if (row.status === 'ACCEPTED' || row.status === 'DISPATCHED') itemSummary[desc].qty += q; }
    });

    const sumEntries = Object.entries(itemSummary).filter(([_, data]) => data.qty !== 0); const servoEntries = sumEntries.filter(([_, data]) => data.category === 'SERVO'); const tvsEntries = sumEntries.filter(([_, data]) => data.category === 'TVS');
    let htmlArray = []; htmlArray.push(`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"></head><body>`); htmlArray.push(`<table border="0" cellpadding="5" cellspacing="0" style="font-family:Arial,sans-serif;border-collapse:collapse;font-size:13px;"><colgroup><col width="130"/><col width="110"/><col width="380"/><col width="50"/><col width="130"/><col width="180"/><col width="30"/><col width="380"/><col width="80"/><col width="140"/></colgroup>`);
    const cell = (bg, col, align, wrap, fw, isNum, text, rspan=1, cspan=1) => { let st = `background-color:${bg};color:${col};border:1px solid black;padding:8px;vertical-align:middle;text-align:${align};font-weight:${fw};`; st += wrap ? `white-space:normal;word-wrap:break-word;mso-style-textwrap:yes;` : `white-space:nowrap;`; if (isNum) st += `mso-number-format:'\\@';`; return `<td rowspan="${rspan}" colspan="${cspan}" style="${st}">${text}</td>`; };

    let leftRows = [], rightRows = [];
    leftRows.push(cell('#d1d5db', '#000', 'left', false, 'bold', false, `GUJARAT OIL DEPOT - LEDGER`, 1, 6)); leftRows.push(cell('#f3f4f6', '#000', 'left', false, 'bold', false, `BILLED TO: SOUTH GUJARAT DISTRIBUTORS`, 1, 6));
    leftRows.push(cell('#e5e7eb', '#000', 'center', false, 'bold', false, 'DATE/TIME') + cell('#e5e7eb', '#000', 'center', false, 'bold', false, 'CHALLAN NO') + cell('#e5e7eb', '#000', 'left', false, 'bold', false, 'ITEM DESCRIPTION') + cell('#e5e7eb', '#000', 'center', false, 'bold', false, 'NOS') + cell('#e5e7eb', '#000', 'center', false, 'bold', false, 'QTY') + cell('#e5e7eb', '#000', 'center', false, 'bold', false, 'ADMIN NOTE'));

    let gTotal = 0;
    dispatchedGroups.forEach(g => {
        let bg = g.status === "DELETED" ? "#f3f4f6" : g.status === "ACCEPTED" ? "#dcfce7" : "#dbeafe"; let tc = g.status === "DELETED" ? "#9ca3af" : "#000"; let cText = g.status === "DELETED" ? `${g.challan_no||'-'} (DELETED)` : (g.challan_no||'-');
        g.items.forEach((r, i) => {
            let rq = parseInt(r.disp_qty || r.req_qty) || 0; if (g.status !== 'DELETED') gTotal += rq; let rowHtml = "";
            if (i === 0) { rowHtml += cell(bg, '#000', 'center', true, 'bold', true, `${formatDate(g.date)}<br style="mso-data-placement:same-cell;"/>${formatTime(g.date)}`, g.items.length); rowHtml += cell(bg, tc, 'center', false, 'bold', true, cText, g.items.length); }
            rowHtml += cell(bg, '#000', 'left', true, 'normal', false, cleanDesc(r.item_desc)); rowHtml += cell(bg, tc, 'center', false, 'bold', false, String(rq).padStart(2, '0')); rowHtml += cell(bg, tc, 'center', false, 'bold', false, String(getDisplayQty(r.item_desc, rq, r.unit||getUnit(r.item_desc))).toUpperCase());
            if (i === 0) rowHtml += cell(bg, '#000', 'left', true, 'normal', false, String(g.admin_note || ''), g.items.length); leftRows.push(rowHtml);
        });
    });
    leftRows.push(cell('#d1d5db', '#000', 'right', false, 'bold', false, 'GRAND TOTAL:', 1, 3) + cell('#d1d5db', '#000', 'center', false, 'bold', false, String(gTotal).padStart(2, '0')) + cell('#d1d5db', '#000', 'left', false, 'normal', false, '', 1, 2));

    rightRows.push(cell('#fde047', '#000', 'left', false, 'bold', false, `ITEM WISE SUMMARY`, 1, 3)); rightRows.push(cell('#fef08a', '#000', 'left', false, 'bold', false, `TOTAL SKUS: ${sumEntries.length}`, 1, 3)); rightRows.push(cell('#fef9c3', '#000', 'left', false, 'bold', false, 'ITEM DESCRIPTION') + cell('#fef9c3', '#000', 'center', false, 'bold', false, 'TOTAL NOS') + cell('#fef9c3', '#000', 'center', false, 'bold', false, 'CONVERTED QTY'));
    
    if (servoEntries.length > 0) {
        rightRows.push(cell('#fde047', '#1e3a8a', 'center', false, 'bold', false, 'SERVO LUBRICANTS', 1, 3)); let sTot = 0;
        servoEntries.forEach(([d, v]) => { sTot += v.qty; rightRows.push(cell('#fef9c3', '#000', 'left', true, 'normal', false, cleanDesc(v.rawItemDesc)) + cell('#fef9c3', '#000', 'center', false, 'bold', false, String(v.qty).padStart(2,'0')) + cell('#fef9c3', '#000', 'center', false, 'bold', false, String(getDisplayQty(d, v.qty, v.unit)).toUpperCase())); });
        rightRows.push(cell('#fef08a', '#000', 'right', false, 'bold', false, 'GROUP TOTAL:', 1, 2) + cell('#fef08a', '#000', 'center', false, 'bold', false, String(sTot).padStart(2, '0')));
    }
    if (tvsEntries.length > 0) {
        rightRows.push(cell('#fde047', '#1e3a8a', 'center', false, 'bold', false, 'TVS TYRES & TUBES', 1, 3)); let tTot = 0;
        tvsEntries.forEach(([d, v]) => { tTot += v.qty; rightRows.push(cell('#fef9c3', '#000', 'left', true, 'normal', false, cleanDesc(v.rawItemDesc)) + cell('#fef9c3', '#000', 'center', false, 'bold', false, String(v.qty).padStart(2,'0')) + cell('#fef9c3', '#000', 'center', false, 'bold', false, String(getDisplayQty(d, v.qty, v.unit)).toUpperCase())); });
        rightRows.push(cell('#fef08a', '#000', 'right', false, 'bold', false, 'GROUP TOTAL:', 1, 2) + cell('#fef08a', '#000', 'center', false, 'bold', false, String(tTot).padStart(2, '0')));
    }

    const maxRows = Math.max(leftRows.length, rightRows.length);
    for(let i=0; i<maxRows; i++) { htmlArray.push(`<tr style="height:35px;">`); htmlArray.push(leftRows[i] ? leftRows[i] : `<td colspan="6" style="border:none;"></td>`); htmlArray.push(`<td style="border:none;width:30px;"></td>`); htmlArray.push(rightRows[i] ? rightRows[i] : `<td colspan="3" style="border:none;"></td>`); htmlArray.push(`</tr>`); }
    htmlArray.push(`</table></body></html>`);
    const blob = new Blob([htmlArray.join('')], { type: "application/vnd.ms-excel" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `eChallan ${formatDate().replace(/\//g, '.')}.xls`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleItemSelect = (item, setItemState, setUnitState, setSearchState, setDropdownState, searchQueryStr, focusRef) => {
    setItemState(item); setSearchState(item.description); let newUnit = getUnit(item.description); setUnitState(newUnit);
    if (item.category === 'TVS') { try{const learnedUnits = JSON.parse(localStorage.getItem('god_tvs_units') || '{}'); learnedUnits[normalizeString(item.description)] = newUnit; localStorage.setItem('god_tvs_units', JSON.stringify(learnedUnits));}catch(e){} }
    setHighlightIndex(-1); if(setDropdownState) setDropdownState(false);
    if (searchQueryStr && String(searchQueryStr).length >= 2) { const sq = normalizeString(searchQueryStr); if (sq !== normalizeString(item.description) && (!item.sku || sq !== normalizeString(item.sku))) { try{const aliases = JSON.parse(localStorage.getItem('god_aliases') || '{}'); aliases[sq] = item.description; localStorage.setItem('god_aliases', JSON.stringify(aliases));}catch(e){} } }
    triggerHaptic(30); const isDesktop = window.innerWidth > 768; if (isDesktop) setTimeout(() => focusRef?.current?.focus(), 50);
  };

  const handleKeyDown = (e, itemsList, setSelected, setSearch, setDropdownOpen, setUnitState, listIdPrefix, focusRef, currentSelectedItem) => {
    if (e.key === 'Delete') { e.preventDefault(); triggerHaptic(30); setSelected(null); setSearch(''); setUnitState('NOS'); if (setDropdownOpen) setDropdownOpen(false); return; }
    if (e.key === 'Backspace' && currentSelectedItem) { e.preventDefault(); triggerHaptic(30); setSelected(null); setSearch(''); setUnitState('NOS'); if (setDropdownOpen) setDropdownOpen(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIndex(p => { const next = p < itemsList.length - 1 ? p + 1 : p; document.getElementById(`${listIdPrefix}-${next}`)?.scrollIntoView({ block: 'nearest' }); return next; }); } 
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIndex(p => { const next = p > 0 ? p - 1 : 0; document.getElementById(`${listIdPrefix}-${next}`)?.scrollIntoView({ block: 'nearest' }); return next; }); } 
    else if (e.key === 'Enter') { e.preventDefault(); if (highlightIndex >= 0 && itemsList[highlightIndex]) { handleItemSelect(itemsList[highlightIndex], setSelected, setUnitState, setSearch, setDropdownOpen, e.target.value, focusRef); } } 
    else if (e.key === 'Tab' || e.key === 'Escape') { if (setDropdownOpen) setDropdownOpen(false); }
  };

  const toggleGroupExpand = (groupId) => { setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] })); };

  // --- ACTIONS (RETAIL) ---
  const retailFilteredItems = smartSearch(retailSearch);
  const addToRetailCart = (e) => {
    if (e) e.preventDefault(); if (!retailSelectedItem || !retailQty || parseInt(retailQty) === 0) return; triggerHaptic(40);
    let finalQty = parseInt(retailQty); if (finalQty < 0) { setRetailMode('RETURN'); finalQty = Math.abs(finalQty); }
    setRetailCart([...retailCart, { ...retailSelectedItem, req_qty: finalQty, unit: retailSelectedUnit }]); setRetailSearch(''); setRetailQty(''); setRetailSelectedItem(null); const isDesktop = window.innerWidth > 768; if (isDesktop) setTimeout(() => retailSearchRef.current?.focus(), 50); 
  };
  const updateRetailCartQty = (index, val) => { const updated = [...retailCart]; updated[index] = { ...updated[index], req_qty: val }; setRetailCart(updated); };
  const removeRetailCartItem = (index) => setRetailCart(retailCart.filter((_, i) => i !== index));

  const submitRetailAction = async (e) => {
    if (e) e.preventDefault(); if (retailCart.length === 0 || isProcessing) return; triggerHaptic([40, 40, 100]); setIsProcessing(true);
    try {
        const isReturn = retailMode === 'RETURN'; const groupId = await getNextSequence(isReturn ? 'RT' : 'PO');
        const tx = retailCart.map(item => ({ group_id: groupId, item_desc: item.description, req_qty: parseInt(item.req_qty), unit: item.unit, status: isReturn ? 'RETURN_INITIATED' : 'PO_PLACED', challan_no: isReturn ? groupId : null, note: isReturn ? (retailReturnNote || null) : null }));
        await executeTransaction(tx, `${isReturn ? 'Return' : 'P.O.'} Submitted`, `Group ID: ${groupId}`, () => { setRetailCart([]); setRetailReturnNote(''); });
    } catch(err) { triggerSystemAlert("Error", err.message, "error"); } finally { setIsProcessing(false); }
  };

  // --- ACTIONS (DEPOT) ---
  const depotFilteredItems = smartSearch(searchQuery);
  const addToDepotCart = (e) => {
    if (e) e.preventDefault(); if (!selectedItem || !qty || parseInt(qty) === 0) return; triggerHaptic(40);
    let finalQty = parseInt(qty); if (finalQty < 0) { setDepotMode('RETURN_REQUEST'); finalQty = Math.abs(finalQty); }
    setDepotCart([...depotCart, { ...selectedItem, disp_qty: finalQty, unit: selectedUnit }]); setSearchQuery(''); setQty(''); setSelectedItem(null); const isDesktop = window.innerWidth > 768; if (isDesktop) setTimeout(() => depotSearchRef.current?.focus(), 50); 
  };
  const updateDepotCartQty = (index, val) => { const updated = [...depotCart]; updated[index] = { ...updated[index], disp_qty: val }; setDepotCart(updated); };
  const removeDepotCartItem = (index) => setDepotCart(depotCart.filter((_, i) => i !== index));

  const submitDepotAction = async (e) => {
    e.preventDefault(); if (depotCart.length === 0 || isProcessing) return; triggerHaptic([40, 40, 100]); setIsProcessing(true);
    try {
        if (depotMode === 'DISPATCH') {
          const challanNo = await getNextSequence('CN'); const groupId = getOfflineSequence('M');
          const tx = depotCart.map(item => ({ group_id: groupId, challan_no: challanNo, item_desc: item.description, disp_qty: parseInt(item.disp_qty), unit: item.unit, status: 'DISPATCHED' }));
          await executeTransaction(tx, "Challan Issued", `Challan: ${challanNo}`, () => { printPDF(challanNo, depotCart); setDepotCart([]); });
        } else {
          const groupId = await getNextSequence('RR');
          const tx = depotCart.map(item => ({ group_id: groupId, item_desc: item.description, req_qty: parseInt(item.disp_qty), unit: item.unit, status: 'RETURN_REQUESTED', note: depotReturnNote || null }));
          await executeTransaction(tx, "Return Request Submitted", `Group ID: ${groupId}`, () => { setDepotCart([]); setDepotReturnNote(''); });
        }
    } catch(err) { triggerSystemAlert("Error", err.message, "error"); } finally { setIsProcessing(false); }
  };

  // --- ACTIONS (MODALS & AWAIT LOOPS) ---
  const openVerifyModal = (challanNo, items) => {
    triggerHaptic(30); const checks = {}; items.forEach((_, i) => checks[i] = false);
    const sortedItems = [...items].sort((a,b) => String(a.item_desc || '').localeCompare(String(b.item_desc || '')));
    setVerifyModal({ challanNo, items: sortedItems.map(i => ({ ...i, edit_qty: i.disp_qty || i.req_qty })), checks, isDepotReturn: challanNo ? String(challanNo).startsWith('RT') : false });
  };
  const toggleVerifyCheck = (index) => { triggerHaptic(20); setVerifyModal(prev => ({ ...prev, checks: { ...prev.checks, [index]: !prev.checks[index] } })); };

  // FIX: .some() to prevent lockups on verification
  const acceptDelivery = async () => {
    if (!isOnline) { triggerSystemAlert("Error", "Internet required.", "error"); return; }
    if (!verifyModal || isProcessing) return; 
    const checkedIndexes = Object.keys(verifyModal.checks).filter(k => verifyModal.checks[k]);
    if (checkedIndexes.length === 0) { triggerSystemAlert("Action Required", "Please check off at least one item.", "warning"); return; }
    triggerHaptic([40, 40, 100]); setIsProcessing(true);
    try {
        const newStatus = verifyModal.isDepotReturn ? 'RETURN_ACCEPTED' : 'ACCEPTED';
        for (let i = 0; i < checkedIndexes.length; i++) {
            const index = checkedIndexes[i]; const item = verifyModal.items[index]; const finalQty = parseInt(item.edit_qty) || 0;
            await supabase.from('transactions').update({ status: newStatus, disp_qty: finalQty, req_qty: finalQty }).eq('id', item.id);
        }
        setVerifyModal(null); refreshAllData(); triggerSystemAlert("Accepted", `Items from ${verifyModal.challanNo} verified.`, "success");
    } catch (err) { triggerSystemAlert("Error", err.message, "error"); } finally { setIsProcessing(false); }
  };

  const openEditPOModal = (groupId, items) => { triggerHaptic(30); const sortedItems = [...items].sort((a,b) => String(a.item_desc || '').localeCompare(String(b.item_desc || ''))); setEditPOModal({ groupId, items: sortedItems.map(i => ({ ...i, edit_qty: i.req_qty })) }); };
  const handleEditPOQty = (index, val) => { const updated = [...editPOModal.items]; updated[index] = { ...updated[index], edit_qty: val }; setEditPOModal({ ...editPOModal, items: updated }); };
  
  const confirmDispatchPO = async () => {
    if (!isOnline) { triggerSystemAlert("Error", "Internet required.", "error"); return; }
    if (!editPOModal || isProcessing) return; triggerHaptic([40, 40, 100]); setIsProcessing(true);
    try {
        const challanNo = await getNextSequence('CN'); const backorders = []; const printItems = []; let newPO = null;
        for (const item of editPOModal.items) {
          const dispatchQty = parseInt(item.edit_qty) || 0; const reqQty = parseInt(item.req_qty) || 0;
          if (dispatchQty <= 0) { await supabase.from('transactions').delete().eq('id', item.id); continue; }
          await supabase.from('transactions').update({ status: 'DISPATCHED', challan_no: challanNo, disp_qty: dispatchQty }).eq('id', item.id); 
          printItems.push({ ...item, disp_qty: dispatchQty }); 
          if (dispatchQty < reqQty) { 
              if (!newPO) newPO = await getNextSequence('PO');
              backorders.push({ group_id: newPO, item_desc: item.item_desc, req_qty: reqQty - dispatchQty, unit: item.unit, status: 'PO_PLACED' }); 
          }
        }
        if (backorders.length > 0) await supabase.from('transactions').insert(backorders);
        if (printItems.length > 0) printPDF(challanNo, printItems);
        setEditPOModal(null); refreshAllData(); triggerSystemAlert("Success", `Challan ${challanNo} Dispatched.`, "success");
    } catch(err) { triggerSystemAlert("Error", err.message, "error"); } finally { setIsProcessing(false); }
  };

  const openProcessReturnModal = (groupId, items) => { triggerHaptic(30); const sortedItems = [...items].sort((a,b) => String(a.item_desc || '').localeCompare(String(b.item_desc || ''))); setProcessReturnModal({ groupId, items: sortedItems.map(i => ({ ...i, edit_qty: i.req_qty })) }); };
  const handleProcessReturnQty = (index, val) => { const updated = [...processReturnModal.items]; updated[index] = { ...updated[index], edit_qty: val }; setProcessReturnModal({ ...processReturnModal, items: updated }); };

  const confirmProcessReturnRequest = async () => {
    if (!isOnline) { triggerSystemAlert("Error", "Internet required.", "error"); return; }
    if (!processReturnModal || isProcessing) return; triggerHaptic([40, 40, 100]); setIsProcessing(true);
    try {
        const challanNo = await getNextSequence('RT'); const backorders = []; const printItems = []; let newRR = null;
        for (const item of processReturnModal.items) {
          const dispatchQty = parseInt(item.edit_qty) || 0; const reqQty = parseInt(item.req_qty) || 0;
          if (dispatchQty <= 0) { await supabase.from('transactions').delete().eq('id', item.id); continue; }
          await supabase.from('transactions').update({ status: 'RETURN_INITIATED', challan_no: challanNo, disp_qty: dispatchQty }).eq('id', item.id); 
          printItems.push({ ...item, disp_qty: dispatchQty }); 
          if (dispatchQty < reqQty) { 
              if (!newRR) newRR = await getNextSequence('RR');
              backorders.push({ group_id: newRR, item_desc: item.item_desc, req_qty: reqQty - dispatchQty, unit: item.unit, status: 'RETURN_REQUESTED' }); 
          }
        }
        if (backorders.length > 0) await supabase.from('transactions').insert(backorders);
        if (printItems.length > 0) printPDF(challanNo, printItems);
        setProcessReturnModal(null); refreshAllData(); triggerSystemAlert("Success", `Return ${challanNo} Generated.`, "success");
    } catch(err) { triggerSystemAlert("Error", err.message, "error"); } finally { setIsProcessing(false); }
  };

  if (loadingAuth) return (
    <div className="min-h-screen bg-gray-200 flex items-center justify-center font-sans select-none">
      <div className="bg-white p-6 md:p-8 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-center">
          <div className="text-gray-800 font-black tracking-widest uppercase text-lg">INITIALIZING SYSTEM...</div>
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
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-2 border-black font-bold uppercase text-sm animate-slide-in flex items-center gap-3 w-72 bg-white text-black`}>
            <span className="text-xl">{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : '⚠️'}</span>
            <div><div className="text-[11px] text-gray-500 tracking-wider mb-0.5">{toast.title}</div><div className="leading-tight">{toast.body}</div></div>
          </div>
        ))}
      </div>
      <style dangerouslySetInnerHTML={{__html: `@keyframes slide-in { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } } .animate-slide-in { animation: slide-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; } .hide-scrollbar::-webkit-scrollbar { display: none; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}} />

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

      {deleteModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex justify-center items-center p-3 md:p-4 z-[60]">
            <div className="bg-white border-2 border-black max-w-md w-full p-4 md:p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <h2 className="text-lg font-black border-b-2 border-black pb-2 mb-4 uppercase text-red-800">DELETE RECORD: {deleteModal.keyValue}</h2>
                <p className="text-[13px] md:text-sm font-bold text-gray-700 mb-6">How would you like to remove this record?</p>
                <div className="flex flex-col gap-3">
                    <button onClick={() => executeDelete('SOFT')} disabled={isProcessing} className="w-full bg-gray-200 border-2 border-black p-3 text-left hover:bg-gray-300 transition-colors disabled:opacity-50">
                        <span className="block text-black font-black text-sm">1. VOID (Soft Delete)</span>
                        <span className="block text-[11px] md:text-xs font-bold text-gray-600 mt-1 uppercase">Zeroes quantities but keeps the sequence number in the ledger for auditing transparency.</span>
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

      {/* --- FIX: RESPONSIVE MASTER EDIT MODAL --- */}
      {masterEditModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex justify-center items-center p-3 md:p-4 z-[60]">
            <div className="bg-white border-2 border-black max-w-xl w-full p-4 md:p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <h2 className="font-bold border-b-2 border-black pb-2 md:pb-3 mb-3 md:mb-4 uppercase text-lg">EDIT RECORD: {masterEditModal.keyValue}</h2>
              <div className="space-y-3 mb-4 md:mb-6 max-h-[60vh] overflow-y-auto pr-2">
                <div className="hidden sm:flex text-[11px] md:text-[13px] font-bold text-gray-500 px-2 uppercase"><span className="flex-1">ITEM DESCRIPTION</span><span className="w-24 text-center">EDIT QTY</span></div>
                {masterEditModal.items.map((item, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-2 bg-gray-100 border border-gray-300 p-3 rounded">
                    <input type="text" list="masterItemsList" value={item.item_desc} onChange={(e) => {
                        const updated = [...masterEditModal.items]; updated[idx] = { ...updated[idx], item_desc: e.target.value }; setMasterEditModal({...masterEditModal, items: updated});
                    }} className="w-full sm:flex-1 text-[13px] md:text-sm p-2 border-2 border-black font-bold focus:bg-yellow-50 focus:outline-none select-text uppercase" />
                    <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto mt-1 sm:mt-0">
                       <span className="text-[11px] font-bold text-gray-500 uppercase sm:hidden">Quantity:</span>
                       <input type="number" value={item.edit_qty} onChange={(e) => {
                          const updated = [...masterEditModal.items]; updated[idx] = { ...updated[idx], edit_qty: e.target.value }; setMasterEditModal({...masterEditModal, items: updated});
                       }} className="w-24 text-[13px] md:text-sm p-2 border-2 border-black text-center font-bold focus:bg-yellow-50 focus:outline-none select-text" />
                    </div>
                  </div>
                ))}
                <datalist id="masterItemsList">{masterItems.map((m, i) => <option key={i} value={m.description} />)}</datalist>
              </div>
              <div className="flex space-x-2">
                <button onClick={() => { triggerHaptic(30); setMasterEditModal(null); }} className="flex-1 border-2 border-black bg-gray-200 py-3 text-[13px] md:text-sm font-bold hover:bg-gray-300 transition-colors text-black">CANCEL</button>
                <button onClick={confirmMasterEdit} disabled={isProcessing} className="flex-1 border-2 border-black bg-blue-800 text-white py-3 text-[13px] md:text-sm font-bold hover:bg-blue-900 uppercase transition-all disabled:opacity-50">{isProcessing ? 'SAVING...' : 'SAVE CHANGES'}</button>
              </div>
            </div>
        </div>
      )}

      {verifyModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex justify-center items-center p-3 md:p-4 z-[60]">
            <div className="bg-white border-2 border-black max-w-lg w-full p-4 md:p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <h2 className="text-lg font-bold border-b-2 border-black pb-2 mb-4 uppercase text-blue-800">VERIFY GOODS: {verifyModal.challanNo}</h2>
                <div className="space-y-2 mb-4 max-h-[60vh] overflow-y-auto pr-2">
                  <div className="flex text-[11px] font-bold text-gray-500 px-2 uppercase"><span className="w-8 text-center">CHK</span><span className="flex-1">ITEM DESCRIPTION</span><span className="w-20 md:w-24 text-center">RCVD QTY</span></div>
                  {verifyModal.items.map((item, idx) => (
                    <label key={idx} className={`flex items-center space-x-2 md:space-x-3 p-2 border-2 cursor-pointer transition-colors ${verifyModal.checks[idx] ? 'bg-blue-50 border-blue-500' : 'bg-gray-50 border-gray-300 hover:bg-gray-100'}`}>
                      <div className="w-8 flex justify-center"><input type="checkbox" checked={verifyModal.checks[idx]} onChange={() => toggleVerifyCheck(idx)} className="w-6 h-6 cursor-pointer accent-blue-600" /></div>
                      <span className="flex-1 text-[13px] md:text-sm font-bold text-gray-800 truncate" title={item.item_desc}>{item.item_desc}</span>
                      <input type="number" value={item.edit_qty} onClick={(e) => e.stopPropagation()} onChange={(e) => {
                              const updated = [...verifyModal.items]; updated[idx] = { ...updated[idx], edit_qty: e.target.value }; setVerifyModal({ ...verifyModal, items: updated });
                          }} className="w-20 md:w-24 text-[13px] md:text-sm p-1.5 border-2 border-black text-center font-bold focus:bg-yellow-50 focus:outline-none" />
                    </label>
                  ))}
                </div>
                <div className="flex space-x-3">
                  <button onClick={() => { triggerHaptic(30); setVerifyModal(null); }} className="flex-1 border-2 border-black bg-gray-200 py-3 text-[13px] md:text-sm font-bold hover:bg-gray-300 text-black">CANCEL</button>
                  <button onClick={acceptDelivery} disabled={!Object.values(verifyModal.checks).some(Boolean) || isProcessing} className="flex-1 border-2 border-black bg-blue-700 text-white py-3 text-[13px] md:text-sm font-bold hover:bg-blue-800 disabled:opacity-50 transition-all">{isProcessing ? 'PROCESSING...' : 'CONFIRM MATCH'}</button>
                </div>
            </div>
        </div>
      )}

      {editPOModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex justify-center items-center p-3 md:p-4 z-[60]">
            <div className="bg-white border-2 border-black max-w-xl w-full p-4 md:p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <h2 className="font-bold border-b-2 border-black pb-2 md:pb-3 mb-3 md:mb-4 uppercase text-lg">REVIEW & DISPATCH: {editPOModal.groupId}</h2>
              <div className="space-y-2 mb-4 md:mb-6 max-h-[60vh] overflow-y-auto pr-2">
                <div className="flex text-[11px] md:text-[13px] font-bold text-gray-500 px-2 uppercase"><span className="flex-1">ITEM DESCRIPTION</span><span className="w-16 text-center">REQ</span><span className="w-20 text-center">DISPATCH</span></div>
                {editPOModal.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-gray-100 border border-gray-300 p-2">
                    <span className="flex-1 min-w-0 text-[11px] md:text-[13px] font-bold truncate" title={item.item_desc}>{item.item_desc}</span>
                    <span className="text-[11px] md:text-[13px] font-bold text-gray-600 w-16 text-center whitespace-nowrap">{getDisplayQty(item.item_desc, item.req_qty, item.unit)}</span>
                    <input type="number" value={item.edit_qty} onChange={(e) => handleEditPOQty(idx, e.target.value)} className="w-16 md:w-20 text-[13px] md:text-sm p-1.5 border-2 border-black text-center font-bold focus:bg-yellow-50 focus:outline-none select-text" />
                  </div>
                ))}
              </div>
              <div className="flex space-x-2">
                <button onClick={() => { triggerHaptic(30); setEditPOModal(null); }} className="flex-1 border-2 border-black bg-gray-200 py-3 text-[13px] md:text-sm font-bold hover:bg-gray-300 transition-colors">CANCEL</button>
                <button onClick={confirmDispatchPO} disabled={isProcessing} className="flex-1 border-2 border-black bg-slate-800 text-white py-3 text-[13px] md:text-sm font-bold hover:bg-slate-900 uppercase transition-all disabled:opacity-50">{isProcessing ? 'GENERATING...' : 'GENERATE CHALLAN'}</button>
              </div>
            </div>
        </div>
      )}

      {processReturnModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex justify-center items-center p-3 md:p-4 z-[60]">
            <div className="bg-white border-2 border-black max-w-xl w-full p-4 md:p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <h2 className="text-lg font-bold border-b-2 border-black pb-2 md:pb-3 mb-3 md:mb-4 uppercase text-red-800">PROCESS DEPOT REQUEST: {processReturnModal.groupId}</h2>
              <div className="space-y-2 mb-4 md:mb-6 max-h-[60vh] overflow-y-auto pr-2">
                <div className="flex text-[11px] md:text-[13px] font-bold text-gray-500 px-2 uppercase"><span className="flex-1">ITEM DESCRIPTION</span><span className="w-16 text-center">REQ</span><span className="w-20 text-center">DISPATCH</span></div>
                {processReturnModal.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-red-50 border border-red-300 p-2">
                    <span className="flex-1 min-w-0 text-[11px] md:text-[13px] font-bold truncate" title={item.item_desc}>{item.item_desc}</span>
                    <span className="text-[11px] md:text-[13px] font-bold text-gray-600 w-16 text-center whitespace-nowrap">{getDisplayQty(item.item_desc, item.req_qty, item.unit)}</span>
                    <input type="number" value={item.edit_qty} onChange={(e) => handleProcessReturnQty(idx, e.target.value)} className="w-16 md:w-20 text-[13px] md:text-sm p-1.5 border-2 border-black text-center font-bold focus:bg-yellow-50 focus:outline-none select-text" />
                  </div>
                ))}
              </div>
              <div className="flex space-x-3">
                <button onClick={() => { triggerHaptic(30); setProcessReturnModal(null); }} className="flex-1 border-2 border-black bg-gray-200 py-3 text-[13px] md:text-sm font-bold hover:bg-gray-300 transition-colors">CANCEL</button>
                <button onClick={confirmProcessReturnRequest} disabled={isProcessing} className="flex-1 border-2 border-black bg-red-800 text-white py-3 text-[13px] md:text-sm font-bold hover:bg-red-900 transition-all disabled:opacity-50">{isProcessing ? 'GENERATING...' : 'GENERATE RETURN'}</button>
              </div>
            </div>
        </div>
      )}

      {/* --- FIX: RESPONSIVE MOBILE NAVBAR (SINGLE LINE) --- */}
      <nav className="bg-gray-800 text-white border-b-2 border-black p-3 sticky top-0 z-50 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2 flex-shrink-0">
            <span className="tracking-widest hidden sm:inline font-bold">GUJARAT OIL DEPOT</span>
            <span className="tracking-widest sm:hidden font-bold text-lg">GOD</span>
            <button onClick={() => {
                triggerHaptic(50);
                if (emergencyUrl) window.open(emergencyUrl, '_blank');
                else alert("Emergency URL not set. Ask Master to configure Settings.");
            }} className="hover:scale-110 transition-transform text-lg cursor-pointer bg-transparent border-none p-0" title="Emergency Fallback Portal">🚨</button>
            {actionableCount > 0 && (
              <span className="relative flex h-3 w-3 -ml-1 -mt-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
              </span>
            )}
            {!isOnline && <span className="ml-2 bg-red-600 text-white px-2 py-0.5 rounded text-[10px] font-black animate-pulse shadow-sm border border-red-800">OFFLINE</span>}
            {(userRole === 'admin' || userRole === 'master') && (
                <button onClick={() => { triggerHaptic(20); setSettingsModal(true); }} className="text-gray-400 hover:text-white transition-colors text-xl sm:ml-4" title="System Settings">⚙️</button>
            )}
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pl-2 flex-nowrap">
            {userRole && (
              <div className="p-1 flex flex-row gap-1 rounded bg-gray-700 flex-nowrap flex-shrink-0">
                {(userRole === 'admin' || userRole === 'master' || userRole === 'depot') && (
                  <button onClick={() => { triggerHaptic(30); setView('depot'); }} className={`px-4 py-2 text-xs sm:text-sm font-bold rounded shadow-sm transition-colors whitespace-nowrap ${view === 'depot' ? 'bg-white text-black' : 'text-gray-300 hover:text-white'}`}>DEPOT</button>
                )}
                {(userRole === 'admin' || userRole === 'master' || userRole === 'retail') && (
                  <button onClick={() => { triggerHaptic(30); setView('retail'); }} className={`px-4 py-2 text-xs sm:text-sm font-bold rounded shadow-sm transition-colors whitespace-nowrap ${view === 'retail' ? 'bg-white text-black' : 'text-gray-300 hover:text-white'}`}>RETAIL</button>
                )}
                <button onClick={() => { triggerHaptic(30); setView('ledger'); setLedgerLimit(50); }} className={`px-4 py-2 text-xs sm:text-sm font-bold rounded shadow-sm transition-colors whitespace-nowrap ${view === 'ledger' ? 'bg-white text-black' : 'text-gray-300 hover:text-white'}`}>LEDGER</button>
              </div>
            )}
            <button onClick={() => { triggerHaptic([30,50]); supabase.auth.signOut(); }} className="bg-red-600 px-4 py-2 text-xs sm:text-sm font-bold border border-black rounded shadow-sm hover:bg-red-700 transition-colors flex-shrink-0">LOGOUT</button>
        </div>
      </nav>

      <main className="container mx-auto p-3 md:p-4">
        
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
                      const key = String(row?.challan_no || row?.group_id || ''); 
                      if (!acc[key]) acc[key] = { ...row, items: [], keyValue: key, keyField: row.challan_no ? 'challan_no' : 'group_id' };
                      if (row.admin_note && !acc[key].admin_note) acc[key].admin_note = row.admin_note;
                      acc[key].items.push(row); return acc;
                    }, {})).length === 0 ? (
                      <tr><td colSpan={userRole === 'master' ? "8" : "7"} className="p-6 md:p-8 text-center text-gray-500 font-bold uppercase text-[13px] md:text-base">No records for {monthNames[ledgerMonth]} {ledgerYear}</td></tr>
                    ) : Object.values(ledgerData.reduce((acc, row) => {
                      const key = String(row?.challan_no || row?.group_id || ''); 
                      if (!acc[key]) acc[key] = { ...row, items: [], keyValue: key, keyField: row.challan_no ? 'challan_no' : 'group_id' };
                      if (row.admin_note && !acc[key].admin_note) acc[key].admin_note = row.admin_note;
                      acc[key].items.push(row); return acc;
                    }, {}))
                    .sort((a, b) => String(b.keyValue).localeCompare(String(a.keyValue))) 
                    .map((group, idx) => {
                      const sortedItems = [...group.items].sort((a,b) => String(a?.item_desc || '').localeCompare(String(b?.item_desc || '')));
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
                            {visibleItems.map((i, k) => <li key={k} className={`font-bold border-b border-gray-200 last:border-0 pb-1 uppercase truncate max-w-[250px] md:max-w-[300px] xl:max-w-[400px] ${group.status === 'DELETED' ? 'line-through text-gray-500' : ''}`} title={i?.item_desc}><span className="w-1.5 h-1.5 bg-gray-400 inline-block rounded-full mr-1 md:mr-2 mb-0.5"></span>{i?.item_desc}</li>)}
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
                            {visibleItems.map((i, k) => <li key={k} className={`font-bold pb-1 ${group.status==='RETURN_ACCEPTED'?'text-red-600':''} ${group.status === 'DELETED' ? 'line-through text-gray-500' : ''}`}>{getDisplayQty(i?.item_desc, i.disp_qty || i.req_qty, i.unit)}</li>)}
                          </ul>
                        </td>
                        <td className="p-2 md:p-3 border-r border-gray-200 align-top select-none">
                          {group.status !== 'RETURN_ACCEPTED' ? (
                            <div className="flex flex-col gap-1.5 md:gap-2 min-w-[120px] md:min-w-[140px] max-w-[200px]">
                              {(userRole === 'admin' || userRole === 'master') ? (
                                openNoteId === group.keyValue ? (
                                  <div className="flex flex-col gap-1 md:gap-1.5 w-full mt-1">
                                    <textarea className="w-full border-2 border-black p-1.5 md:p-2 text-[11px] md:text-[13px] font-bold focus:outline-none focus:bg-yellow-50 resize-none whitespace-pre-wrap break-words select-text" rows="3" value={tempNoteText} onChange={(e) => setTempNoteText(e.target.value)} placeholder="Enter note..." autoFocus />
                                    <div className="flex gap-1 md:gap-1.5 mt-1">
                                      <button onClick={() => saveAdminNote(group.keyField, group.keyValue)} className="bg-blue-600 text-white px-1.5 md:px-2 py-1 md:py-1.5 text-[10px] md:text-[11px] font-bold uppercase flex-1 border-2 border-blue-800 active:translate-y-px">SAVE</button>
                                      <button onClick={() => setOpenNoteId(null)} className="bg-gray-200 text-gray-800 px-1.5 md:px-2 py-1 md:py-1.5 text-[10px] md:text-[11px] font-bold uppercase flex-1 border-2 border-gray-400 active:translate-y-px">CANCEL</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-start gap-1">
                                    <button onClick={() => { triggerHaptic(20); setOpenNoteId(group.keyValue); setTempNoteText(group.admin_note || ""); }} className="text-[10px] md:text-[11px] px-2 md:px-2.5 py-1 md:py-1.5 border border-gray-400 rounded shadow-sm font-bold uppercase bg-white hover:bg-gray-100 transition-colors">
                                      {group.admin_note ? 'EDIT NOTE' : '+ ADD NOTE'}
                                    </button>
                                    {group.admin_note && (<div className="text-[11px] md:text-[13px] font-bold text-gray-800 whitespace-pre-wrap break-words leading-tight mt-1 md:mt-1.5">{group.admin_note}</div>)}
                                  </div>
                                )
                              ) : (
                                <div className="flex flex-col items-start gap-1">
                                  {group.admin_note ? (<div className="text-[11px] md:text-[13px] font-bold text-gray-800 whitespace-pre-wrap break-words leading-tight mt-1 md:mt-1.5">{group.admin_note}</div>) : (<span className="text-gray-400 text-[11px] md:text-[13px] italic mt-1 md:mt-1.5">No Note</span>)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-center text-gray-400 text-[13px] md:text-sm">-</div>
                          )}
                        </td>
                        <td className="p-2 md:p-3 text-center vertical-middle select-none">
                          {group.challan_no && group.status !== 'DELETED' && isWithin30Days(group.timestamp) ? (
                            <button onClick={() => { triggerHaptic(30); const fullChallanItems = ledgerData.filter(i => i.challan_no === group.challan_no); printPDF(group.challan_no, fullChallanItems); }} className="text-[10px] md:text-[11px] font-bold bg-white border border-gray-400 text-gray-800 hover:bg-gray-100 px-2 md:px-2.5 py-1 md:py-1.5 rounded shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-y-px active:shadow-none transition-colors">PDF</button>
                          ) : group.challan_no ? (<span className="text-[10px] md:text-[11px] text-gray-400 font-bold">{group.status === 'DELETED' ? 'VOID' : 'LOCKED'}</span>) : (<span className="text-gray-300">-</span>)}
                        </td>
                        {userRole === 'master' && (
                          <td className="p-2 md:p-3 text-center vertical-middle select-none border-l border-gray-300">
                            <div className="flex justify-center gap-2 md:gap-3">
                               <button onClick={() => { triggerHaptic(20); setMasterEditModal({ keyField: group.keyField, keyValue: group.keyValue, newKeyValue: group.keyValue, items: sortedItems.map(i => ({ ...i, original_item_desc: i.item_desc, edit_qty: i.disp_qty || i.req_qty })) }); }} className="text-base md:text-lg hover:scale-110 active:scale-95 transition-transform" title="Edit Record">✏️</button>
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

            <div className="w-full md:w-1/2 flex flex-col gap-3 md:gap-4 order-2 md:order-2">
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

              {!hasDepotInbox && depotCart.length === 0 && (
                <div className="w-full border-2 border-dashed border-gray-400 bg-gray-50 text-gray-400 text-center p-8 font-black uppercase text-sm">NO PENDING INBOX TASKS</div>
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

        {view === 'retail' && (
          <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-start">
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

            <div className="w-full md:w-1/2 flex flex-col gap-3 md:gap-4 order-2 md:order-2">
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

              {!hasRetailInbox && retailCart.length === 0 && (
                <div className="w-full border-2 border-dashed border-gray-400 bg-gray-50 text-gray-400 text-center p-8 font-black uppercase text-sm">NO PENDING INBOX TASKS</div>
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