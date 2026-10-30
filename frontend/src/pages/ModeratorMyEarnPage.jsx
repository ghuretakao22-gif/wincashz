import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Coins, 
  Calendar, 
  DollarSign, 
  Layers, 
  RefreshCw, 
  AlertCircle, 
  TrendingUp, 
  ShieldCheck,
  CheckCircle2,
  Lock,
  FileSpreadsheet,
  Clock
} from 'lucide-react';
import { api } from '../services/api';

function escapeXml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
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
  });

  const cdTotalLength = centralEntries.reduce((sum, cd) => sum + cd.length, 0);

  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, fileEntries.length, true);
  eocdView.setUint16(10, fileEntries.length, true);
  eocdView.setUint32(12, cdTotalLength, true);
  eocdView.setUint32(16, centralDirOffset, true);
  eocdView.setUint16(20, 0, true);

  const totalSize = offset + cdTotalLength + 22;
  const zipBuffer = new Uint8Array(totalSize);

  let pos = 0;
  fileEntries.forEach(entry => {
    zipBuffer.set(entry.header, pos);
    pos += entry.header.length;
    zipBuffer.set(entry.data, pos);
    pos += entry.data.length;
  });

  centralEntries.forEach(cd => {
    zipBuffer.set(cd, pos);
    pos += cd.length;
  });

  zipBuffer.set(eocd, pos);
  return zipBuffer;
}

function generateMyEarnXLSXBlob(data) {
  const items = data.items || [];
  const summary = data.summary || { total_offers: 0, total_coins: 0, total_usd: 0, total_bdt: 0 };
  const periodLabel = data.selected_month || 'Current';

  let sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>
<row r="1">
<c t="inlineStr"><is><t>My Earn Report</t></is></c>
<c t="inlineStr"><is><t>My ID: ${escapeXml(data.my_id || 'N/A')}</t></is></c>
<c t="inlineStr"><is><t>Period: ${escapeXml(periodLabel)}</t></is></c>
</row>
<row r="2"/>
<row r="3">
<c t="inlineStr"><is><t>SL</t></is></c>
<c t="inlineStr"><is><t>Wall / Provider</t></is></c>
<c t="inlineStr"><is><t>Offer Name</t></is></c>
<c t="inlineStr"><is><t>Coins</t></is></c>
<c t="inlineStr"><is><t>Quantity</t></is></c>
<c t="inlineStr"><is><t>Rate (USD)</t></is></c>
<c t="inlineStr"><is><t>Rate (BDT)</t></is></c>
<c t="inlineStr"><is><t>Total USD</t></is></c>
<c t="inlineStr"><is><t>Total BDT</t></is></c>
</row>\n`;

  let rowNum = 4;
  items.forEach((item, idx) => {
    sheetXml += `<row r="${rowNum}">`;
    sheetXml += `<c><v>${idx + 1}</v></c>`;
    sheetXml += `<c t="inlineStr"><is><t>${escapeXml(item.provider)}</t></is></c>`;
    sheetXml += `<c t="inlineStr"><is><t>${escapeXml(item.offer)}</t></is></c>`;
    sheetXml += `<c><v>${item.coins}</v></c>`;
    sheetXml += `<c><v>${item.quantity}</v></c>`;
    sheetXml += `<c><v>${Number(item.rate_usd).toFixed(2)}</v></c>`;
    sheetXml += `<c><v>${Number(item.rate_bdt).toFixed(2)}</v></c>`;
    sheetXml += `<c><v>${Number(item.total_usd).toFixed(2)}</v></c>`;
    sheetXml += `<c><v>${Number(item.total_bdt).toFixed(2)}</v></c>`;
    sheetXml += `</row>\n`;
    rowNum++;
  });

  rowNum++;
  // Summary section
  sheetXml += `<row r="${rowNum}">`;
  sheetXml += `<c t="inlineStr"><is><t>Total Offers</t></is></c>`;
  sheetXml += `<c><v>${summary.total_offers}</v></c>`;
  sheetXml += `</row>\n`;
  rowNum++;

  sheetXml += `<row r="${rowNum}">`;
  sheetXml += `<c t="inlineStr"><is><t>Total Coins</t></is></c>`;
  sheetXml += `<c><v>${summary.total_coins}</v></c>`;
  sheetXml += `</row>\n`;
  rowNum++;

  sheetXml += `<row r="${rowNum}">`;
  sheetXml += `<c t="inlineStr"><is><t>Total USD</t></is></c>`;
  sheetXml += `<c><v>${Number(summary.total_usd).toFixed(2)}</v></c>`;
  sheetXml += `</row>\n`;
  rowNum++;

  sheetXml += `<row r="${rowNum}">`;
  sheetXml += `<c t="inlineStr"><is><t>Total BDT</t></is></c>`;
  sheetXml += `<c><v>${Number(summary.total_bdt).toFixed(2)}</v></c>`;
  sheetXml += `</row>\n`;

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
    <sheet name="My Earn" sheetId="1" r:id="rId1"/>
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

export default function ModeratorMyEarnPage() {
  const [data, setData] = useState({
    my_id: null,
    has_my_id: false,
    active_period: 'this_month',
    selected_month: '',
    months: [],
    summary: {
      total_offers: 0,
      total_coins: 0,
      total_usd: 0,
      total_bdt: 0,
    },
    offer_summary: [],
    items: [],
  });

  const [selectedMonth, setSelectedMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Helper to format YYYY-MM into human-readable e.g. "October 2026"
  const formatMonthLabel = (monthStr) => {
    if (!monthStr || monthStr === 'this_month') return 'This Month';
    if (monthStr === 'today') return 'Today';
    if (monthStr === 'all') return 'All Time';
    const [year, month] = monthStr.split('-');
    if (!year || !month) return monthStr;
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  };

  const fetchEarnings = useCallback(async (monthToFetch = '') => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (monthToFetch) {
        params.month = monthToFetch;
      }
      const res = await api.getModeratorMyEarn(params);
      if (res && res.data) {
        setData(res.data);
        if (!selectedMonth && res.data.selected_month) {
          setSelectedMonth(res.data.selected_month);
        }
      }
    } catch (err) {
      console.error('Failed to load moderator earnings:', err);
      setError(err?.message || 'Failed to load My Earn data');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchEarnings(selectedMonth);
  }, [selectedMonth, fetchEarnings]);

  const handleMonthChange = (e) => {
    const val = e.target.value;
    setSelectedMonth(val);
  };

  const handleExportExcel = () => {
    if (!data.items || data.items.length === 0) return;
    const blob = generateMyEarnXLSXBlob(data);
    const activeMonth = selectedMonth || data.selected_month || 'current';
    const myIdCode = data.my_id || 'unlinked';
    const fileName = `my-earn-${myIdCode}-${activeMonth}.xlsx`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const offerSummary = useMemo(() => Array.isArray(data.offer_summary) ? data.offer_summary : [], [data.offer_summary]);
  const items = useMemo(() => Array.isArray(data.items) ? data.items : [], [data.items]);
  const activePeriod = data.active_period || (selectedMonth === 'today' ? 'today' : (selectedMonth === 'all' ? 'all' : 'this_month'));

  return (
    <div className="space-y-6">
      {/* Top Header: Title, My ID Badge, Quick Filters, Month Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <Coins className="w-6 h-6 text-brand-400" />
              <span>My Earn</span>
            </h1>
            {data.my_id ? (
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-brand-500/15 text-brand-400 border border-brand-500/30">
                My ID: <span className="text-white font-mono">{data.my_id}</span>
              </span>
            ) : (
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30">
                No My ID Assigned
              </span>
            )}
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white/5 text-slate-400 border border-white/10">
              <Lock className="w-3 h-3 text-slate-500" />
              <span>Read-Only</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Immutable snapshot earnings ledger grouped by provider and completed offer rates.
          </p>
        </div>

        {/* Quick Filter Tabs & Month Selector Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Quick Filter Buttons: Today, This Month, All Time */}
          <div className="flex items-center bg-[#0c1015] border border-white/10 rounded-xl p-1 shadow-sm text-xs font-semibold">
            <button
              onClick={() => setSelectedMonth('today')}
              disabled={loading}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                activePeriod === 'today'
                  ? 'bg-brand-400 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setSelectedMonth('')}
              disabled={loading}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                activePeriod === 'this_month'
                  ? 'bg-brand-400 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setSelectedMonth('all')}
              disabled={loading}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                activePeriod === 'all'
                  ? 'bg-brand-400 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Time
            </button>
          </div>

          {/* Historical Month Selector */}
          <div className="flex items-center gap-2 bg-[#0c1015] border border-white/10 rounded-xl px-3 py-1.5 shadow-sm">
            <Calendar className="w-4 h-4 text-brand-400 shrink-0" />
            <select
              value={selectedMonth || data.selected_month || ''}
              onChange={handleMonthChange}
              disabled={loading}
              className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer pr-2"
              aria-label="Select month"
            >
              <option value="today" className="bg-[#0c1015] text-white">Today</option>
              {data.months && data.months.length > 0 ? (
                data.months.map((m) => (
                  <option key={m} value={m} className="bg-[#0c1015] text-white">
                    {formatMonthLabel(m)}
                  </option>
                ))
              ) : (
                <option value={data.selected_month || ''} className="bg-[#0c1015] text-white">
                  {formatMonthLabel(data.selected_month)}
                </option>
              )}
              <option value="all" className="bg-[#0c1015] text-white">All Time</option>
            </select>
          </div>

          {/* Export Excel Button */}
          <button
            onClick={handleExportExcel}
            disabled={loading || !data.items || data.items.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            title="Download Excel Spreadsheet"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Export Excel</span>
          </button>

          <button
            onClick={() => fetchEarnings(selectedMonth)}
            disabled={loading}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchEarnings(selectedMonth)}
            className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Top Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Offers */}
        <div className="p-4 rounded-2xl bg-[#0c1015]/80 border border-white/5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Offers</span>
            <div className="w-7 h-7 rounded-lg bg-brand-500/10 text-brand-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-white tracking-tight">
            {Number(data.summary?.total_offers || 0).toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Completed offers count</p>
        </div>

        {/* Card 2: Total Coins */}
        <div className="p-4 rounded-2xl bg-[#0c1015]/80 border border-white/5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Coins</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-amber-400 tracking-tight">
            {Number(data.summary?.total_coins || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Credited coins total</p>
        </div>

        {/* Card 3: Total USD */}
        <div className="p-4 rounded-2xl bg-[#0c1015]/80 border border-white/5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total USD</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-emerald-400 tracking-tight">
            ${Number(data.summary?.total_usd || 0).toFixed(2)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Calculated payout in USD</p>
        </div>

        {/* Card 4: Total BDT */}
        <div className="p-4 rounded-2xl bg-[#0c1015]/80 border border-white/5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total BDT</span>
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-cyan-400 tracking-tight">
            ৳{Number(data.summary?.total_bdt || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Converted at snapshot rates</p>
        </div>
      </div>

      {/* OFFER SUMMARY TABLE (AGGREGATE PER OFFER) */}
      <div className="rounded-2xl bg-[#0c1015]/80 border border-white/5 overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-brand-400" />
            <h2 className="text-sm font-bold text-white">Offer Summary Table — {formatMonthLabel(data.selected_month)}</h2>
            <span className="text-xs text-slate-500">
              ({offerSummary.length} {offerSummary.length === 1 ? 'offer' : 'offers'})
            </span>
          </div>
          <span className="text-xs text-slate-400">
            Grouped by Offer &amp; Provider
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/5 text-[11px] uppercase font-bold tracking-wider text-slate-400">
                <th className="py-3 px-4">Offer Name</th>
                <th className="py-3 px-4">Provider</th>
                <th className="py-3 px-4 text-center">Total Completed</th>
                <th className="py-3 px-4 text-right">Earnings (USD)</th>
                <th className="py-3 px-4 text-right">Earnings (BDT)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {loading && offerSummary.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-brand-400 mb-1" />
                    <span>Loading offer summary...</span>
                  </td>
                </tr>
              ) : offerSummary.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-500">
                    <Coins className="w-7 h-7 mx-auto mb-1 text-slate-600 opacity-40" />
                    <p className="font-semibold text-slate-400">No offer earnings recorded for this period</p>
                  </td>
                </tr>
              ) : (
                offerSummary.map((row, idx) => (
                  <tr key={`${row.provider}_${row.offer_name}_${idx}`} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 font-semibold text-white">
                      {row.offer_name}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-bold text-[11px]">
                        {row.provider}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-amber-400">
                      {row.total_completed.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                      ${Number(row.earnings_usd).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-cyan-300">
                      ৳{Number(row.earnings_bdt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Grouped Detail Table Card */}
      <div className="rounded-2xl bg-[#0c1015]/80 border border-white/5 overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-brand-400" />
            <h2 className="text-sm font-bold text-white">Detailed Offer Breakdown Table</h2>
            <span className="text-xs text-slate-500">
              ({items.length} {items.length === 1 ? 'group' : 'groups'})
            </span>
          </div>
          <span className="text-xs text-slate-400">
            Immutable snapshot rates
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/5 text-[11px] uppercase font-bold tracking-wider text-slate-400">
                <th className="py-3 px-4 w-12 text-center">SL</th>
                <th className="py-3 px-4">Wall / Provider</th>
                <th className="py-3 px-4">Offer Name / ID</th>
                <th className="py-3 px-4 text-right">Coins</th>
                <th className="py-3 px-4 text-center">Quantity</th>
                <th className="py-3 px-4 text-right">Rate (USD)</th>
                <th className="py-3 px-4 text-right">Rate (BDT)</th>
                <th className="py-3 px-4 text-right">Total USD</th>
                <th className="py-3 px-4 text-right">Total BDT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-brand-400 mb-1" />
                    <span>Loading detailed earnings...</span>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-500">
                    <Coins className="w-7 h-7 mx-auto mb-1 text-slate-600 opacity-40" />
                    <p className="font-semibold text-slate-400">No earnings recorded for this period</p>
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={`${row.provider}_${row.offer}_${row.coins}_${row.sl}`} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 text-center font-mono text-slate-500">
                      {row.sl}
                    </td>
                    <td className="py-3 px-4 font-bold text-white">
                      <span className="px-2 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                        {row.provider}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-white">
                      {row.offer}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                      {Number(row.coins).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-white">
                      <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                        {row.quantity}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-300">
                      ${Number(row.rate_usd).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-300">
                      ৳{Number(row.rate_bdt).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                      ${Number(row.total_usd).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-cyan-300">
                      ৳{Number(row.total_bdt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
