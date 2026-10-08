import React from 'react';
import { FileSpreadsheet, FileText, Database } from 'lucide-react';

function escapeXml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function formatRows(list) {
  const safeList = Array.isArray(list) ? list : [];
  return safeList.map((item, idx) => {
    const rawBal = Number(item.reward || item.coins || item.points || 0);
    const coins = Math.round(rawBal >= 100 ? rawBal : rawBal * 1000);
    const offerVal = Number(item.offer_value ?? item.value ?? item.payout ?? (coins ? coins / 1000 : 0));
    const siteRev = Number(item.site_revenue ?? item.revenue ?? (offerVal * 0.7));
    const dtStr = item.created_at || item.date || new Date().toISOString();
    const parts = String(dtStr).split(' ');
    const dateVal = parts[0] || dtStr.substring(0, 10);
    const timeVal = parts[1] || dtStr.substring(11, 19) || '00:00:00';
    const uid = item.user_id ? (Number(item.user_id) >= 101 ? item.user_id : 100 + Number(item.user_id)) : '101';

    return {
      sl: idx + 1,
      user_id: uid,
      name: item.user_name || item.name || item.username || 'Member',
      email: item.email || '—',
      offerwall: item.offerwall_name || item.offerwall || 'System',
      offer_name: item.offer_name || 'Offer Task',
      coins,
      site_revenue: siteRev.toFixed(2),
      offer_value: offerVal.toFixed(2),
      tx_id: item.transaction_id || `TX-${item.id || idx}`,
      ip: item.ip || '127.0.0.1',
      country: item.country || 'US',
      date: dateVal,
      time: timeVal
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
    'S.L', 'User ID', 'Name', 'Email', 'Offerwall', 'Offer Name',
    'Reward / Coins', 'Site Revenue ($)', 'Offer Value ($)', 'Transaction ID',
    'IP Address', 'Country', 'Date', 'Time'
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
    sheetXml += `<c><v>${r.user_id}</v></c>`;
    sheetXml += `<c t="inlineStr"><is><t>${escapeXml(r.name)}</t></is></c>`;
    sheetXml += `<c t="inlineStr"><is><t>${escapeXml(r.email)}</t></is></c>`;
    sheetXml += `<c t="inlineStr"><is><t>${escapeXml(r.offerwall)}</t></is></c>`;
    sheetXml += `<c t="inlineStr"><is><t>${escapeXml(r.offer_name)}</t></is></c>`;
    sheetXml += `<c><v>${r.coins}</v></c>`;
    sheetXml += `<c><v>${r.site_revenue}</v></c>`;
    sheetXml += `<c><v>${r.offer_value}</v></c>`;
    sheetXml += `<c t="inlineStr"><is><t>${escapeXml(r.tx_id)}</t></is></c>`;
    sheetXml += `<c t="inlineStr"><is><t>${escapeXml(r.ip)}</t></is></c>`;
    sheetXml += `<c t="inlineStr"><is><t>${escapeXml(r.country)}</t></is></c>`;
    sheetXml += `<c t="inlineStr"><is><t>${escapeXml(r.date)}</t></is></c>`;
    sheetXml += `<c t="inlineStr"><is><t>${escapeXml(r.time)}</t></is></c>`;
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
  const handleExportExcelFiltered = () => {
    const records = data.length ? data : allData;
    let name = filename;
    if (selectedDay !== 'all') {
      name = `wincashz-completed-offers-${selectedDay}.xlsx`;
    } else if (selectedMonth !== 'all') {
      name = `wincashz-completed-offers-${selectedMonth}.xlsx`;
    } else {
      name = `wincashz-completed-offers-filtered.xlsx`;
    }
    const blob = generateGenuineXLSXBlob(records);
    downloadFile(blob, name, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  };

  const handleExportExcelAllTime = () => {
    const records = allData.length ? allData : data;
    const name = `wincashz-completed-offers-all-time.xlsx`;
    const blob = generateGenuineXLSXBlob(records, 'All-Time Completed Offers');
    downloadFile(blob, name, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  };

  const handleExportCSV = () => {
    const records = data.length ? data : allData;
    const formatted = formatRows(records);
    const headers = [
      'S.L', 'User ID', 'Name', 'Email', 'Offerwall', 'Offer Name',
      'Reward / Coins', 'Site Revenue ($)', 'Offer Value ($)', 'Transaction ID',
      'IP Address', 'Country', 'Date', 'Time'
    ];
    const csvLines = [headers.join(',')];
    formatted.forEach(r => {
      csvLines.push([
        r.sl,
        r.user_id,
        `"${r.name.replace(/"/g, '""')}"`,
        `"${r.email.replace(/"/g, '""')}"`,
        `"${r.offerwall.replace(/"/g, '""')}"`,
        `"${r.offer_name.replace(/"/g, '""')}"`,
        r.coins,
        r.site_revenue,
        r.offer_value,
        `"${r.tx_id.replace(/"/g, '""')}"`,
        `"${r.ip.replace(/"/g, '""')}"`,
        `"${r.country.replace(/"/g, '""')}"`,
        `"${r.date}"`,
        `"${r.time}"`
      ].join(','));
    });
    downloadFile(csvLines.join('\n'), `${filename}.csv`, 'text/csv;charset=utf-8;');
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
