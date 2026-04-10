// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const resendApiKey = Deno.env.get("RESEND_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req: any) => {
  try {
    let reqBody: any = {};
    if (req.method === "POST") {
      try { reqBody = await req.json(); } catch (e) { /* ignore */ }
    }
    const isManualTest = reqBody.force_send === "admin_test";

    const now = new Date();
    const istTime = now.getTime() + (5.5 * 60 * 60 * 1000);
    const istDate = new Date(istTime); 
    
    const year = istDate.getUTCFullYear();
    const month = istDate.getUTCMonth();
    const day = istDate.getUTCDate();
    
    const tomorrow = new Date(istTime + (24 * 60 * 60 * 1000));
    
    if (!isManualTest && tomorrow.getUTCDate() !== 1) {
        return new Response(JSON.stringify({ message: "Not the last day of the month. Sleeping." }), { status: 200 });
    }

    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
    
    const startIST_as_UTC = Date.UTC(year, month, 1, 0, 0, 0);
    const startUTC = new Date(startIST_as_UTC - (5.5 * 60 * 60 * 1000));

    const endIST_as_UTC = Date.UTC(year, month, day, 23, 59, 59);
    const endUTC = new Date(endIST_as_UTC - (5.5 * 60 * 60 * 1000));

    const [txResponse, masterResponse] = await Promise.all([
      supabase.from('transactions')
        .select('*, admin_note')
        .gte('timestamp', startUTC.toISOString())
        .lte('timestamp', endUTC.toISOString())
        .in('status', ['ACCEPTED', 'DISPATCHED', 'RETURN_ACCEPTED'])
        .order('timestamp', { ascending: false }),
      supabase.from('master_items').select('*')
    ]);

    if (txResponse.error) throw txResponse.error;
    const ledgerData = txResponse.data;
    const masterItems = masterResponse.data || [];

    const getCategory = (desc: any) => {
      const item = masterItems.find((i: any) => String(i.description).toUpperCase() === String(desc).toUpperCase());
      if (item && item.category) return item.category;
      const upperDesc = desc ? String(desc).toUpperCase() : '';
      if (upperDesc.includes('TYRE') || upperDesc.includes('TUBE') || upperDesc.match(/\d{2,3}\/\d{2,3}/)) return 'TVS';
      return 'SERVO';
    };

    const getUnit = (desc: any) => {
      if (!desc) return '';
      const upperDesc = String(desc).toUpperCase();
      let cat = getCategory(desc);
      if (cat === 'SERVO') {
        if (/210\s*L/i.test(desc) || /182\s*KG/i.test(desc)) return 'BRL';
        if (/50\s*L/i.test(desc)) return 'DRUM';
        if (/(7\.5|10|15|20|26)\s*(L|KG)/i.test(desc)) return 'BUC';
        return 'CANS';
      }
      return /\bTT\b/i.test(upperDesc) ? 'SET' : 'PCS';
    };

    const getDisplayQty = (desc: any, qty: any, unit: any) => {
      const item = masterItems.find((i: any) => String(i.description).toUpperCase() === String(desc).toUpperCase());
      const isNegative = qty < 0;
      const absQty = Math.abs(qty);
      const sign = isNegative ? '- ' : '';
      if (item && item.category === 'SERVO' && item.ratio && parseFloat(item.ratio) > 1) {
          const ratio = parseInt(item.ratio);
          const cases = Math.floor(absQty / ratio);
          const cans = absQty % ratio;
          let parts = [];
          if (cases > 0) parts.push(`${cases} CAR`);
          if (cans > 0) parts.push(`${cans} ${unit}`);
          return parts.length > 0 ? sign + parts.join(' + ') : `0 ${unit}`;
      }
      return `${sign}${absQty || 0} ${unit}`;
    };

    const formatDateIST = (dateStr: any) => {
      const dUTC = new Date(dateStr);
      const dIST = new Date(dUTC.getTime() + (5.5 * 60 * 60 * 1000));
      const dayStr = String(dIST.getUTCDate()).padStart(2, '0');
      const mStr = String(dIST.getUTCMonth() + 1).padStart(2, '0');
      return `${dayStr}/${mStr}/${dIST.getUTCFullYear()}`;
    };

    const formatTimeIST = (dateStr: any) => {
      const dUTC = new Date(dateStr);
      const dIST = new Date(dUTC.getTime() + (5.5 * 60 * 60 * 1000));
      let hours = dIST.getUTCHours();
      let minutes = String(dIST.getUTCMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12; 
      return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
    };

    const dispatchedDataObj: Record<string, any> = {};
    const returnsDataObj: Record<string, any> = {};
    
    ledgerData.forEach((row: any) => {
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

    const dispatchedGroups = Object.values(dispatchedDataObj).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const returnGroups = Object.values(returnsDataObj);

    const itemSummary: Record<string, any> = {};
    ledgerData.forEach((row: any) => {
      const desc = String(row.item_desc).toUpperCase();
      const q = parseInt(row.disp_qty || row.req_qty) || 0;
      if(!itemSummary[desc]) itemSummary[desc] = { qty: 0, unit: row.unit || getUnit(desc), category: getCategory(desc) };
      if (row.status === 'RETURN_ACCEPTED') itemSummary[desc].qty -= q;
      else if (row.status === 'ACCEPTED' || row.status === 'DISPATCHED') itemSummary[desc].qty += q;
    });

    const summaryEntries = Object.entries(itemSummary).filter(([_, data]: any) => data.qty !== 0); 
    const servoEntries = summaryEntries.filter(([_, data]: any) => data.category === 'SERVO');
    const tvsEntries = summaryEntries.filter(([_, data]: any) => data.category === 'TVS');

    const monthNames = ["JAN", "FEB", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUG", "SEPT", "OCT", "NOV", "DEC"];
    const cycleTitle = `${monthNames[month]} ${year}`; 

    let leftRowsFlat: any[] = [];
    leftRowsFlat.push({ type: 'title', title: `GUJARAT OIL DEPOT - TRANSACTION LEDGER (${cycleTitle})`, bgColor: '#d1d5db' });
    leftRowsFlat.push({ type: 'subtitle', title: `BILLED TO: SOUTH GUJARAT DISTRIBUTORS, RETAIL STORE`, bgColor: '#f3f4f6' });
    leftRowsFlat.push({ type: 'header', cols: ['DATE / TIME', 'CHALLAN NO', 'ITEM DESCRIPTION', 'NOS', 'QTY', 'ADMIN NOTE'], bgColor: '#e5e7eb' });

    let globalTxTotal = 0;
    dispatchedGroups.forEach((group: any) => {
      let bgColor = group.status === "ACCEPTED" ? "#dcfce7" : "#dbeafe"; 
      group.items.forEach((row: any, i: number) => {
        const rawQty = parseInt(row.disp_qty || row.req_qty) || 0;
        globalTxTotal += rawQty;
        leftRowsFlat.push({
          type: 'data', isReturn: false, isFirst: i === 0, rowspan: group.items.length,
          date: `${formatDateIST(group.date)}<br style="mso-data-placement:same-cell;"/>${formatTimeIST(group.date)}`,
          challan: group.challan_no || '-', desc: String(row.item_desc).toUpperCase(),
          nos: String(rawQty).padStart(2, '0'),
          qty: getDisplayQty(row.item_desc, rawQty, row.unit || getUnit(row.item_desc)).toUpperCase(),
          adminNote: group.admin_note || '',
          color: bgColor, qtyColor: 'color: #000;' 
        });
      });
    });
    
    if (dispatchedGroups.length > 0) {
      leftRowsFlat.push({ type: 'global_total', color: '#d1d5db', total: String(globalTxTotal).padStart(2, '0') });
    }

    if (returnGroups.length > 0) {
      leftRowsFlat.push({ type: 'empty' });
      leftRowsFlat.push({ type: 'title', title: `GUJARAT OIL DEPOT - RETURN LEDGER (${cycleTitle})`, bgColor: '#fca5a5' });
      leftRowsFlat.push({ type: 'subtitle', title: `RETURNED BY: SOUTH GUJARAT DISTRIBUTORS, RETAIL STORE`, bgColor: '#fee2e2' });
      leftRowsFlat.push({ type: 'header', cols: ['DATE / TIME', 'RETURN NO', 'ITEM DESCRIPTION', 'NOS', 'QTY', 'REMARKS / NOTE'], bgColor: '#fecaca' });
      
      let globalReturnTotal = 0;
      returnGroups.forEach((group: any) => {
        let bgColor = "#fef2f2"; 
        group.items.forEach((row: any, i: number) => {
          const rawQty = parseInt(row.disp_qty || row.req_qty) || 0;
          globalReturnTotal += rawQty;
          leftRowsFlat.push({
            type: 'data', isReturn: true, isFirst: i === 0, rowspan: group.items.length, 
            date: `${formatDateIST(row.timestamp)}<br style="mso-data-placement:same-cell;"/>${formatTimeIST(row.timestamp)}`,
            challan: row.challan_no || '-', desc: String(row.item_desc).toUpperCase(),
            nos: String(rawQty).padStart(2, '0'),
            qty: getDisplayQty(row.item_desc, rawQty, row.unit || getUnit(row.item_desc)).toUpperCase(),
            note: row.note || '',
            color: bgColor, qtyColor: 'color: #dc2626;' 
          });
        });
      });
      leftRowsFlat.push({ type: 'global_total', color: '#fca5a5', total: String(globalReturnTotal).padStart(2, '0') });
    }

    let rightRowsFlat: any[] = [];
    rightRowsFlat.push({ type: 'title', title: `ITEM WISE SUMMARY`, bgColor: '#fde047' });
    rightRowsFlat.push({ type: 'subtitle', title: `TOTAL SKUS: ${summaryEntries.length}`, bgColor: '#fef08a' });
    rightRowsFlat.push({ type: 'header', cols: ['ITEM DESCRIPTION', 'TOTAL NOS', 'CONVERTED QTY'], bgColor: '#fef9c3' });
    
    if (servoEntries.length > 0) {
        rightRowsFlat.push({ type: 'group_title', title: 'SERVO LUBRICANTS', bgColor: '#fde047' });
        let servoTotal = 0;
        servoEntries.forEach(([desc, data]: any) => {
           servoTotal += data.qty;
           rightRowsFlat.push({ type: 'summary_data', desc, nos: String(data.qty).padStart(2, '0'), qty: getDisplayQty(desc, data.qty, data.unit).toUpperCase() });
        });
        rightRowsFlat.push({ type: 'summary_total', total: String(servoTotal).padStart(2, '0'), color: '#fef08a' });
    }
    if (tvsEntries.length > 0) {
        rightRowsFlat.push({ type: 'group_title', title: 'TVS TYRES & TUBES', bgColor: '#fde047' });
        let tvsTotal = 0;
        tvsEntries.forEach(([desc, data]: any) => {
           tvsTotal += data.qty;
           rightRowsFlat.push({ type: 'summary_data', desc, nos: String(data.qty).padStart(2, '0'), qty: getDisplayQty(desc, data.qty, data.unit).toUpperCase() });
        });
        rightRowsFlat.push({ type: 'summary_total', total: String(tvsTotal).padStart(2, '0'), color: '#fef08a' });
    }

    const maxRows = Math.max(leftRowsFlat.length, rightRowsFlat.length);
    let html = `<html xmlns:o=\"urn:schemas-microsoft-com:office:office\" xmlns:x=\"urn:schemas-microsoft-com:office:excel\" xmlns=\"http://www.w3.org/TR/REC-html40\"><head><meta charset=\"UTF-8\"></head><body>`;
    html += `<table border=\"0\" cellpadding=\"5\" cellspacing=\"0\" style=\"font-family: Arial, sans-serif; border-collapse: collapse; font-size: 13px; white-space: nowrap;\">`;
    html += `<colgroup><col width=\"130\" /><col width=\"110\" /><col width=\"380\" /><col width=\"50\" /><col width=\"130\" /><col width=\"180\" /><col width=\"30\" /><col width=\"380\" /><col width=\"80\" /><col width=\"140\" /></colgroup>`;

    for(let i=0; i<maxRows; i++) {
      html += `<tr style=\"height: 35px;\">`;
      if (i < leftRowsFlat.length) {
        const l = leftRowsFlat[i];
        const spanLimit = 6;
        if (l.type === 'title') {
            html += `<td colspan=\"${spanLimit}\" style=\"background-color: ${l.bgColor}; color: #000; padding: 10px; text-align: left; border: 1px solid black; font-size: 16px; font-weight: bold; vertical-align: middle; white-space: nowrap;\">${l.title}</td>`;
        } else if (l.type === 'subtitle') {
            html += `<td colspan=\"${spanLimit}\" style=\"background-color: ${l.bgColor}; color: #000; padding: 8px; text-align: left; border: 1px solid black; font-weight: bold; vertical-align: middle; white-space: nowrap;\">${l.title}</td>`;
        } else if (l.type === 'header') {
            l.cols.forEach((col: any, idx: number) => {
                const align = (idx === 2) ? 'left' : 'center'; 
                html += `<td style=\"background-color: ${l.bgColor}; border: 1px solid black; padding: 8px; font-weight: bold; text-align: ${align}; color: #000; vertical-align: middle; white-space: nowrap;\">${col}</td>`;
            });
        } else if (l.type === 'data') {
            if (l.isFirst) {
                html += `<td rowspan=\"${l.rowspan}\" style=\"mso-number-format:'\\@'; background-color: ${l.color}; border: 1px solid black; vertical-align: middle; text-align: center; font-weight: bold; padding: 8px; color: #000; white-space: normal; mso-style-textwrap: yes;\">${l.date}</td>`;
                html += `<td rowspan=\"${l.rowspan}\" style=\"mso-number-format:'\\@'; background-color: ${l.color}; border: 1px solid black; vertical-align: middle; text-align: center; font-weight: bold; padding: 8px; color: #000; white-space: nowrap;\">${l.challan}</td>`;
            }
            html += `<td style=\"background-color: ${l.color}; border: 1px solid black; vertical-align: middle; padding: 8px; color: #000; white-space: normal; mso-style-textwrap: yes; word-wrap: break-word;\">${l.desc}</td>`;
            html += `<td style=\"background-color: ${l.color}; border: 1px solid black; vertical-align: middle; text-align: center; font-weight: bold; padding: 8px; ${l.qtyColor} white-space: nowrap;\">${l.nos}</td>`;
            html += `<td style=\"background-color: ${l.color}; border: 1px solid black; vertical-align: middle; font-weight: bold; padding: 8px; text-align: center; ${l.qtyColor} white-space: nowrap;\">${l.qty}</td>`;
            if (l.isReturn) {
                if (l.isFirst) html += `<td rowspan=\"${l.rowspan}\" style=\"background-color: ${l.color}; border: 1px solid black; vertical-align: middle; padding: 8px; color: #000; width: 180px; max-width: 180px; white-space: normal; mso-style-textwrap: yes; word-wrap: break-word;\">${l.note || ''}</td>`;
            } else {
                if (l.isFirst) html += `<td rowspan=\"${l.rowspan}\" style=\"background-color: ${l.color}; border: 1px solid black; vertical-align: middle; padding: 8px; color: #000; width: 180px; max-width: 180px; white-space: normal; mso-style-textwrap: yes; word-wrap: break-word;\">${l.adminNote || ''}</td>`;
            }
        } else if (l.type === 'global_total') {
            html += `<td colspan=\"3\" style=\"background-color: ${l.color}; border: 1px solid black; padding: 8px; text-align: right; font-weight: bold; color: #000; vertical-align: middle; white-space: nowrap;\">GRAND TOTAL:</td>`;
            html += `<td style=\"background-color: ${l.color}; border: 1px solid black; padding: 8px; text-align: center; font-weight: bold; color: #000; vertical-align: middle; white-space: nowrap;\">${l.total}</td>`;
            html += `<td style=\"background-color: ${l.color}; border: 1px solid black; padding: 8px;\"></td>`;
            html += `<td style=\"background-color: ${l.color}; border: 1px solid black; padding: 8px;\"></td>`;
        } else if (l.type === 'empty') {
            html += `<td style=\"border: none; background-color: transparent;\"></td>`.repeat(6);
        }
      } else {
        html += `<td style=\"border: none; background-color: transparent;\"></td>`.repeat(6);
      }
      html += `<td style=\"border: none; background-color: transparent; width: 30px;\"></td>`;
      if (i < rightRowsFlat.length) {
        const r = rightRowsFlat[i];
        if (r.type === 'title') {
            html += `<td colspan=\"3\" style=\"background-color: ${r.bgColor}; color: #000; padding: 10px; text-align: left; border: 1px solid black; font-size: 16px; font-weight: bold; vertical-align: middle; white-space: nowrap;\">${r.title}</td>`;
        } else if (r.type === 'subtitle') {
            html += `<td colspan=\"3\" style=\"background-color: ${r.bgColor}; color: #000; padding: 8px; text-align: left; border: 1px solid black; font-weight: bold; vertical-align: middle; white-space: nowrap;\">${r.title}</td>`;
        } else if (r.type === 'header') {
            r.cols.forEach((col: any, idx: number) => {
                const align = (idx === 0) ? 'left' : 'center';
                html += `<td style=\"background-color: ${r.bgColor}; border: 1px solid black; padding: 8px; font-weight: bold; text-align: ${align}; color: #000; vertical-align: middle; white-space: nowrap;\">${col}</td>`;
            });
        } else if (r.type === 'group_title') {
            html += `<td colspan=\"3\" style=\"background-color: ${r.bgColor}; color: #1e3a8a; padding: 8px; text-align: center; border: 1px solid black; font-weight: bold; font-size: 14px; vertical-align: middle; white-space: nowrap;\">${r.title}</td>`;
        } else if (r.type === 'summary_data') {
            html += `<td style=\"border: 1px solid black; vertical-align: middle; padding: 8px; color: #000; background-color: #ffffff; white-space: normal; mso-style-textwrap: yes; word-wrap: break-word;\">${r.desc}</td>`;
            html += `<td style=\"border: 1px solid black; vertical-align: middle; text-align: center; font-weight: bold; padding: 8px; color: #000; background-color: #ffffff; white-space: nowrap;\">${r.nos}</td>`;
            html += `<td style=\"border: 1px solid black; vertical-align: middle; font-weight: bold; padding: 8px; text-align: center; color: #000; background-color: #ffffff; white-space: nowrap;\">${r.qty}</td>`;
        } else if (r.type === 'summary_total') {
            html += `<td style=\"background-color: ${r.color}; border: 1px solid black; padding: 8px; text-align: right; font-weight: bold; color: #000; vertical-align: middle; white-space: nowrap;\">GROUP TOTAL:</td>`;
            html += `<td style=\"background-color: ${r.color}; border: 1px solid black; padding: 8px; text-align: center; font-weight: bold; color: #000; vertical-align: middle; white-space: nowrap;\">${r.total}</td>`;
            html += `<td style=\"background-color: ${r.color}; border: 1px solid black; padding: 8px;\"></td>`;
        }
      } else {
        html += `<td style=\"border: none; background-color: transparent;\"></td>`.repeat(3);
      }
      html += `</tr>`;
    }
    html += `</table></body></html>`;

    const base64Xls = btoa(unescape(encodeURIComponent(html)));

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Gujarat Oil Depot Management System<onboarding@resend.dev>", 
        to: ["smit.modi206@gmail.com"],
        subject: `GOD eChallan Ledger Report: ${cycleTitle}`,
        html: `
          <div style=\"font-family: Arial, sans-serif; color: #333; padding: 20px;\">
            <h2 style=\"color: #1e3a8a;\">Gujarat Oil Depot - Automated Monthly Ledger</h2>
            <p>Attached is the ${isManualTest ? '<b>Monthly eChallan</b>' : 'automated'} transaction and return ledger for: <b>${cycleTitle}</b>.</p>
            <p><b>Total Operations Logged:</b> ${ledgerData?.length || 0}</p>
            <br/>
            <hr style=\"border: 1px solid #ccc;\" />
            <p style=\"font-size: 11px; color: #666; margin-top: 10px;\">This is an automatically generated email from your GOD eChallan System.</p>
          </div>
        `,
        attachments: [
          {
            filename: `GOD Ledger ${cycleTitle}.xls`, 
            content: base64Xls,
          }
        ]
      }),
    });

    const emailRes = await res.json();
    return new Response(JSON.stringify({ success: true, emailRes }), { status: 200, headers: { "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});