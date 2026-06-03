const LS = {
  volume:   's3d_volume',
  dropMode: 's3d_dropmode',
};

export class Settings {
  constructor(game, sound) {
    this._game  = game;
    this._sound = sound;

    this._volume   = parseFloat(localStorage.getItem(LS.volume)   ?? '0.5');
    this._dropMode = localStorage.getItem(LS.dropMode) ?? 'click'; // 'click' | 'space'

    this._applyAll();
    this._initModal();
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
