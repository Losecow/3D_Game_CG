import { Game }     from './src/Game.js';
import { Auth }     from './src/Auth.js';
import { Settings } from './src/Settings.js';
import { Shop }        from './src/Shop.js';
import { CameraModal } from './src/CameraModal.js';

const auth     = new Auth();
const game     = new Game(document.getElementById('canvas-container'), auth);
const settings = new Settings(game, game.sound, auth);
const shop        = new Shop(game, auth);
const cameraModal = new CameraModal(game);

document.getElementById('splitview-btn').addEventListener('click', () => {
  settings.handleSplitViewToggle();
});

auth.init();
