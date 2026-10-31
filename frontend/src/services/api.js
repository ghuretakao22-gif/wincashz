const getApiBase = () => {
  let base = '';
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) {
    base = import.meta.env.VITE_API_BASE_URL;
  } else if (typeof window !== 'undefined' && window.VITE_API_BASE_URL) {
    base = window.VITE_API_BASE_URL;
  }

  if (base) {
    let cleanBase = base.replace(/\/$/, '');
    cleanBase = cleanBase.replace(/\/(api\/public|api|public)$/i, '');
    return `${cleanBase}/api`;
  }

  return '/api';
};

const API_BASE = getApiBase();

/**
 * Get stored auth token
 */
export function getStoredToken() {
  return localStorage.getItem('wincashz_token') || sessionStorage.getItem('wincashz_token');
}

/**
 * Canonical helper to resolve provider/numeric user ID safely
 */
export function getProviderUserId(u) {
  if (!u) return '';
  return u.id ?? u.user_id ?? '';
}

/**
 * Set stored auth token
 */
export function setStoredToken(token, remember = true) {
  if (!token) {
    localStorage.removeItem('wincashz_token');
    sessionStorage.removeItem('wincashz_token');
    return;
  }
  if (remember) {
    localStorage.setItem('wincashz_token', token);
  } else {
    sessionStorage.setItem('wincashz_token', token);
  }
}

/**
 * Clean and serialize query parameters safely, stripping out undefined, null, and empty values.
 */
export function cleanQueryParams(params = {}) {
  const clean = {};
  for (const [key, value] of Object.entries(params)) {
    if (
      value !== undefined &&
      value !== null &&
      value !== '' &&
      value !== 'undefined' &&
      value !== 'null'
    ) {
      clean[key] = value;
    }
  }
  const q = new URLSearchParams(clean).toString();
  return q ? `?${q}` : '';
}

/**
 * Core API fetch wrapper
 */
export async function apiRequest(endpoint, options = {}) {
  const token = getStoredToken();
  const headers = {
    'Accept': 'application/json',
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    let data = {};
    const text = await response.text().catch(() => '');
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { message: text.slice(0, 300) || `Request failed with HTTP status ${response.status}` };
    }

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired or invalid
        setStoredToken(null);
      }
      const validationMsgs = data.errors && typeof data.errors === 'object'
        ? Object.values(data.errors).flat().filter(Boolean).join(' ')
        : null;
      const errorMsg = validationMsgs || data.message || data.error || `Request failed with status ${response.status}`;
      const error = new Error(errorMsg);
      error.status = response.status;
      error.errors = data.errors || {};
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    throw err;
  }
}

/* =========================================================================
   REAL BACKEND API COMMUNICATION LAYER
   ========================================================================= */

/**
 * Parse response shapes from GET /api/admin/users
 */
export function parseUsersResponse(res) {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.users)) return res.users;
  if (res.users && Array.isArray(res.users.data)) return res.users.data;
  if (Array.isArray(res.data)) return res.data;
  if (res.data && Array.isArray(res.data.data)) return res.data.data;
  if (Array.isArray(res.rows)) return res.rows;
  if (res.rows && Array.isArray(res.rows.data)) return res.rows.data;
  return [];
}

// API Service Functions
export const api = {
  // Auth
  register: (payload) => apiRequest('/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload) => apiRequest('/login', { method: 'POST', body: JSON.stringify(payload) }),
  logout: () => apiRequest('/logout', { method: 'POST' }),
  getMe: () => apiRequest('/me'),
  getVisitorGeo: () => apiRequest('/visitor-geo'),
  getGoogleConfig: () => apiRequest('/google-auth/config'),
  startGoogleAuth: (mode = 'login') => apiRequest('/google-auth/start', { method: 'POST', body: JSON.stringify({ mode }) }),

  // Public / User Data
  getSiteSettings: () => apiRequest('/site-settings'),
  getOffers: () => apiRequest('/offers'),
  
  // Real Offerwall Fetch
  getOfferwalls: async () => {
    const res = await apiRequest('/offerwalls');
    const list = res.offerwalls || res.rows || res.data || (Array.isArray(res) ? res : []);
    return { success: true, offerwalls: list };
  },

  getTimeline: () => apiRequest('/timeline'),
  getCashoutMethods: () => apiRequest('/cashout-methods'),
  getLatestWithdrawals: () => apiRequest('/withdrawals/latest'),
  getProfileTabs: () => apiRequest('/profile/tabs'),
  getNotifications: () => apiRequest('/notifications'),
  markAllNotificationsRead: () => apiRequest('/notifications/read-all', { method: 'POST' }),
  markNotificationRead: (id) => apiRequest(`/notifications/${id}/read`, { method: 'PATCH' }),
  submitWithdrawal: (payload) => apiRequest('/withdrawals', { method: 'POST', body: JSON.stringify(payload) }),

  // Admin Endpoints
  getAdminDashboard: (params = {}) => apiRequest(`/admin/dashboard${cleanQueryParams(params)}`),
  getAdminSummary: (params = {}) => apiRequest(`/admin/summary${cleanQueryParams(params)}`),
  getAdminOffers: () => apiRequest('/admin/offers'),
  getAdminUsers: async (params = {}) => {
    const res = await apiRequest(`/admin/users${cleanQueryParams(params)}`);
    const list = parseUsersResponse(res);
    return {
      success: true,
      users: list,
      data: list,
      rows: list,
      pagination: res.pagination || null,
      raw: res,
    };
  },
  updateAdminUser: (id, data) => apiRequest(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getAdminCompletedTasks: (params = {}) => {
    return apiRequest(`/admin/completed-tasks${cleanQueryParams(params)}`);
  },
  getAdminChargebacks: () => apiRequest('/admin/chargebacks'),
  getAdminPendingWithdrawals: () => apiRequest('/admin/pending-withdrawals'),
  getAdminAllWithdrawals: () => apiRequest('/admin/all-withdrawals'),
  updatePendingWithdrawal: (id, action) => apiRequest(`/admin/pending-withdrawals/${id}/action`, { method: 'PATCH', body: JSON.stringify({ action }) }),
  
  // Real Admin Offerwall Management (CRUD)
  getAdminOfferwalls: async () => {
    const res = await apiRequest('/admin/offerwalls');
    const list = res.offerwalls || res.rows || res.data || (Array.isArray(res) ? res : []);
    return { success: true, offerwalls: list };
  },

  createOfferwall: (payload) => apiRequest('/admin/offerwalls', { method: 'POST', body: JSON.stringify(payload) }),
  updateOfferwall: (id, payload) => apiRequest(`/admin/offerwalls/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
    .catch(() => apiRequest(`/admin/offerwalls/${id}`, { method: 'PUT', body: JSON.stringify(payload) })),
  deleteOfferwall: (id) => apiRequest(`/admin/offerwalls/${id}`, { method: 'DELETE' }),

  testPostback: (slug, payload) => apiRequest(`/offerwall-postback/${slug}`, { method: 'POST', body: JSON.stringify(payload) }),
  getAdminCashoutMethods: () => apiRequest('/admin/cashout-methods'),

  // Moderator Endpoints (Strictly Read-Only)
  getModeratorStats: (params = {}) => {
    return apiRequest(`/moderator/stats${cleanQueryParams(params)}`);
  },
  getModeratorUsers: async (params = {}) => {
    const res = await apiRequest(`/moderator/users${cleanQueryParams(params)}`);
    return {
      success: true,
      data: res.data || [],
      pagination: res.pagination || null,
      raw: res,
    };
  },
  getModeratorUserActivity: (id) => apiRequest(`/moderator/users/${id}/activity`),
  getModeratorDashboard: (params = {}) => {
    return apiRequest(`/moderator/dashboard${cleanQueryParams(params)}`);
  },
  getModeratorCompletedOffers: (params = {}) => {
    return apiRequest(`/moderator/completed-offers${cleanQueryParams(params)}`);
  },
  getModeratorMyEarn: (params = {}) => {
    return apiRequest(`/moderator/my-earn${cleanQueryParams(params)}`);
  },
  getModeratorNotice: () => apiRequest('/moderator/notice'),
  getModeratorSettings: () => apiRequest('/moderator/settings'),
  updateModeratorSettings: (data) => apiRequest('/moderator/settings', { method: 'PATCH', body: JSON.stringify(data) }),

  // Site PIN Gate
  getSitePinStatus: () => apiRequest('/site-pin/status'),
  verifySitePin: (pin) => apiRequest('/site-pin/verify', { method: 'POST', body: JSON.stringify({ pin }) }),
  getAdminSitePin: () => apiRequest('/admin/site-pin'),
  saveAdminSitePin: (pin) => apiRequest('/admin/site-pin', { method: 'POST', body: JSON.stringify({ pin }) }),
  deleteAdminSitePin: () => apiRequest('/admin/site-pin', { method: 'DELETE' }),

  // Admin My IDs
  getAdminMyIds: (params = {}) => {
    return apiRequest(`/admin/my-ids${cleanQueryParams(params)}`);
  },
  getAdminMyIdOverview: (params = {}) => {
    return apiRequest(`/admin/my-id-overview${cleanQueryParams(params)}`);
  },
  createAdminMyId: (data) => apiRequest('/admin/my-ids', { method: 'POST', body: JSON.stringify(data) }),
  updateAdminMyId: (id, data) => apiRequest(`/admin/my-ids/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Admin My ID Payout Rules
  getAdminPayoutRules: (params = {}) => {
    return apiRequest(`/admin/my-id-payout-rules${cleanQueryParams(params)}`);
  },
  createAdminPayoutRule: (data) => apiRequest('/admin/my-id-payout-rules', { method: 'POST', body: JSON.stringify(data) }),
  updateAdminPayoutRule: (id, data) => apiRequest(`/admin/my-id-payout-rules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAdminPayoutRule: (id) => apiRequest(`/admin/my-id-payout-rules/${id}`, { method: 'DELETE' }),

  // Admin My ID Settings (Activation, Start Date, USD->BDT Rate)
  getAdminMyIdSettings: () => apiRequest('/admin/my-id-settings'),
  updateAdminMyIdSettings: (data) => apiRequest('/admin/my-id-settings', { method: 'POST', body: JSON.stringify(data) }),

  // Admin Moderator Live Notice
  getAdminModeratorNotice: () => apiRequest('/admin/moderator-notice'),
  updateAdminModeratorNotice: (data) => apiRequest('/admin/moderator-notice', { method: 'POST', body: JSON.stringify(data) }),

  // Moderator Payouts
  getModeratorPayouts: (params = {}) => {
    return apiRequest(`/moderator/payouts${cleanQueryParams(params)}`);
  },
  submitModeratorPayout: (data) => apiRequest('/moderator/payouts', { method: 'POST', body: JSON.stringify(data) }),

  // Admin My ID Payouts
  getAdminMyIdPayouts: (params = {}) => {
    return apiRequest(`/admin/my-id-payouts${cleanQueryParams(params)}`);
  },
  updateAdminMyIdPayoutStatus: (id, data) => apiRequest(`/admin/my-id-payouts/${id}/status`, { method: 'PATCH', body: JSON.stringify(data) }),
  getAdminMyIdPayoutSettings: () => apiRequest('/admin/my-id-payouts/settings'),
  updateAdminMyIdPayoutSettings: (data) => apiRequest('/admin/my-id-payouts/settings', { method: 'PATCH', body: JSON.stringify(data) }),
};

