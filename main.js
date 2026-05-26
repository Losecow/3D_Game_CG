import { Game } from './src/Game.js';

// DOM이 준비되면 게임 인스턴스 생성 / Create game instance after DOM is ready
const container = document.getElementById('canvas-container');
new Game(container);
