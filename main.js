import { Game } from './src/Game.js';
import { Auth } from './src/Auth.js';

const auth = new Auth();
const game = new Game(document.getElementById('canvas-container'), auth);
document.getElementById('quit-btn').addEventListener('click', () => {
  if (confirm('게임을 종료할까요?')) game.quit();
});

document.getElementById('splitview-btn').addEventListener('click', () => {
  const active = game.toggleSplitView();
  document.getElementById('splitview-btn').classList.toggle('active', active);
});

auth.init();
