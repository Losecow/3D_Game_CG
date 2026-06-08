const DESCS = {
  shake:    '모든 과일을 뒤섞습니다 (게임당 1회)',
  delete:   '과일 하나를 제거합니다',
  nickname: '닉네임을 변경합니다',
};

export class Shop {
  constructor(game, auth) {
    this._game    = game;
    this._auth    = auth;
    this._balance = 0;
    this._items   = [];

    this._modal     = document.getElementById('shop-modal');
    this._balanceEl = document.getElementById('shop-wm-count');
    this._itemsEl   = document.getElementById('shop-items');
    this._statusEl  = document.getElementById('shop-status');
    this._banner    = document.getElementById('delete-mode-banner');

    document.getElementById('shop-btn').addEventListener('click', () => this.open());
    document.getElementById('shop-close').addEventListener('click', () => this.close());
    this._modal.addEventListener('click', e => { if (e.target === this._modal) this.close(); });
    document.getElementById('delete-mode-cancel').addEventListener('click', () => {
      this._game.exitDeleteMode();
    });
  }

  async open() {
    this._statusEl.textContent = '';
    this._modal.classList.remove('hidden');

    if (!this._auth.isLoggedIn) {
      this._itemsEl.innerHTML = '<div class="shop-loading">로그인이 필요합니다.</div>';
      this._balanceEl.textContent = '?';
      return;
    }

    this._itemsEl.innerHTML = '<div class="shop-loading">불러오는 중...</div>';

    const data = await this._auth.fetchShopItems();
    if (!data) {
      this._statusEl.textContent = '불러오기 실패';
      this._itemsEl.innerHTML = '';
      return;
    }

    this._balance = data.watermelons ?? 0;
    this._items   = data.items ?? [];
    this._balanceEl.textContent = this._balance;
    this._render();
  }

  close() {
    this._modal.classList.add('hidden');
  }

  _render() {
    this._itemsEl.innerHTML = '';
    this._items.forEach(item => {
      const canAfford  = this._balance >= item.cost;
      const shakeGone  = item.id === 'shake' && (this._game.shakeUsed || this._game.isGameOver);
      const deleteGone = item.id === 'delete' && this._game.isGameOver;
      const disabled   = !canAfford || shakeGone || deleteGone;
      const hint       = (item.id === 'shake' && this._game.shakeUsed && !this._game.isGameOver) ? ' (이미 사용)' : '';

      const div = document.createElement('div');
      div.className = 'shop-item';
      div.innerHTML = `
        <div class="shop-item-info">
          <div class="shop-item-name">${item.name}${hint}</div>
          <div class="shop-item-desc">${DESCS[item.id] ?? ''}</div>
        </div>
        <button class="shop-item-btn" ${disabled ? 'disabled' : ''}>🍉${item.cost}</button>
      `;
      if (!disabled) {
        div.querySelector('.shop-item-btn').addEventListener('click', () => this._purchase(item));
      }
      this._itemsEl.appendChild(div);
    });
  }

  async _purchase(item) {
    this._statusEl.textContent = '';
    this._itemsEl.querySelectorAll('.shop-item-btn').forEach(b => { b.disabled = true; });

    const result = await this._auth.purchase(item.id);

    if (!result || !result.ok) {
      const msg = result?.error === 'insufficient_funds' ? '수박이 부족합니다.' : '구매에 실패했습니다.';
      this._statusEl.textContent = msg;
      const fresh = await this._auth.fetchShopItems();
      if (fresh) {
        this._balance = fresh.watermelons ?? 0;
        this._items   = fresh.items ?? [];
        this._balanceEl.textContent = this._balance;
      }
      this._render();
      return;
    }

    this._balance = result.total_watermelons ?? this._balance;
    this._balanceEl.textContent = this._balance;
    this._applyItem(item.id);
  }

  _applyItem(itemId) {
    switch (itemId) {
      case 'shake':
        this._game.shake();
        this.close();
        break;
      case 'delete':
        this.close();
        this._banner.classList.remove('hidden');
        // exitDeleteMode (any cause) will call this callback and hide the banner
        this._game.enterDeleteMode(() => this._banner.classList.add('hidden'));
        break;
      case 'nickname':
        this.close();
        document.getElementById('nickname-edit-btn').click();
        break;
    }
  }
}
