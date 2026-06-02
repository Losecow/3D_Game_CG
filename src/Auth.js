const GOOGLE_CLIENT_ID = '718081012338-tgmapnfrd7rc39fvf8h2sju6evap3q6j.apps.googleusercontent.com';
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

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

  async submitScore(score) {
    if (!this._token) return false;
    try {
      const res = await fetch(`${API_URL}/api/scores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this._token}`,
        },
        body: JSON.stringify({ score }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async fetchLeaderboard() {
    const res = await fetch(`${API_URL}/api/leaderboard`);
    return res.json();
  }

  // ───────────── private ─────────────

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
