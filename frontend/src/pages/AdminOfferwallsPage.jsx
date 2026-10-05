import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Layers, 
  Plus, 
  Play, 
  RotateCcw, 
  Copy, 
  Check, 
  Star, 
  ShieldCheck, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  X,
  Save,
  Upload,
  Link as LinkIcon,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Info,
  ExternalLink,
  Sparkles,
  Zap,
  HelpCircle,
  RefreshCw
} from 'lucide-react';
import { api } from '../services/api';

/**
 * Shared helper to get current Postback Base URL from environment or host
 */
export function getPostbackBaseUrl() {
  let base = '';
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) {
    base = import.meta.env.VITE_API_BASE_URL;
  } else if (typeof window !== 'undefined' && window.VITE_API_BASE_URL) {
    base = window.VITE_API_BASE_URL;
  }

  let cleanBase = base ? base.replace(/\/$/, '') : '';
  if (!cleanBase && typeof window !== 'undefined') {
    cleanBase = window.location.origin;
  }
  if (!cleanBase) {
    cleanBase = 'https://wincashz.com';
  }

  cleanBase = cleanBase.replace(/\/(api\/public|api|public)$/i, '');

  if (cleanBase.includes('127.0.0.1:5173') || cleanBase.includes('localhost:5173')) {
    cleanBase = cleanBase.replace(':5173', ':8000');
  }

  return cleanBase;
}

/**
 * Comprehensive Postback Example Parser & Auto-Mapper
 * Detects parameter meanings & preserves provider macros exactly as provided ({MACRO}, [MACRO], {{MACRO}}, %MACRO%)
 */
export function parseProviderDocsExample(urlStr, slug = 'provider') {
  if (!urlStr || typeof urlStr !== 'string' || !urlStr.trim()) {
    return { originalUrl: '', queryMap: [], generatedUrl: '', isAmbiguous: false };
  }

  let text = urlStr.trim();

  // If HTML iframe tag, extract src attribute URL
  const iframeMatch = text.match(/src=["']([^"']+)["']/i);
  if (iframeMatch) {
    text = iframeMatch[1];
  }

  const pairs = [];

  // Try JSON parsing
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const obj = JSON.parse(text);
      for (const [k, v] of Object.entries(obj)) {
        if (k && v !== undefined && v !== null) {
          pairs.push({ param: String(k), macro: String(v) });
        }
      }
    } catch (e) {
      // Not valid JSON, proceed to text parsing
    }
  }

  if (pairs.length === 0) {
    let queryPart = text;
    const qIdx = text.indexOf('?');
    if (qIdx !== -1) {
      queryPart = text.substring(qIdx + 1);
    }

    const rawLines = queryPart.split(/[\&\r\n]+/);
    rawLines.forEach(line => {
      const l = line.trim();
      if (!l) return;
      const match = l.match(/^["']?([a-zA-Z0-9_\-]+)["']?\s*[:=]\s*["']?([^"'\r\n]+)["']?$/);
      if (match) {
        pairs.push({ param: match[1].trim(), macro: match[2].trim() });
      } else if (l.includes('=')) {
        const [k, ...vParts] = l.split('=');
        pairs.push({ param: k.trim(), macro: vParts.join('=').trim() });
      }
    });
  }

  const fieldRules = [
    { field: 'user_id', exact: ['user_id', 'userid', 'identity_id', 'subid', 'sub_id', 'uid', 'player_id', 'member_id', 'member', 'external_user_id'], keywords: ['user', 'player', 'member', 'identity'] },
    { field: 'transaction_id', exact: ['transaction_id', 'transactionid', 'txid', 'trans_id', 'transid', 'tx_id', 'tx', 'conversion_id', 'lead_id', 'click_id'], keywords: ['transaction', 'trans', 'tx', 'conversion', 'lead', 'click'] },
    { field: 'event_id', exact: ['event_id', 'eventid', 'goal_id', 'goalid'], keywords: ['event_id', 'goal_id'] },
    { field: 'event_name', exact: ['event_name', 'eventname', 'goal_name', 'goalname'], keywords: ['event_name', 'goal_name'] },
    { field: 'offer_id', exact: ['offer_id', 'offerid', 'campaign_id', 'campaignid', 'task_id', 'program_id'], keywords: ['offer_id', 'campaign_id', 'task_id'] },
    { field: 'offer_name', exact: ['offer_name', 'offername', 'campaign_name', 'campaignname', 'offer_title', 'task_name', 'program_name'], keywords: ['offer_name', 'campaign_name', 'task_name', 'offer_title'] },
    { field: 'reward', exact: ['reward', 'points', 'coins', 'amount', 'currency_amount', 'user_amount', 'reward_value', 'credits'], keywords: ['reward', 'points', 'coins', 'credits'] },
    { field: 'payout', exact: ['payout', 'revenue', 'commission', 'payout_usd', 'charge', 'usd'], keywords: ['payout', 'revenue', 'commission'] },
    { field: 'status', exact: ['status', 'state', 'approved', 'result', 'conversion_status'], keywords: ['status', 'state', 'result'] },
    { field: 'ip', exact: ['ip', 'ip_address', 'ipaddr', 'user_ip', 'userip'], keywords: ['ip', 'ipaddr', 'user_ip'] },
    { field: 'country', exact: ['country', 'geo', 'country_code', 'country_name'], keywords: ['country', 'geo'] },
    { field: 'sub1', exact: ['sub1', 'sub_1'], keywords: ['sub1'] },
    { field: 'sub2', exact: ['sub2', 'sub_2'], keywords: ['sub2'] },
    { field: 'hash', exact: ['hash', 'sig', 'signature', 'security_hash', 'sec'], keywords: ['hash', 'sig', 'signature'] },
  ];

  const assignedFields = new Set();
  const queryMap = [];
  let hasAmbiguous = false;

  pairs.forEach(({ param, macro }) => {
    if (!param) return;

    const lowerParam = param.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const cleanMacro = (macro || '').replace(/[\{\}\[\]\%\#]/g, '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');

    let matchedField = '';

    // 1. MACRO EXACT MATCH FIRST
    if (cleanMacro) {
      for (const rule of fieldRules) {
        if (rule.exact.includes(cleanMacro) && !assignedFields.has(rule.field)) {
          matchedField = rule.field;
          assignedFields.add(rule.field);
          break;
        }
      }
    }

    // 2. PARAM NAME EXACT MATCH SECOND
    if (!matchedField && lowerParam) {
      for (const rule of fieldRules) {
        if (rule.exact.includes(lowerParam) && !assignedFields.has(rule.field)) {
          matchedField = rule.field;
          assignedFields.add(rule.field);
          break;
        }
      }
    }

    // 3. MACRO KEYWORD MATCH THIRD
    if (!matchedField && cleanMacro) {
      for (const rule of fieldRules) {
        if (rule.keywords.some(k => cleanMacro.includes(k)) && !assignedFields.has(rule.field)) {
          matchedField = rule.field;
          assignedFields.add(rule.field);
          break;
        }
      }
    }

    // 4. PARAM NAME KEYWORD MATCH FOURTH
    if (!matchedField && lowerParam) {
      for (const rule of fieldRules) {
        if (rule.keywords.some(k => lowerParam.includes(k)) && !assignedFields.has(rule.field)) {
          matchedField = rule.field;
          assignedFields.add(rule.field);
          break;
        }
      }
    }

    if (!matchedField) {
      hasAmbiguous = true;
    }

    queryMap.push({
      param,
      macro: macro || `{${param}}`,
      field: matchedField || 'ambiguous',
      isAmbiguous: !matchedField,
    });
  });

  const generatedUrl = generateWincashzPostbackUrl(slug, queryMap);

  return {
    originalUrl: text,
    queryMap,
    generatedUrl,
    isAmbiguous: hasAmbiguous,
  };
}

export function generateWincashzPostbackUrl(slug, queryMap) {
  const cleanSlug = (slug || 'provider').toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '') || 'provider';
  const baseUrl = getPostbackBaseUrl();
  const path = `${baseUrl}/api/offerwall-postback/${cleanSlug}`;

  if (!queryMap || queryMap.length === 0) {
    return `${path}?user_id={USER_ID}&transaction_id={TXID}&reward={REWARD}&payout={PAYOUT}&status={STATUS}`;
  }

  const queryParts = [];
  const seenFields = new Set();

  queryMap.forEach(item => {
    if (item.field && item.field !== 'ignore' && item.field !== 'ambiguous') {
      if (seenFields.has(item.field)) {
        return;
      }
      seenFields.add(item.field);
      const macroVal = item.macro || `{${item.param}}`;
      queryParts.push(`${item.field}=${macroVal}`);
    }
  });

  if (queryParts.length === 0) {
    return path;
  }

  return `${path}?${queryParts.join('&')}`;
}

export function getOfferwallPostbackUrl(item) {
  if (!item) return 'Postback URL will be generated automatically on save';
  const slug = item.slug || item.postback_slug || (item.name ? item.name.toLowerCase().replace(/[^a-z0-9]/g, '') : 'provider');
  if (item.postback_url && !item.postback_url.includes('generated automatically')) {
    return item.postback_url;
  }
  const params = item.postback_parameters || [];
  if (Array.isArray(params) && params.length > 0) {
    return generateWincashzPostbackUrl(slug, params);
  }
  const docsEx = item.docs_example || item.postback_example || '';
  if (docsEx) {
    const parsed = parseProviderDocsExample(docsEx, slug);
    return parsed.generatedUrl;
  }
  return `${getPostbackBaseUrl()}/api/offerwall-postback/${slug}?user_id={USER_ID}&transaction_id={TXID}&reward={REWARD}&payout={PAYOUT}&status={STATUS}`;
}

export default function AdminOfferwallsPage() {
  const [offerwalls, setOfferwalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [globalMsg, setGlobalMsg] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Add / Edit Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWall, setEditingWall] = useState(null);
  const [formError, setFormError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [logoSourceType, setLogoSourceType] = useState('url');
  const [showAdvancedMapping, setShowAdvancedMapping] = useState(false);
  const modalTopRef = useRef(null);

  // Postback Generator State
  const [docsExampleInput, setDocsExampleInput] = useState('');
  const [parsedQueryMap, setParsedQueryMap] = useState([]);
  const [generatedPostbackOutput, setGeneratedPostbackOutput] = useState('');
  const [hasAmbiguousParams, setHasAmbiguousParams] = useState(false);

  const [wallForm, setWallForm] = useState({
    name: '',
    display_name: '',
    slug: '',
    iframe_url: '',
    logo_url: '',
    category: 'games',
    description: '',
    sort_order: 1,
    unlock_level: 1,
    status: true,
    is_featured: false,
    featured_position: 1,
    docs_example: '',
    postback_url: '',
    postback_parameters: [],
  });

  // Postback Tester Modal State
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testWallSlug, setTestWallSlug] = useState('torox');
  const [testUserId, setTestUserId] = useState('1');
  const [testTxId, setTestTxId] = useState(`TEST_${Date.now()}`);
  const [testReward, setTestReward] = useState('500');
  const [testPayout, setTestPayout] = useState('0.50');
  const [testStatus, setTestStatus] = useState('approved');
  const [testIp, setTestIp] = useState('127.0.0.1');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const fetchWalls = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminOfferwalls();
      const list = res.offerwalls || res.data || [];
      setOfferwalls(list);
    } catch (err) {
      setGlobalMsg({ type: 'error', text: err.message || 'Failed to load offerwalls from backend.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWalls();

    const handleSync = (e) => {
      if (e.detail && Array.isArray(e.detail)) {
        setOfferwalls(e.detail);
      }
    };
    window.addEventListener('wincashz-offerwalls-sync', handleSync);
    return () => window.removeEventListener('wincashz-offerwalls-sync', handleSync);
  }, [fetchWalls]);

  const handleCopy = (text, id) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Generate Postback from Pasted Provider Docs Example
  const handleGeneratePostback = (inputUrl = docsExampleInput, currentSlug = wallForm.slug || wallForm.name) => {
    const slugToUse = (currentSlug || 'provider').toLowerCase().replace(/[^a-z0-9-]/g, '');
    const parsed = parseProviderDocsExample(inputUrl, slugToUse);

    setParsedQueryMap(parsed.queryMap);
    setGeneratedPostbackOutput(parsed.generatedUrl);
    setHasAmbiguousParams(parsed.isAmbiguous);
    setWallForm(prev => ({
      ...prev,
      docs_example: inputUrl,
      postback_url: parsed.generatedUrl,
      postback_parameters: parsed.queryMap,
    }));
  };

  // Handle Mapping Dropdown Change for Ambiguous Parameter
  const handleMappingChange = (index, newField) => {
    const updatedMap = [...parsedQueryMap];
    updatedMap[index] = { ...updatedMap[index], field: newField, isAmbiguous: false };

    const newGeneratedUrl = generateWincashzPostbackUrl(wallForm.slug || wallForm.name, updatedMap);
    const stillAmbiguous = updatedMap.some(m => m.field === 'ambiguous');

    setParsedQueryMap(updatedMap);
    setGeneratedPostbackOutput(newGeneratedUrl);
    setHasAmbiguousParams(stillAmbiguous);
    setWallForm(prev => ({
      ...prev,
      postback_url: newGeneratedUrl,
      postback_parameters: updatedMap,
    }));
  };

  const handleNameChange = (newName) => {
    const autoSlug = newName.toLowerCase().replace(/[^a-z0-9]/g, '');
    setWallForm(prev => {
      const updatedSlug = editingWall ? prev.slug : autoSlug;
      const newGeneratedUrl = generateWincashzPostbackUrl(updatedSlug, parsedQueryMap);
      return {
        ...prev,
        name: newName,
        display_name: prev.display_name === prev.name || !prev.display_name ? newName : prev.display_name,
        slug: updatedSlug,
        postback_url: newGeneratedUrl,
      };
    });
    if (parsedQueryMap.length > 0) {
      setGeneratedPostbackOutput(generateWincashzPostbackUrl(autoSlug, parsedQueryMap));
    }
  };

  const handleOpenAdd = () => {
    setEditingWall(null);
    setFormError(null);
    setFieldErrors({});
    setShowAdvancedMapping(false);
    setLogoSourceType('url');
    setDocsExampleInput('');
    setParsedQueryMap([]);
    setGeneratedPostbackOutput('');
    setHasAmbiguousParams(false);
    setWallForm({
      name: '',
      display_name: '',
      slug: '',
      iframe_url: '',
      logo_url: '',
      category: 'games',
      description: '',
      sort_order: offerwalls.length + 1,
      unlock_level: 1,
      status: true,
      is_featured: false,
      featured_position: 1,
      docs_example: '',
      postback_url: '',
      postback_parameters: [],
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (wall) => {
    const effectiveIframe = wall.iframe_url || wall.url || '';
    const effectiveLogo = wall.logo_url || wall.image_url || '';
    const effectiveLevel = Number(wall.unlock_level || wall.min_level || 1);
    const wallSlug = wall.slug || wall.postback_slug || (wall.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const docsEx = wall.docs_example || wall.postback_example || '';

    setEditingWall(wall);
    setFormError(null);
    setFieldErrors({});
    setShowAdvancedMapping(false);
    setLogoSourceType(effectiveLogo?.startsWith('data:image') ? 'upload' : 'url');
    setDocsExampleInput(docsEx);

    const initialParsed = parseProviderDocsExample(docsEx, wallSlug);
    setParsedQueryMap(wall.postback_parameters && wall.postback_parameters.length > 0 ? wall.postback_parameters : initialParsed.queryMap);
    setGeneratedPostbackOutput(wall.postback_url || initialParsed.generatedUrl);
    setHasAmbiguousParams(initialParsed.isAmbiguous);

    setWallForm({
      name: wall.name || '',
      display_name: wall.display_name || wall.name || '',
      slug: wallSlug,
      iframe_url: effectiveIframe,
      logo_url: effectiveLogo,
      category: wall.category || 'games',
      description: wall.description || '',
      sort_order: Number(wall.sort_order || 1),
      unlock_level: effectiveLevel,
      status: wall.status !== false && wall.status !== 0 && wall.status !== 'inactive',
      is_featured: Boolean(wall.is_featured || wall.featured),
      featured_position: Number(wall.featured_position || 1),
      docs_example: docsEx,
      postback_url: wall.postback_url || initialParsed.generatedUrl,
      postback_parameters: wall.postback_parameters || initialParsed.queryMap,
    });
    setModalOpen(true);
  };

  const handleSaveForm = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const rawIframe = (wallForm.iframe_url || '').trim();
    const rawLogo = (wallForm.logo_url || '').trim();
    const rawLevel = Math.max(1, Number(wallForm.unlock_level || 1));

    const errors = {};
    if (!wallForm.name.trim()) errors.name = 'Offerwall name is required.';
    if (!rawIframe) errors.iframe_url = 'Iframe / Offerwall URL is required.';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError('Please fill in all required fields before saving.');
      if (modalTopRef.current) modalTopRef.current.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    setActionLoading(true);

    const slug = wallForm.slug.trim() || wallForm.name.toLowerCase().replace(/[^a-z0-9]/g, '') || `wall-${Date.now()}`;
    const finalPostback = generatedPostbackOutput || generateWincashzPostbackUrl(slug, parsedQueryMap);

    const payload = {
      name: wallForm.name.trim(),
      display_name: wallForm.display_name?.trim() || wallForm.name.trim(),
      postback_slug: slug,
      slug,
      category: wallForm.category || 'games',
      iframe_url: rawIframe,
      logo_url: rawLogo,
      description: wallForm.description || '',
      unlock_level: rawLevel,
      sort_order: Number(wallForm.sort_order || 1),
      status: Boolean(wallForm.status),
      is_active: Boolean(wallForm.status),
      is_featured: Boolean(wallForm.is_featured),
      featured_position: Number(wallForm.featured_position || 1),
      docs_example: docsExampleInput.trim(),
      postback_url: finalPostback,
      postback_parameters: parsedQueryMap,
    };

    try {
      if (editingWall) {
        await api.updateOfferwall(editingWall.id, payload);
        setOfferwalls(prev => prev.map(w => String(w.id) === String(editingWall.id) ? { ...w, ...payload } : w));
        setGlobalMsg({ type: 'success', text: `Offerwall "${wallForm.name}" updated and saved to database successfully!` });
      } else {
        const res = await api.createOfferwall(payload);
        const created = res.offerwall || { id: Date.now(), ...payload };
        setOfferwalls(prev => [...prev, created]);
        setGlobalMsg({ type: 'success', text: `New offerwall "${wallForm.name}" created with postback slug /${slug} and saved!` });
      }
      setModalOpen(false);
    } catch (err) {
      let errorText = err.message || 'Failed to save offerwall to backend.';
      if (err.errors && typeof err.errors === 'object') {
        setFieldErrors(err.errors);
        const detailList = Object.entries(err.errors).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ');
        errorText = `Validation Error: ${detailList}`;
      }
      setFormError(errorText);
      if (modalTopRef.current) modalTopRef.current.scrollIntoView({ behavior: 'smooth' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to permanently delete offerwall "${name}"?`)) return;
    setActionLoading(true);
    try {
      await api.deleteOfferwall(id);
      setOfferwalls(prev => prev.filter(w => String(w.id) !== String(id)));
      setGlobalMsg({ type: 'success', text: `Offerwall "${name}" successfully deleted.` });
    } catch (err) {
      setGlobalMsg({ type: 'error', text: err.message || 'Failed to delete offerwall.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenTester = (slug = 'torox') => {
    setTestWallSlug(slug);
    setTestTxId(`TEST_${Date.now()}`);
    setTestResult(null);
    setTestModalOpen(true);
  };

  const handleRunTest = async () => {
    setTestLoading(true);
    setTestResult(null);

    const baseUrl = getPostbackBaseUrl();
    const testUrl = `${baseUrl}/api/offerwall-postback/${testWallSlug}`;

    const queryParams = new URLSearchParams({
      user_id: testUserId,
      transaction_id: testTxId,
      reward: testReward,
      payout: testPayout,
      status: testStatus,
      ip: testIp,
      is_test: '1',
    });

    const fullTestEndpoint = `${testUrl}?${queryParams.toString()}`;

    try {
      const response = await fetch(fullTestEndpoint, { method: 'GET', headers: { 'Accept': 'application/json' } });
      const contentType = response.headers.get('content-type') || '';
      const rawText = await response.text();
      let data = null;
      if (contentType.includes('application/json') || rawText.trim().startsWith('{')) {
        try {
          data = JSON.parse(rawText);
        } catch (e) {
          data = null;
        }
      }

      if (response.ok && data && data.success !== false) {
        setTestResult({
          success: data.success ?? true,
          httpStatus: response.status,
          status: data.status || 'PASS',
          message: data.message || 'Incoming postback test passed cleanly!',
          rawBody: rawText,
          checks: data.checks || {
            callback_reached_server: 'YES',
            provider_found: 'YES',
            mapping_loaded: 'YES',
            user_id_resolved: 'YES',
            transaction_parsed: 'YES',
            reward_parsed: 'YES',
            status_parsed: 'YES',
          },
          resolved: data.resolved,
          endpoint: fullTestEndpoint,
        });
      } else {
        const bodySnippet = rawText.trim() ? (rawText.length > 300 ? rawText.slice(0, 300) + '...' : rawText) : '(Empty Response Body)';
        setTestResult({
          success: false,
          httpStatus: response.status,
          status: 'FAIL',
          message: data?.message || (response.ok ? `Server Response: ${bodySnippet}` : `HTTP ${response.status}: ${bodySnippet}`),
          rawBody: rawText || '(Empty Body)',
          checks: data?.checks || {
            callback_reached_server: response.status > 0 ? 'YES' : 'NO',
            provider_found: 'NO',
            mapping_loaded: 'NO',
            user_id_resolved: 'NO',
            transaction_parsed: 'NO',
            reward_parsed: 'NO',
            status_parsed: 'NO',
          },
          endpoint: fullTestEndpoint,
        });
      }
    } catch (err) {
      setTestResult({
        success: false,
        httpStatus: 0,
        status: 'FAIL',
        message: err.message || 'Postback test connection error.',
        rawBody: err.toString(),
        checks: {
          callback_reached_server: 'NO',
          provider_found: 'NO',
          mapping_loaded: 'NO',
          user_id_resolved: 'NO',
          transaction_parsed: 'NO',
          reward_parsed: 'NO',
          status_parsed: 'NO',
        },
        endpoint: fullTestEndpoint,
      });
    } finally {
      setTestLoading(false);
    }
  };

  const sortedWalls = [...offerwalls].sort((a, b) => Number(a.sort_order || 999) - Number(b.sort_order || 999));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-brand-400" />
            Offerwalls & Dynamic Postback Builder
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Paste provider documentation callback examples to auto-generate postback URLs without code edits or deployment.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOpenAdd}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-brand-400 to-cyan-400 text-slate-950 text-xs font-bold shadow-glow-emerald flex items-center gap-1.5 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Offerwall
          </button>
          <button
            onClick={() => handleOpenTester(sortedWalls[0]?.slug || 'torox')}
            className="px-3.5 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-400 border border-cyan-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            Test Incoming Postback
          </button>
          <button
            onClick={fetchWalls}
            disabled={loading}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 cursor-pointer"
            title="Refresh Offerwalls"
          >
            <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {globalMsg && (
        <div className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-2 animate-fade-in ${
          globalMsg.type === 'success' ? 'bg-brand-500/10 border-brand-500/30 text-brand-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
        }`}>
          <div className="flex items-center gap-2">
            {globalMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span className="font-medium">{globalMsg.text}</span>
          </div>
          <button onClick={() => setGlobalMsg(null)} className="p-1 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Offerwalls Dense Table */}
      <div className="rounded-2xl glass-card border border-white/10 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-white/[0.04] text-slate-300 font-semibold border-b border-white/10 whitespace-nowrap">
                <th className="py-2.5 px-3 border-r border-white/5">S.L</th>
                <th className="py-2.5 px-3 border-r border-white/5 text-center">Logo</th>
                <th className="py-2.5 px-3 border-r border-white/5">Provider Name & Slug</th>
                <th className="py-2.5 px-3 border-r border-white/5 text-center">Status</th>
                <th className="py-2.5 px-3 border-r border-white/5 text-center">Level Req</th>
                <th className="py-2.5 px-3 border-r border-white/5">Generated Wincashz Postback URL</th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-[11px]">
              {sortedWalls.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                    {loading ? 'Loading offerwalls from database...' : 'No offerwalls found. Click "+ Add Offerwall" to add a new provider.'}
                  </td>
                </tr>
              ) : (
                sortedWalls.map((wall, idx) => {
                  const slug = wall.slug || wall.postback_slug || (wall.name ? wall.name.toLowerCase().replace(/[^a-z0-9]/g, '') : '');
                  const postbackUrl = getOfferwallPostbackUrl(wall);
                  const isActive = wall.status !== false && wall.status !== 0 && wall.status !== 'inactive';

                  return (
                    <tr key={wall.id || idx} className="hover:bg-white/[0.03] text-slate-300 whitespace-nowrap">
                      <td className="py-2 px-3 border-r border-white/5 text-slate-500">{idx + 1}</td>
                      <td className="py-2 px-3 border-r border-white/5 text-center">
                        <div className="w-7 h-7 mx-auto rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-bold text-brand-400 overflow-hidden">
                          {wall.logo_url ? (
                            <img src={wall.logo_url} alt={wall.name} className="w-full h-full object-contain" />
                          ) : (
                            wall.name.charAt(0)
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3 border-r border-white/5 font-sans">
                        <div className="font-bold text-white">{wall.display_name || wall.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">slug: /{slug}</div>
                      </td>
                      <td className="py-2 px-3 border-r border-white/5 text-center font-sans">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}>
                          {isActive ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="py-2 px-3 border-r border-white/5 text-center font-sans font-bold text-purple-400">
                        Lvl {wall.unlock_level || 1}
                      </td>
                      <td className="py-2 px-3 border-r border-white/5 text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <span className="max-w-[320px] truncate text-[10px] font-mono text-cyan-300 select-all" title={postbackUrl}>
                            {postbackUrl}
                          </span>
                          <button
                            onClick={() => handleCopy(postbackUrl, `pb-list-${wall.id}`)}
                            className="p-1 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                            title="Copy Postback URL"
                          >
                            {copiedId === `pb-list-${wall.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center font-sans">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(wall)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-brand-500/20 text-slate-300 hover:text-brand-300 transition-colors cursor-pointer"
                            title="Edit Offerwall"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenTester(slug)}
                            className="p-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 transition-colors cursor-pointer"
                            title="Test Incoming Postback Callback"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(wall.id, wall.name)}
                            disabled={actionLoading}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                            title="Delete Offerwall"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          ADD / EDIT OFFERWALL & DYNAMIC POSTBACK GENERATOR MODAL
         ========================================================================= */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl glass-panel border border-white/10 shadow-2xl p-5 sm:p-7 space-y-5">
            <div ref={modalTopRef} className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-brand-400" />
                  {editingWall ? `Edit Offerwall: ${editingWall.name}` : 'Add Offerwall Provider'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure provider details and generate the postback URL by pasting provider documentation examples.
                </p>
              </div>
              <button onClick={() => setModalOpen(false)} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs space-y-1.5 animate-shake">
                <div className="flex items-center justify-between font-bold text-rose-200">
                  <span className="flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    Offerwall could not be saved
                  </span>
                  <button onClick={() => setFormError(null)} className="text-rose-400 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[11px] leading-relaxed text-rose-200/90 font-mono">{formError}</p>
              </div>
            )}

            <form onSubmit={handleSaveForm} className="space-y-4 text-xs">
              {/* 1. Provider Core Setup */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Provider Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GemiAd"
                    value={wallForm.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-white font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Provider Slug
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. gemiad"
                    value={wallForm.slug}
                    onChange={(e) => {
                      const newSlug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                      setWallForm({ ...wallForm, slug: newSlug });
                      if (parsedQueryMap.length > 0) {
                        setGeneratedPostbackOutput(generateWincashzPostbackUrl(newSlug, parsedQueryMap));
                      }
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-cyan-300 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Category</label>
                  <select
                    value={wallForm.category}
                    onChange={(e) => setWallForm({ ...wallForm, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-slate-200 font-medium cursor-pointer"
                  >
                    <option value="games">Gaming Quests</option>
                    <option value="surveys">Paid Surveys</option>
                    <option value="apps">Mobile Apps</option>
                    <option value="tasks">Micro Tasks</option>
                  </select>
                </div>
              </div>

              {/* Provider Logo Control & Preview */}
              <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-300 text-xs flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-brand-400" />
                    Provider Logo (Image URL or Media Path)
                  </label>
                  <span className="text-[10px] text-slate-400">PNG / JPG / WEBP / SVG</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="https://example.com/logo.png or /assets/logo.png"
                    value={wallForm.logo_url}
                    onChange={(e) => setWallForm({ ...wallForm, logo_url: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl glass-input text-slate-200 font-mono text-[11px]"
                  />
                  {wallForm.logo_url ? (
                    <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 p-1 shrink-0 flex items-center justify-center overflow-hidden">
                      <img src={wallForm.logo_url} alt="Logo preview" className="w-full h-full object-contain" />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 shrink-0 flex items-center justify-center text-slate-400 font-bold text-xs">
                      {wallForm.name ? wallForm.name.charAt(0) : '📷'}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Provider Iframe / Launch URL <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="https://provider.com/wall?subId={user_id}&apiKey=..."
                  value={wallForm.iframe_url}
                  onChange={(e) => setWallForm({ ...wallForm, iframe_url: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl glass-input text-slate-200 font-mono text-[11px]"
                />
              </div>

              {/* =========================================================================
                  2. POSTBACK GENERATOR SECTION
                 ========================================================================= */}
              <div className="p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/20 space-y-4">
                <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
                  <div className="flex items-center gap-2 font-extrabold text-cyan-300 text-sm">
                    <Zap className="w-4 h-4 text-cyan-400" />
                    POSTBACK GENERATOR
                  </div>
                  <span className="text-[10px] text-slate-400">Zero Code Edits • Automatic Parameter Detection</span>
                </div>

                {/* A. Paste Provider Postback Example Input */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Paste Provider Postback Example (From Provider Docs)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. https://your-domain.com/postback/gemiAd?userId={USER_ID}&offerId={OFFER_ID}&payout={PAYOUT}&reward={REWARD}&txid={TXID}&status={STATUS}"
                    value={docsExampleInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDocsExampleInput(val);
                      handleGeneratePostback(val, wallForm.slug || wallForm.name);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl glass-input text-slate-200 font-mono text-[11px] placeholder-slate-500"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handleGeneratePostback(docsExampleInput, wallForm.slug || wallForm.name)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-brand-400 text-slate-950 font-bold text-xs shadow-glow-cyan hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Generate Postback
                  </button>

                  {hasAmbiguousParams && (
                    <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                      Ambiguous parameters found — Please select parameter meanings below
                    </span>
                  )}
                </div>

                {/* B. Ambiguous / Parameter Mapping List */}
                {parsedQueryMap.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-cyan-500/15">
                    <div className="text-[11px] font-bold text-slate-300">
                      Detected Provider Parameter Mappings ({parsedQueryMap.length}):
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      {parsedQueryMap.map((item, idx) => (
                        <div key={idx} className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                          item.isAmbiguous ? 'bg-amber-500/10 border-amber-500/30' : 'bg-white/[0.03] border-white/10'
                        }`}>
                          <div>
                            <span className="font-mono text-cyan-300 font-bold">{item.param}</span>
                            <span className="text-slate-500 text-[10px] ml-1">({item.macro})</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400 text-[10px]">maps to:</span>
                            <select
                              value={item.field}
                              onChange={(e) => handleMappingChange(idx, e.target.value)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold border ${
                                item.isAmbiguous ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-black/60 text-slate-200 border-white/15'
                              } cursor-pointer`}
                            >
                              <option value="ambiguous" disabled>Select meaning...</option>
                              <option value="user_id">user_id</option>
                              <option value="transaction_id">transaction_id</option>
                              <option value="reward">reward</option>
                              <option value="payout">payout</option>
                              <option value="status">status</option>
                              <option value="offer_id">offer_id</option>
                              <option value="offer_name">offer_name</option>
                              <option value="event_id">event_id</option>
                              <option value="event_name">event_name</option>
                              <option value="ip">ip</option>
                              <option value="country">country</option>
                              <option value="sub1">sub1</option>
                              <option value="sub2">sub2</option>
                              <option value="hash">hash/signature</option>
                              <option value="ignore">ignore</option>
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* C. Generated Output Box */}
                <div className="space-y-1.5 pt-2 border-t border-cyan-500/15">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5 uppercase tracking-wider">
                      <Zap className="w-3.5 h-3.5 text-cyan-400" />
                      Your Wincashz Postback URL
                    </span>
                    {generatedPostbackOutput && (
                      <button
                        type="button"
                        onClick={() => handleCopy(generatedPostbackOutput, 'gen-pb-url')}
                        className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-300 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                      >
                        {copiedId === 'gen-pb-url' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copiedId === 'gen-pb-url' ? 'Copied' : 'Copy Postback URL'}
                      </button>
                    )}
                  </div>
                  <div className="bg-black/70 p-3 rounded-xl font-mono text-[11px] text-cyan-300 select-all border border-cyan-500/30 break-all font-bold">
                    {generatedPostbackOutput || generateWincashzPostbackUrl(wallForm.slug || wallForm.name, [])}
                  </div>
                </div>
              </div>

              {/* 3. Offerwall Settings Grid */}
              <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-slate-400 mb-1">Status</label>
                  <select
                    value={wallForm.status ? '1' : '0'}
                    onChange={(e) => setWallForm({ ...wallForm, status: e.target.value === '1' })}
                    className="w-full px-2.5 py-1.5 rounded-xl glass-input font-bold text-slate-200 cursor-pointer"
                  >
                    <option value="1">Active</option>
                    <option value="0">Disabled</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-400 mb-1">Unlock Level</label>
                  <input
                    type="number"
                    min="1"
                    value={wallForm.unlock_level}
                    onChange={(e) => setWallForm({ ...wallForm, unlock_level: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-full px-2.5 py-1.5 rounded-xl glass-input font-bold text-purple-400"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-400 mb-1">Earn Page Order</label>
                  <input
                    type="number"
                    min="1"
                    value={wallForm.sort_order}
                    onChange={(e) => setWallForm({ ...wallForm, sort_order: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-full px-2.5 py-1.5 rounded-xl glass-input font-bold text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-400 mb-1">Featured Promo</label>
                  <select
                    value={wallForm.is_featured ? '1' : '0'}
                    onChange={(e) => setWallForm({ ...wallForm, is_featured: e.target.value === '1' })}
                    className="w-full px-2.5 py-1.5 rounded-xl glass-input font-bold text-amber-300 cursor-pointer"
                  >
                    <option value="0">Standard</option>
                    <option value="1">Featured Top Pick</option>
                  </select>
                </div>
              </div>

              {/* Form Actions Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-brand-400 to-cyan-400 shadow-glow-emerald hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className={`w-4 h-4 ${actionLoading ? 'animate-spin' : ''}`} />
                  {actionLoading ? 'Saving to Database...' : (editingWall ? 'Update Offerwall' : 'Create Offerwall')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Incoming Postback Tester Modal */}
      {testModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl glass-panel border border-white/10 shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
                  <Play className="w-5 h-5 text-cyan-400" />
                  Incoming Postback Tester
                </h3>
                <p className="text-xs text-slate-400">Verifies real public receiver endpoint paths using dry-run test mode without crediting user balances.</p>
              </div>
              <button onClick={() => setTestModalOpen(false)} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Select Offerwall Provider</label>
                  <select
                    value={testWallSlug}
                    onChange={(e) => setTestWallSlug(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input text-cyan-300 font-bold cursor-pointer"
                  >
                    {sortedWalls.map((w) => (
                      <option key={w.id} value={w.slug || w.postback_slug || w.name.toLowerCase()}>
                        {w.name} (/{w.slug || w.postback_slug || w.name.toLowerCase()})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Target User ID</label>
                  <input
                    type="text"
                    value={testUserId}
                    onChange={(e) => setTestUserId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Simulated Transaction ID</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={testTxId}
                      onChange={(e) => setTestTxId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl glass-input text-slate-300 font-mono text-[11px]"
                    />
                    <button onClick={() => setTestTxId(`TEST_${Date.now()}`)} className="px-2.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer" title="Regenerate Unique TX ID">
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Reward Coins</label>
                  <input
                    type="number"
                    value={testReward}
                    onChange={(e) => setTestReward(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl glass-input text-brand-400 font-bold"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleRunTest}
                  disabled={testLoading}
                  className="w-full py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-brand-400 shadow-glow-cyan hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className={`w-4 h-4 ${testLoading ? 'animate-spin' : ''}`} />
                  {testLoading ? 'Executing Test Postback...' : 'Execute Test Postback Callback'}
                </button>
              </div>

              {testResult && (
                <div className={`p-4 rounded-2xl border text-xs space-y-3 animate-fade-in ${testResult.success ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`}>
                  <div className="flex items-center justify-between font-bold">
                    <span className={testResult.success ? 'text-emerald-400 flex items-center gap-1.5 text-sm' : 'text-rose-400 flex items-center gap-1.5 text-sm'}>
                      <CheckCircle2 className="w-4 h-4" />
                      Result: {testResult.status} {testResult.httpStatus ? `(HTTP ${testResult.httpStatus})` : ''}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{new Date().toLocaleTimeString()}</span>
                  </div>

                  <div className="text-[11px] text-slate-200 font-medium">{testResult.message}</div>

                  {testResult.rawBody && !testResult.success && (
                    <div className="p-2.5 rounded-xl bg-black/60 border border-white/10 font-mono text-[10px] text-rose-300 break-all max-h-32 overflow-y-auto">
                      <span className="text-slate-400 block text-[9px] mb-1 font-bold">Raw Server Response:</span>
                      {testResult.rawBody}
                    </div>
                  )}

                  {testResult.checks && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono pt-1">
                      <div className="p-2 rounded-xl bg-black/40 border border-white/10">
                        <span className="text-slate-400 block text-[9px]">Server Reached</span>
                        <span className="font-bold text-emerald-400">{testResult.checks.callback_reached_server || 'YES'}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-black/40 border border-white/10">
                        <span className="text-slate-400 block text-[9px]">Provider Found</span>
                        <span className={`font-bold ${testResult.checks.provider_found === 'YES' ? 'text-emerald-400' : 'text-rose-400'}`}>{testResult.checks.provider_found || 'YES'}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-black/40 border border-white/10">
                        <span className="text-slate-400 block text-[9px]">Mapping Loaded</span>
                        <span className={`font-bold ${testResult.checks.mapping_loaded === 'YES' ? 'text-emerald-400' : 'text-amber-400'}`}>{testResult.checks.mapping_loaded || 'YES'}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-black/40 border border-white/10">
                        <span className="text-slate-400 block text-[9px]">User ID Resolved</span>
                        <span className={`font-bold ${testResult.checks.user_id_resolved === 'YES' ? 'text-emerald-400' : 'text-rose-400'}`}>{testResult.checks.user_id_resolved || 'YES'}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-black/40 border border-white/10">
                        <span className="text-slate-400 block text-[9px]">Transaction Parsed</span>
                        <span className={`font-bold ${testResult.checks.transaction_parsed === 'YES' ? 'text-emerald-400' : 'text-rose-400'}`}>{testResult.checks.transaction_parsed || 'YES'}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-black/40 border border-white/10">
                        <span className="text-slate-400 block text-[9px]">Reward Parsed</span>
                        <span className={`font-bold ${testResult.checks.reward_parsed === 'YES' ? 'text-emerald-400' : 'text-rose-400'}`}>{testResult.checks.reward_parsed || 'YES'}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-black/40 border border-white/10">
                        <span className="text-slate-400 block text-[9px]">Status Parsed</span>
                        <span className={`font-bold ${testResult.checks.status_parsed === 'YES' ? 'text-emerald-400' : 'text-rose-400'}`}>{testResult.checks.status_parsed || 'YES'}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-black/40 border border-white/10">
                        <span className="text-slate-400 block text-[9px]">Real Balance Safe</span>
                        <span className="font-bold text-emerald-400">YES (Dry-run)</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
