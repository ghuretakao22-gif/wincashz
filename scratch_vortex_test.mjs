export function getPostbackBaseUrl() {
  let cleanBase = 'http://127.0.0.1:5173';
  if (cleanBase.includes('127.0.0.1:5173') || cleanBase.includes('localhost:5173')) {
    cleanBase = cleanBase.replace(':5173', ':8000');
  }
  return cleanBase;
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

export function parseProviderDocsExample(urlStr, slug = 'provider') {
  let text = urlStr.trim();
  const pairs = [];

  let queryPart = text;
  const qIdx = text.indexOf('?');
  if (qIdx !== -1) {
    queryPart = text.substring(qIdx + 1);
  }

  const rawLines = queryPart.split(/[\&\r\n]+/);
  rawLines.forEach(line => {
    const l = line.trim();
    if (!l) return;
    if (l.includes('=')) {
      const [k, ...vParts] = l.split('=');
      pairs.push({ param: k.trim(), macro: vParts.join('=').trim() });
    }
  });

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

    if (cleanMacro) {
      for (const rule of fieldRules) {
        if (rule.exact.includes(cleanMacro) && !assignedFields.has(rule.field)) {
          matchedField = rule.field;
          assignedFields.add(rule.field);
          break;
        }
      }
    }

    if (!matchedField && lowerParam) {
      for (const rule of fieldRules) {
        if (rule.exact.includes(lowerParam) && !assignedFields.has(rule.field)) {
          matchedField = rule.field;
          assignedFields.add(rule.field);
          break;
        }
      }
    }

    if (!matchedField && cleanMacro) {
      for (const rule of fieldRules) {
        if (rule.keywords.some(k => cleanMacro.includes(k)) && !assignedFields.has(rule.field)) {
          matchedField = rule.field;
          assignedFields.add(rule.field);
          break;
        }
      }
    }

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

const vortexDocsUrl = "https://wincashz.com/postback/vortex?identity_id={IDENTITY_ID}&campaign_id={CAMPAIGN_ID}&campaign_name={CAMPAIGN_NAME}&event_id={EVENT_ID}&event_name={EVENT_NAME}&payout={PAYOUT}&points={POINTS}&txid={TXID}&result={RESULT}&ipaddr={IPADDR}&sub1={SUB1}&sub2={SUB2}&hash={HASH}";

const parsed = parseProviderDocsExample(vortexDocsUrl, 'vortex');

console.log("==================================================");
console.log("VORTEX PARSER DEDUPLICATION TEST");
console.log("==================================================");
console.log("Original Input:", vortexDocsUrl);
console.log("\nParsed Query Map Mappings:");
parsed.queryMap.forEach(m => console.log(`  ${m.param} (${m.macro}) -> ${m.field}`));
console.log("\nGenerated Output URL:");
console.log(parsed.generatedUrl);
