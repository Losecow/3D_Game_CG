import { Game }     from './src/Game.js';
import { Auth }     from './src/Auth.js';
import { Settings } from './src/Settings.js';

const auth     = new Auth();
const game     = new Game(document.getElementById('canvas-container'), auth);
const settings = new Settings(game, game.sound, auth);

document.getElementById('splitview-btn').addEventListener('click', () => {
  settings.handleSplitViewToggle();
});

auth.init();
