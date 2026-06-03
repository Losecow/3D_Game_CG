const LS = {
  volume:   's3d_volume',
  dropMode: 's3d_dropmode',
};

export class Settings {
  constructor(game, sound, auth) {
    this._game  = game;
    this._sound = sound;
    this._auth  = auth;

    this._volume   = parseFloat(localStorage.getItem(LS.volume)   ?? '0.5');
    this._dropMode = localStorage.getItem(LS.dropMode) ?? 'click'; // 'click' | 'space'

    this._applyAll();
    this._initModal();
    this._initFeedback();
  }

  // ─────── 외부에서 splitview 토글 시 호출 ───────
  handleSplitViewToggle() {
    const active = this._game.toggleSplitView();
    this._syncSplitUI(active);
  }

  // ─────── 적용 ───────
  _applyAll() {
    this._sound.setVolume(this._volume);
    this._game.setDropMode(this._dropMode);
  }

  _save() {
    localStorage.setItem(LS.volume,   this._volume);
    localStorage.setItem(LS.dropMode, this._dropMode);
  }

  // ─────── UI 초기화 ───────
  _initModal() {
    document.getElementById('settings-btn').addEventListener('click',   () => this._open());
    document.getElementById('settings-close').addEventListener('click', () => this._close());
    document.getElementById('settings-modal').addEventListener('click', (e) => {
      if (e.target.id === 'settings-modal') this._close();
    });

    // 볼륨 슬라이더
    const slider  = document.getElementById('volume-slider');
    const volText = document.getElementById('volume-value');
    slider.value  = Math.round(this._volume * 100);
    volText.textContent = `${slider.value}%`;
    slider.addEventListener('input', () => {
      this._volume = slider.value / 100;
      volText.textContent = `${slider.value}%`;
      this._sound.setVolume(this._volume);
      this._save();
    });

    // 분할 뷰 토글
    document.getElementById('settings-splitview-toggle').addEventListener('click', () => {
      this.handleSplitViewToggle();
    });

    // 게임 종료
    document.getElementById('settings-quit-btn').addEventListener('click', () => {
      this._close();
      if (confirm('게임을 종료할까요?')) this._game.quit();
    });

    // 드롭 방식
    const clickBtn = document.getElementById('drop-mode-click');
    const spaceBtn = document.getElementById('drop-mode-space');
    this._syncDropUI(clickBtn, spaceBtn, this._dropMode);

    clickBtn.addEventListener('click', () => {
      this._dropMode = 'click';
      this._game.setDropMode('click');
      this._syncDropUI(clickBtn, spaceBtn, 'click');
      this._save();
    });
    spaceBtn.addEventListener('click', () => {
      this._dropMode = 'space';
      this._game.setDropMode('space');
      this._syncDropUI(clickBtn, spaceBtn, 'space');
      this._save();
    });
  }

  _open() {
    this._syncSplitUI(this._game.isSplitView);
    document.getElementById('settings-modal').classList.remove('hidden');
  }

  _close() {
    document.getElementById('settings-modal').classList.add('hidden');
  }

  // ─────── 피드백 ───────
  _initFeedback() {
    this._updateFeedbackRow();
    this._auth?.on('login',  () => this._updateFeedbackRow());
    this._auth?.on('logout', () => this._updateFeedbackRow());

    document.getElementById('settings-feedback-btn').addEventListener('click', () => {
      this._close();
      this._openFeedback();
    });

    document.getElementById('feedback-close').addEventListener('click', () => this._closeFeedback());
    document.getElementById('feedback-modal').addEventListener('click', (e) => {
      if (e.target.id === 'feedback-modal') this._closeFeedback();
    });

    const input  = document.getElementById('feedback-input');
    const charEl = document.getElementById('feedback-char');
    input.addEventListener('input', () => {
      charEl.textContent = `${input.value.length} / 500`;
    });

    document.getElementById('feedback-submit').addEventListener('click', () => this._submitFeedback());
  }

  _updateFeedbackRow() {
    document.getElementById('feedback-row').classList.toggle('hidden', !this._auth?.isLoggedIn);
  }

  _openFeedback() {
    document.getElementById('feedback-input').value = '';
    document.getElementById('feedback-char').textContent = '0 / 500';
    document.getElementById('feedback-status').classList.add('hidden');
    document.getElementById('feedback-modal').classList.remove('hidden');
  }

  _closeFeedback() {
    document.getElementById('feedback-modal').classList.add('hidden');
  }

  async _submitFeedback() {
    const input     = document.getElementById('feedback-input');
    const status    = document.getElementById('feedback-status');
    const submitBtn = document.getElementById('feedback-submit');
    const content   = input.value.trim();
    if (!content) return;

    submitBtn.disabled    = true;
    submitBtn.textContent = '전송 중...';

    const ok = await this._auth?.submitFeedback(content);

    submitBtn.disabled    = false;
    submitBtn.textContent = '보내기';
    status.classList.remove('hidden');

    if (ok) {
      status.textContent = '✓ 피드백이 전송되었습니다. 감사합니다!';
      status.className   = 'feedback-ok';
      input.value = '';
      document.getElementById('feedback-char').textContent = '0 / 500';
      setTimeout(() => this._closeFeedback(), 2000);
    } else {
      status.textContent = '전송에 실패했습니다. 다시 시도해주세요.';
      status.className   = 'feedback-err';
    }
  }

  // ─────── 버튼 동기화 ───────
  _syncSplitUI(active) {
    document.getElementById('splitview-btn').classList.toggle('active', active);
    const btn = document.getElementById('settings-splitview-toggle');
    btn.textContent = active ? 'ON' : 'OFF';
    btn.classList.toggle('toggle-on', active);
  }

  _syncDropUI(clickBtn, spaceBtn, mode) {
    clickBtn.classList.toggle('active', mode === 'click');
    spaceBtn.classList.toggle('active', mode === 'space');
  }
}
