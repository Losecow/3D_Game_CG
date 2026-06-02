const GOOGLE_CLIENT_ID = '718081012338-tgmapnfrd7rc39fvf8h2sju6evap3q6j.apps.googleusercontent.com';
const API_URL = import.meta.env.VITE_API_URL ?? '';

export class Auth {
  constructor() {
    this._token = localStorage.getItem('fruit_token');
    this._user  = JSON.parse(localStorage.getItem('fruit_user') ?? 'null');
    this._listeners = { login: [], logout: [] };
  }

  get user()      { return this._user; }
  get isLoggedIn(){ return !!this._token; }

  on(event, fn) {
    this._listeners[event]?.push(fn);
  }

  async init() {
    if (this._token) await this._validateToken();

    await this._waitForGoogle();
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: ({ credential }) => this._handleCredential(credential),
    });

    const btnEl = document.getElementById('google-signin-btn');
    if (btnEl) {
      google.accounts.id.renderButton(btnEl, {
        theme: 'filled_black',
        size: 'medium',
        shape: 'pill',
        text: 'signin_with',
      });
    }
  }

  logout() {
    this._token = null;
    this._user  = null;
    localStorage.removeItem('fruit_token');
    localStorage.removeItem('fruit_user');
    window.google?.accounts.id.disableAutoSelect();
    this._emit('logout');
  }

  async submitScore(score, watermelons = 0) {
    if (!this._token) return false;
    try {
      const res = await fetch(`${API_URL}/api/scores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this._token}`,
        },
        body: JSON.stringify({ score, watermelons }),
      });
      if (res.status === 401) { this.logout(); return false; }
      return res.ok;
    } catch {
      return false;
    }
  }

  async updateNickname(nickname) {
    if (!this._token) return null;
    const res = await fetch(`${API_URL}/api/me/nickname`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this._token}`,
      },
      body: JSON.stringify({ nickname }),
    });
    if (res.status === 401) { this.logout(); return null; }
    if (!res.ok) return null;
    const { nickname: saved } = await res.json();
    this._user = { ...this._user, nickname: saved };
    localStorage.setItem('fruit_user', JSON.stringify(this._user));
    return saved;
  }

  get displayName() {
    return this._user?.nickname || this._user?.name || '';
  }

  async fetchLeaderboard() {
    const res = await fetch(`${API_URL}/api/leaderboard`);
    return res.json();
  }

  // ───────────── private ─────────────

  async _validateToken() {
    try {
      const res = await fetch(`${API_URL}/api/me`, {
        headers: { 'Authorization': `Bearer ${this._token}` },
      });
      if (res.status === 401 || res.status === 404) {
        this.logout();
      } else if (res.ok) {
        const { user } = await res.json();
        this._user = { ...this._user, ...user };
        localStorage.setItem('fruit_user', JSON.stringify(this._user));
      }
    } catch {
      // 네트워크 오류는 무시 (오프라인 등)
    }
  }

  _waitForGoogle() {
    return new Promise(resolve => {
      if (window.google) return resolve();
      const id = setInterval(() => {
        if (window.google) { clearInterval(id); resolve(); }
      }, 100);
    });
  }

  async _handleCredential(credential) {
    try {
      const res = await fetch(`${API_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      if (!res.ok) throw new Error('Auth failed');
      const { token, user } = await res.json();
      this._token = token;
      this._user  = user;
      localStorage.setItem('fruit_token', token);
      localStorage.setItem('fruit_user', JSON.stringify(user));
      this._emit('login', user);
    } catch (err) {
      console.error('Login failed:', err);
    }
  }

  _emit(event, data) {
    this._listeners[event]?.forEach(fn => fn(data));
  }
}
