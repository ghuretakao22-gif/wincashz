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

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired or invalid
        setStoredToken(null);
      }
      const error = new Error(data.message || data.error || `Request failed with status ${response.status}`);
      error.status = response.status;
      error.errors = data.errors || {};
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
  getAdminDashboard: () => apiRequest('/admin/dashboard'),
  getAdminOffers: () => apiRequest('/admin/offers'),
  getAdminUsers: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const res = await apiRequest(`/admin/users${q ? `?${q}` : ''}`);
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
  getAdminCompletedTasks: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest(`/admin/completed-tasks${q ? `?${q}` : ''}`);
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
};
