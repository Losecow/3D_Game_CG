import { Game } from './src/Game.js';
import { Auth } from './src/Auth.js';

const auth = new Auth();
const game = new Game(document.getElementById('canvas-container'), auth);
document.getElementById('quit-btn').addEventListener('click', () => {
  if (confirm('게임을 종료할까요?')) game.quit();
});
auth.init();
