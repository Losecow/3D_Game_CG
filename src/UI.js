import { FRUIT_DATA } from './FruitData.js';

/**
 * HTML 오버레이 UI 관리 (점수, 다음 과일 미리보기, 게임 오버)
 * Manages HTML overlay UI: score, next-fruit preview, game over screen
 */
export class UI {
  constructor() {
    this._scoreEl       = document.getElementById('score');
    this._bestEl        = document.getElementById('best-score');
    this._finalEl       = document.getElementById('final-score');
    this._finalBestEl   = document.getElementById('final-best');
    this._newRecordEl   = document.getElementById('new-record');
    this._gameOverEl    = document.getElementById('game-over');
    this._restartBtn    = document.getElementById('restart-btn');
    this._previewCanvas = document.getElementById('next-fruit-preview');
    this._previewCtx    = this._previewCanvas.getContext('2d');

    this._best = parseInt(localStorage.getItem('suika3d_best') || '0', 10);
    this._bestEl.textContent = this._best;
    this._newBestThisGame = false;
  }

  /**
   * 점수 업데이트 / Update score display
   * @param {number} score
   */
  setScore(score) {
    this._scoreEl.textContent = score;

    if (score > this._best) {
      this._best = score;
      this._bestEl.textContent = score;
      localStorage.setItem('suika3d_best', score);
      this._newBestThisGame = true;
    }
  }

  /**
   * 다음 과일 미리보기 캔버스 업데이트
   * Update the next-fruit preview canvas
   * @param {number} level
   */
  setNextFruit(level) {
    const { color, name, nameEn } = FRUIT_DATA[level];
    const ctx = this._previewCtx;
    const w = this._previewCanvas.width;
    const h = this._previewCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // 색깔 원 / Colored circle
    ctx.beginPath();
    ctx.arc(w / 2, h / 2 - 4, 24, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 이름 텍스트 / Name text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${name}`, w / 2, h - 16);
  }

  /**
   * 게임 오버 화면 표시 / Show game over screen
   * @param {number} score
   * @param {() => void} onRestart - 재시작 콜백
   */
  showGameOver(score, onRestart) {
    this._finalEl.textContent = score;
    this._finalBestEl.textContent = this._best;
    this._newRecordEl.classList.toggle('hidden', !this._newBestThisGame);
    this._gameOverEl.classList.remove('hidden');

    const newBtn = this._restartBtn.cloneNode(true);
    this._restartBtn.replaceWith(newBtn);
    this._restartBtn = newBtn;
    this._restartBtn.addEventListener('click', () => {
      this._gameOverEl.classList.add('hidden');
      this._newBestThisGame = false;
      onRestart();
    });
  }

  /**
   * 게임 오버 화면 숨기기 / Hide game over screen
   */
  hideGameOver() {
    this._gameOverEl.classList.add('hidden');
  }
}
