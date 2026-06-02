import { Game } from './src/Game.js';
import { Auth } from './src/Auth.js';

const auth = new Auth();
new Game(document.getElementById('canvas-container'), auth);
auth.init();
