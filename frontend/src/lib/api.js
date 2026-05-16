const API_BASE = '/api';

class ApiClient {
  constructor() {
    this.accessToken = localStorage.getItem('cn_access_token');
    this.refreshToken = localStorage.getItem('cn_refresh_token');
  }

  setTokens(access, refresh) {
    this.accessToken = access;
    this.refreshToken = refresh;
    localStorage.setItem('cn_access_token', access);
    localStorage.setItem('cn_refresh_token', refresh);
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('cn_access_token');
    localStorage.removeItem('cn_refresh_token');
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.accessToken && { Authorization: `Bearer ${this.accessToken}` }),
    };
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401 && this.refreshToken) {
      const data = await response.json().catch(() => ({}));
      if (data.code === 'TOKEN_EXPIRED') {
        const ok = await this.refreshAccessToken();
        if (ok) {
          headers.Authorization = `Bearer ${this.accessToken}`;
          return fetch(url, { ...options, headers });
        }
      }
      this.clearTokens();
      window.location.href = '/login';
    }
    return response;
  }

  async refreshAccessToken() {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      this.setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch { return false; }
  }

  async getSalt(email) {
    const res = await this.request('/auth/salt', { method: 'POST', body: JSON.stringify({ email }) });
    return res.json();
  }
  async register(data) {
    const res = await this.request('/auth/register', { method: 'POST', body: JSON.stringify(data) });
    return res.json();
  }
  async login(data) {
    const res = await this.request('/auth/login', { method: 'POST', body: JSON.stringify(data) });
    return res.json();
  }
  async getVaults() {
    const res = await this.request('/vaults');
    return res.json();
  }
  async createVault(data) {
    const res = await this.request('/vaults', { method: 'POST', body: JSON.stringify(data) });
    return res.json();
  }
  async deleteVault(id) {
    const res = await this.request(`/vaults/${id}`, { method: 'DELETE' });
    return res.json();
  }
  async getVaultEntries(vaultId) {
    const res = await this.request(`/vaults/${vaultId}/entries`);
    return res.json();
  }
  async createEntry(data) {
    const res = await this.request('/entries', { method: 'POST', body: JSON.stringify(data) });
    return res.json();
  }
  async updateEntry(id, data) {
    const res = await this.request(`/entries/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    return res.json();
  }
  async deleteEntry(id) {
    const res = await this.request(`/entries/${id}`, { method: 'DELETE' });
    return res.json();
  }
  async toggleFavorite(id) {
    const res = await this.request(`/entries/${id}/favorite`, { method: 'PATCH' });
    return res.json();
  }
  async getSecurityReport() {
    const res = await this.request('/security/report');
    return res.json();
  }
  async panicLock() {
    const res = await this.request('/security/panic', { method: 'POST' });
    return res.json();
  }
  async setupRecovery(data) {
    const res = await this.request('/auth/setup-recovery', { method: 'POST', body: JSON.stringify(data) });
    return res.json();
  }
  async recoverAccount(data) {
    // This is an unauthenticated request
    const res = await fetch(`${API_BASE}/auth/recover-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  }
  async completeRecovery(data) {
    // This is an unauthenticated request
    const res = await fetch(`${API_BASE}/auth/complete-recovery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  }
}

export const api = new ApiClient();
