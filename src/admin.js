const API_URL = import.meta.env.VITE_API_URL ?? '';

// ─── API ──────────────────────────────────────────────────────────────────────

async function api(path, params = {}) {
  const token = localStorage.getItem('fruit_token');
  const qs = new URLSearchParams(params).toString();
  const url = `${API_URL}/api/admin${path}${qs ? '?' + qs : ''}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token ?? ''}` },
  });
  if (!res.ok) {
    const err = new Error();
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// ─── 렌더 헬퍼 ────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmt(n)    { return Number(n).toLocaleString(); }
function date(str) { return new Date(str).toLocaleString('ko-KR', { hour12: false }); }

function avatarHtml(picture, name) {
  return picture
    ? `<img class="avatar" src="${esc(picture)}" alt="" />`
    : `<div class="no-avatar"></div>`;
}

// ─── 통계 ─────────────────────────────────────────────────────────────────────

async function loadStats() {
  const s = await api('/stats');
  document.getElementById('s-users').textContent = fmt(s.total_users);
  document.getElementById('s-games').textContent = fmt(s.total_games);
  document.getElementById('s-avg').textContent   = fmt(s.avg_score ?? 0);
  document.getElementById('s-max').textContent   = fmt(s.max_score ?? 0);
  document.getElementById('s-wm').textContent    = fmt(s.total_watermelons);
}

// ─── 유저 목록 ────────────────────────────────────────────────────────────────

async function loadUsers() {
  const panel = document.getElementById('tab-users');
  const rows  = await api('/users');

  if (!rows.length) { panel.innerHTML = '<div class="loading">유저 없음</div>'; return; }

  panel.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>#</th><th>유저</th><th>이메일</th>
          <th>최고 점수</th><th>게임 수</th><th>누적 수박 🍉</th><th>가입일</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((r, i) => `
          <tr>
            <td class="dim">${i + 1}</td>
            <td>
              <div class="user-cell">
                ${avatarHtml(r.picture, r.name)}
                <span>${esc(r.name || '익명')}</span>
              </div>
            </td>
            <td class="email">${esc(r.email)}</td>
            <td class="num">${fmt(r.best_score ?? 0)}</td>
            <td class="dim">${fmt(r.game_count)}</td>
            <td class="wm">${fmt(r.total_watermelons ?? 0)}</td>
            <td class="dim">${date(r.created_at)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// ─── 점수 기록 ────────────────────────────────────────────────────────────────

let scoresOffset = 0;
const SCORES_LIMIT = 50;

async function loadScores(reset = false) {
  const panel = document.getElementById('tab-scores');

  if (reset) {
    scoresOffset = 0;
    panel.innerHTML = '<div class="loading">불러오는 중...</div>';
  }

  const rows = await api('/scores', { limit: SCORES_LIMIT, offset: scoresOffset });

  if (reset && !rows.length) {
    panel.innerHTML = '<div class="loading">기록 없음</div>';
    return;
  }

  if (reset) {
    panel.innerHTML = `
      <table class="data-table" id="scores-table">
        <thead>
          <tr><th>#</th><th>유저</th><th>점수</th><th>수박 🍉</th><th>날짜</th></tr>
        </thead>
        <tbody id="scores-tbody"></tbody>
      </table>
      <button id="load-more-btn">더 보기</button>
    `;
    document.getElementById('load-more-btn').addEventListener('click', () => loadScores(false));
  }

  const tbody = document.getElementById('scores-tbody');
  rows.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="dim">${scoresOffset + i + 1}</td>
      <td>
        <div class="user-cell">
          ${avatarHtml(r.picture, r.name)}
          <span>${esc(r.name || '익명')}</span>
        </div>
      </td>
      <td class="num">${fmt(r.score)}</td>
      <td class="wm">${r.watermelons ?? 0}</td>
      <td class="dim">${date(r.created_at)}</td>
    `;
    tbody.appendChild(tr);
  });

  scoresOffset += rows.length;

  const btn = document.getElementById('load-more-btn');
  if (btn) btn.disabled = rows.length < SCORES_LIMIT;
}

// ─── 피드백 ───────────────────────────────────────────────────────────────────

async function loadFeedback() {
  const panel = document.getElementById('tab-feedback');
  const rows  = await api('/feedback');

  if (!rows.length) { panel.innerHTML = '<div class="loading">피드백 없음</div>'; return; }

  panel.innerHTML = `
    <table class="data-table">
      <thead>
        <tr><th>#</th><th>유저</th><th>내용</th><th>날짜</th></tr>
      </thead>
      <tbody>
        ${rows.map((r, i) => `
          <tr>
            <td class="dim">${i + 1}</td>
            <td>
              <div class="user-cell">
                ${avatarHtml(r.picture, r.name)}
                <span>${esc(r.name || '익명')}</span>
              </div>
            </td>
            <td><div class="feedback-content">${esc(r.content)}</div></td>
            <td class="dim">${date(r.created_at)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// ─── 탭 전환 ──────────────────────────────────────────────────────────────────

const tabLoaded = { users: false, scores: false, feedback: false };

function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tab = btn.dataset.tab;

      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${tab}`).classList.add('active');

      if (!tabLoaded[tab]) {
        tabLoaded[tab] = true;
        if (tab === 'scores')   await loadScores(true);
        if (tab === 'feedback') await loadFeedback();
      }
    });
  });
}

// ─── 진입점 ───────────────────────────────────────────────────────────────────

async function init() {
  try {
    await loadStats();
    tabLoaded.users = true;
    await loadUsers();

    const user = JSON.parse(localStorage.getItem('fruit_user') ?? 'null');
    if (user?.email) document.getElementById('admin-email').textContent = user.email;

    document.getElementById('main').style.display = 'block';
    setupTabs();
  } catch (err) {
    const box = document.getElementById('error-box');
    box.style.display = 'block';
    if (err.status === 401) {
      box.textContent = '로그인이 필요합니다. 게임에서 구글 로그인 후 다시 접속해주세요.';
    } else if (err.status === 403) {
      box.textContent = '관리자 권한이 없습니다.';
    } else {
      box.textContent = '서버 오류가 발생했습니다.';
    }
  }
}

init();
