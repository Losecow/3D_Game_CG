import { FRUIT_DATA } from './FruitData.js';

export class UI {
  constructor(auth) {
    this._auth = auth;

    this._scoreEl       = document.getElementById('score');
    this._bestEl        = document.getElementById('best-score');
    this._finalEl       = document.getElementById('final-score');
    this._finalBestEl   = document.getElementById('final-best');
    this._newRecordEl   = document.getElementById('new-record');
    this._gameOverEl    = document.getElementById('game-over');
    this._restartBtn    = document.getElementById('restart-btn');
    this._previewCanvas = document.getElementById('next-fruit-preview');
    this._previewCtx    = this._previewCanvas.getContext('2d');
    this._submitStatus  = document.getElementById('score-submit-status');

    this._best = parseInt(localStorage.getItem('suika3d_best') || '0', 10);
    this._bestEl.textContent = this._best;
    this._newBestThisGame = false;

    this._initAuthUI();
    this._initLeaderboard();
  }

  // ─────────────────────── 점수 ───────────────────────

  setScore(score) {
    this._scoreEl.textContent = score;
    if (score > this._best) {
      this._best = score;
      this._bestEl.textContent = score;
      localStorage.setItem('suika3d_best', score);
      this._newBestThisGame = true;
    }
  }

  setNextFruit(level) {
    const { color, name } = FRUIT_DATA[level];
    const ctx = this._previewCtx;
    const w = this._previewCanvas.width;
    const h = this._previewCanvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    ctx.arc(w / 2, h / 2 - 4, 24, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(name, w / 2, h - 16);
  }

  // ─────────────────────── 게임 오버 ───────────────────────

  showGameOver(score, submitted, onRestart) {
    this._finalEl.textContent = score;
    this._finalBestEl.textContent = this._best;
    this._newRecordEl.classList.toggle('hidden', !this._newBestThisGame);

    if (submitted === true) {
      this._submitStatus.textContent = '✓ 리더보드에 등록되었습니다';
      this._submitStatus.className = 'submit-ok';
    } else if (submitted === false && !this._auth?.isLoggedIn) {
      this._submitStatus.textContent = '로그인하면 리더보드에 등록됩니다';
      this._submitStatus.className = 'submit-hint';
    } else {
      this._submitStatus.textContent = '';
      this._submitStatus.className = '';
    }

    this._gameOverEl.classList.remove('hidden');

    const newBtn = this._restartBtn.cloneNode(true);
    this._restartBtn.replaceWith(newBtn);
    this._restartBtn = newBtn;
    this._restartBtn.addEventListener('click', () => {
      this._gameOverEl.classList.add('hidden');
      this._newBestThisGame = false;
      onRestart();
    });

    const lbBtn = document.getElementById('gameover-leaderboard-btn');
    const newLbBtn = lbBtn.cloneNode(true);
    lbBtn.replaceWith(newLbBtn);
    newLbBtn.addEventListener('click', () => this._openLeaderboard());
  }

  // ─────────────────────── 인증 UI ───────────────────────

  _initAuthUI() {
    const auth = this._auth;

    document.getElementById('logout-btn').addEventListener('click', () => auth?.logout());
    document.getElementById('nickname-edit-btn').addEventListener('click', () => this._openNicknameModal());

    auth?.on('login', user => {
      this.setUser(user);
      if (!user.nickname) this._openNicknameModal();
    });
    auth?.on('logout', () => this.clearUser());

    if (auth?.isLoggedIn) {
      this.setUser(auth.user);
      if (!auth.user.nickname) this._openNicknameModal();
    }
    this._initNicknameModal();
  }

  setUser(user) {
    document.getElementById('user-info').classList.remove('hidden');
    document.getElementById('google-signin-btn').classList.add('hidden');
    document.getElementById('user-avatar').src = user.picture || '';
    document.getElementById('user-name').textContent = user.nickname || user.name || '';
  }

  clearUser() {
    document.getElementById('user-info').classList.add('hidden');
    document.getElementById('google-signin-btn').classList.remove('hidden');
  }

  _initNicknameModal() {
    document.getElementById('nickname-cancel').addEventListener('click', () => this._closeNicknameModal());
    document.getElementById('nickname-save').addEventListener('click', () => this._saveNickname());
    document.getElementById('nickname-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._saveNickname();
      if (e.key === 'Escape') this._closeNicknameModal();
    });
  }

  _openNicknameModal() {
    const input = document.getElementById('nickname-input');
    input.value = this._auth?.displayName || '';
    document.getElementById('nickname-error').classList.add('hidden');
    document.getElementById('nickname-modal').classList.remove('hidden');
    input.focus();
    input.select();
  }

  _closeNicknameModal() {
    document.getElementById('nickname-modal').classList.add('hidden');
  }

  async _saveNickname() {
    const input = document.getElementById('nickname-input');
    const errorEl = document.getElementById('nickname-error');
    const nickname = input.value.trim();

    if (!nickname) {
      errorEl.textContent = '닉네임을 입력해주세요';
      errorEl.classList.remove('hidden');
      return;
    }

    const saveBtn = document.getElementById('nickname-save');
    saveBtn.disabled = true;
    saveBtn.textContent = '저장 중...';

    const saved = await this._auth?.updateNickname(nickname);

    saveBtn.disabled = false;
    saveBtn.textContent = '저장';

    if (saved) {
      document.getElementById('user-name').textContent = saved;
      this._closeNicknameModal();
    } else {
      errorEl.textContent = '저장에 실패했습니다';
      errorEl.classList.remove('hidden');
    }
  }

  // ─────────────────────── 리더보드 ───────────────────────

  _initLeaderboard() {
    document.getElementById('leaderboard-btn').addEventListener('click', () => this._openLeaderboard());
    document.getElementById('leaderboard-close').addEventListener('click', () => this._closeLeaderboard());
  }

  async _openLeaderboard() {
    const modal = document.getElementById('leaderboard-modal');
    const list  = document.getElementById('leaderboard-list');
    modal.classList.remove('hidden');
    list.innerHTML = '<div class="leaderboard-loading">불러오는 중...</div>';

    try {
      const rows = await this._auth?.fetchLeaderboard() ?? [];
      if (rows.length === 0) {
        list.innerHTML = '<div class="leaderboard-loading">아직 기록이 없습니다</div>';
        return;
      }
      list.innerHTML = rows.map((row, i) => `
        <div class="leaderboard-row">
          <span class="lb-rank">${i + 1}</span>
          <img class="lb-avatar" src="${row.picture || ''}" alt="" />
          <span class="lb-name">${row.name || '익명'}</span>
          <span class="lb-score">${row.score.toLocaleString()}</span>
        </div>
      `).join('');
    } catch {
      list.innerHTML = '<div class="leaderboard-loading">불러오기 실패</div>';
    }
  }

  _closeLeaderboard() {
    document.getElementById('leaderboard-modal').classList.add('hidden');
  }
}
