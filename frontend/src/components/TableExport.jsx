import React from 'react';
import { FileSpreadsheet, FileText, Database } from 'lucide-react';
import { api } from '../services/api';

function escapeXml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function formatRows(list) {
  const safeList = Array.isArray(list) ? list : [];
  return safeList.map((item, idx) => {
    // 1. S.L
    const sl = idx + 1;

    // 2. Date & Time (UTC)
    const dtStr = item.createdAt || item.created_at || item.date || item.completed_at || new Date().toISOString();
    const cleanDT = String(dtStr).replace('T', ' ').replace('Z', '').split('.')[0];
    const parts = cleanDT.split(' ');
    const dateVal = parts[0] || String(dtStr).substring(0, 10);
    const timeVal = parts[1] || String(dtStr).substring(11, 19) || '00:00:00';

    // 3. User ID & Username
    const uid = item.userId ?? item.user_id ?? '—';
    const username = item.userName || item.user_name || item.username || item.name || (uid !== '—' ? `user_${uid}` : 'Member');
    const email = item.userEmail || item.user_email || item.email || '—';

    // 4. Provider, Offer ID, Offer Name
    const provider = item.offerWall || item.offer_wall_name || item.provider || '—';
    const offerId = item.offerId || item.offer_id || '—';
    const offerName = item.offerName || item.offer_name || 'Standard Offer';

    // 5. Coin (real numeric, never blank, 0 if null, no multiplier)
    const rawCoin = item.reward ?? item.currencyReward ?? item.currency_reward ?? item.coin_amount ?? item.coins ?? item.points ?? 0;
    const coins = Number(rawCoin) || 0;

    // 6. Worker payouts (numeric cells)
    const payoutUsd = Number(item.payoutUsd ?? item.payout_usd ?? 0);
    const payoutBdt = Number(item.payoutBdt ?? item.payout_bdt ?? 0);

    // 7. Status & My ID
    const status = item.status || 'Completed';
    const myId = item.myId ?? item.my_id ?? item.my_id_code ?? '—';

    // 8. Transaction ID, IP, Country
    const txId = item.transactionId || item.transaction_id || `TX-${item.id || idx + 1}`;
    const ip = item.ip || '—';
    const country = item.country || '—';

    return {
      sl,
      date: dateVal,
      time: timeVal,
      user_id: uid,
      username,
      email,
      provider,
      offer_id: offerId,
      offer_name: offerName,
      coins,
      payout_usd: payoutUsd,
      payout_bdt: payoutBdt,
      status,
      my_id: myId,
      tx_id: txId,
      ip,
      country,
    };
  });
}

function crc32(buffer) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createZipArchive(files) {
  const encoder = new TextEncoder();
  const fileEntries = [];
  let offset = 0;

  files.forEach(f => {
    const data = typeof f.content === 'string' ? encoder.encode(f.content) : f.content;
    const nameBytes = encoder.encode(f.name);
    const crc = crc32(data);
    
    const header = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, data.length, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);
    header.set(nameBytes, 30);

    fileEntries.push({ nameBytes, data, crc, header, offset });
    offset += header.length + data.length;
  });

  const centralDirOffset = offset;
  const centralEntries = [];

  fileEntries.forEach(entry => {
    const cdHeader = new Uint8Array(46 + entry.nameBytes.length);
    const view = new DataView(cdHeader.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint16(14, 0, true);
    view.setUint32(16, entry.crc, true);
    view.setUint32(20, entry.data.length, true);
    view.setUint32(24, entry.data.length, true);
    view.setUint16(28, entry.nameBytes.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, entry.offset, true);
    cdHeader.set(entry.nameBytes, 46);

    centralEntries.push(cdHeader);
    offset += cdHeader.length;
  });

  const centralDirSize = offset - centralDirOffset;

  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, files.length, true);
  eocdView.setUint16(10, files.length, true);
  eocdView.setUint32(12, centralDirSize, true);
  eocdView.setUint32(16, centralDirOffset, true);
  eocdView.setUint16(20, 0, true);

  const totalLength = offset + 22;
  const result = new Uint8Array(totalLength);
  let pos = 0;

  fileEntries.forEach(entry => {
    result.set(entry.header, pos);
    pos += entry.header.length;
    result.set(entry.data, pos);
    pos += entry.data.length;
  });

  centralEntries.forEach(cd => {
    result.set(cd, pos);
    pos += cd.length;
  });

  result.set(eocd, pos);
  return result;
}

function generateGenuineXLSXBlob(list, sheetName = 'Completed Offers') {
  const formatted = formatRows(list);
  const headers = [
    'S.L',
    'Date (UTC)',
    'Time (UTC)',
    'User ID',
    'Username',
    'Email',
    'Provider',
    'Offer ID',
    'Offer Name',
    'Coin',
    'Payout USD',
    'Payout BDT',
    'Status',
    'My ID',
    'Transaction ID',
    'IP Address',
    'Country',
  ];

  let sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">\n<sheetData>\n<row r="1">`;
  headers.forEach(h => {
    sheetXml += `<c t="inlineStr"><is><t>${escapeXml(h)}</t></is></c>`;
  });
  sheetXml += `</row>\n`;

  formatted.forEach((r, idx) => {
    const rowNum = idx + 2;
    sheetXml += `<row r="${rowNum}">`;
    sheetXml += `<c><v>${r.sl}</v></c>`;
    sheetXml += `<c t="inlineStr"><is><t>${escapeXml(r.date)}</t></is></c>`;
    sheetXml += `<c t="inlineStr"><is><t>${escapeXml(r.time)}</t></is></c>`;
    sheetXml += !isNaN(Number(r.user_id)) && r.user_id !== '—' && r.user_id !== ''
      ? `<c><v>${r.user_id}</v></c>`
      : `<c t="inlineStr"><is><t>${escapeXml(r.user_id)}</t></is></c>`;
    sheetXml += `<c t="inlineStr"><is><t>${escapeXml(r.username)}</t></is></c>`;
    sheetXml += `<c t="inlineStr"><is><t>${escapeXml(r.email)}</t></is></c>`;
    sheetXml += `<c t="inlineStr"><is><t>${escapeXml(r.provider)}</t></is></c>`;
    sheetXml += `<c t="inlineStr"><is><t>${escapeXml(r.offer_id)}</t></is></c>`;
    sheetXml += `<c t="inlineStr"><is><t>${escapeXml(r.offer_name)}</t></is></c>`;
    sheetXml += `<c><v>${Number(r.coins) || 0}</v></c>`;
    sheetXml += `<c><v>${Number(r.payout_usd) || 0}</v></c>`;
    sheetXml += `<c><v>${Number(r.payout_bdt) || 0}</v></c>`;
    sheetXml += `<c t="inlineStr"><is><t>${escapeXml(r.status)}</t></is></c>`;
    sheetXml += `<c t="inlineStr"><is><t>${escapeXml(r.my_id)}</t></is></c>`;
    sheetXml += `<c t="inlineStr"><is><t>${escapeXml(r.tx_id)}</t></is></c>`;
    sheetXml += `<c t="inlineStr"><is><t>${escapeXml(r.ip)}</t></is></c>`;
    sheetXml += `<c t="inlineStr"><is><t>${escapeXml(r.country)}</t></is></c>`;
    sheetXml += `</row>\n`;
  });
  sheetXml += `</sheetData>\n</worksheet>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

  const files = [
    { name: '[Content_Types].xml', content: contentTypes },
    { name: '_rels/.rels', content: rels },
    { name: 'xl/workbook.xml', content: workbook },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRels },
    { name: 'xl/worksheets/sheet1.xml', content: sheetXml },
  ];

  const zipUint8Array = createZipArchive(files);
  return new Blob([zipUint8Array], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function downloadFile(content, fileName, mimeType) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export default function TableExport({ data = [], allData = [], selectedMonth = 'all', selectedDay = 'all', filename = 'wincashz-completed-offers' }) {
  const handleExportExcelFiltered = async () => {
    let name = filename;
    if (selectedDay !== 'all') {
      name = `wincashz-completed-offers-${selectedDay}.xlsx`;
    } else if (selectedMonth !== 'all') {
      name = `wincashz-completed-offers-${selectedMonth}.xlsx`;
    } else {
      name = `wincashz-completed-offers-filtered.xlsx`;
    }

    try {
      const params = {};
      if (selectedDay !== 'all') {
        params.from_date = selectedDay;
        params.to_date = selectedDay;
      } else if (selectedMonth !== 'all') {
        params.month = selectedMonth;
      }
      await api.exportAdminCompletedTasks(params);
    } catch {
      const records = data.length ? data : allData;
      const blob = generateGenuineXLSXBlob(records);
      downloadFile(blob, name, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    }
  };

  const handleExportExcelAllTime = async () => {
    const name = `wincashz-completed-offers-all-time.xlsx`;
    try {
      await api.exportAdminCompletedTasks({ month: 'all' });
    } catch {
      const records = allData.length ? allData : data;
      const blob = generateGenuineXLSXBlob(records, 'All-Time Completed Offers');
      downloadFile(blob, name, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    }
  };

  const handleExportCSV = () => {
    const records = data.length ? data : allData;
    const formatted = formatRows(records);
    const headers = [
      'S.L',
      'Date (UTC)',
      'Time (UTC)',
      'User ID',
      'Username',
      'Email',
      'Provider',
      'Offer ID',
      'Offer Name',
      'Coin',
      'Payout USD',
      'Payout BDT',
      'Status',
      'My ID',
      'Transaction ID',
      'IP Address',
      'Country',
    ];
    const csvLines = [headers.join(',')];
    formatted.forEach(r => {
      csvLines.push([
        r.sl,
        `"${r.date}"`,
        `"${r.time}"`,
        `"${r.user_id}"`,
        `"${String(r.username).replace(/"/g, '""')}"`,
        `"${String(r.email).replace(/"/g, '""')}"`,
        `"${String(r.provider).replace(/"/g, '""')}"`,
        `"${String(r.offer_id).replace(/"/g, '""')}"`,
        `"${String(r.offer_name).replace(/"/g, '""')}"`,
        Number(r.coins) || 0,
        Number(r.payout_usd) || 0,
        Number(r.payout_bdt) || 0,
        `"${String(r.status).replace(/"/g, '""')}"`,
        `"${String(r.my_id).replace(/"/g, '""')}"`,
        `"${String(r.tx_id).replace(/"/g, '""')}"`,
        `"${String(r.ip).replace(/"/g, '""')}"`,
        `"${String(r.country).replace(/"/g, '""')}"`
      ].join(','));
    });
    const csvContent = '\uFEFF' + csvLines.join('\n');
    downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;');
  };

  const handleExportJSON = () => {
    const records = data.length ? data : allData;
    const formatted = formatRows(records);
    downloadFile(JSON.stringify(formatted, null, 2), `${filename}.json`, 'application/json');
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl p-1 text-xs">
      <button
        type="button"
        onClick={handleExportExcelFiltered}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 transition-all cursor-pointer"
        title="Export Current Filtered Selection to Excel (.xlsx)"
      >
        <FileSpreadsheet className="w-3.5 h-3.5" />
        {selectedDay !== 'all' ? 'Export Date Excel' : selectedMonth !== 'all' ? 'Export Month Excel' : 'Export Excel (.xlsx)'}
      </button>

      <button
        type="button"
        onClick={handleExportExcelAllTime}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold text-cyan-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
        title="Export All-Time Completed Offers Records to Excel (.xlsx)"
      >
        <FileText className="w-3.5 h-3.5 text-cyan-400" />
        All-Time Excel
      </button>

      <button
        type="button"
        onClick={handleExportCSV}
        className="flex items-center gap-1 px-2 py-1 rounded-lg font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        title="Export CSV"
      >
        CSV
      </button>

      <button
        type="button"
        onClick={handleExportJSON}
        className="flex items-center gap-1 px-2 py-1 rounded-lg font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        title="Export JSON"
      >
        Database
      </button>
    </div>
  );
}
