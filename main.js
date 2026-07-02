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

// ── AI 명령 패널 ──
const llmInput  = document.getElementById('llm-input');
const llmBtn    = document.getElementById('llm-send-btn');
const llmFeedback = document.getElementById('llm-feedback');

const ACTION_LABELS = {
  drop_fruit:    (p) => `🍎 ${['체리','딸기','포도','귤','감','사과','배','복숭아','파인애플','멜론','수박'][p.level]} 드롭!`,
  shake:         (p) => ({ light:'살살', medium:'흔들흔들', hard:'세게' }[p.intensity] ?? '') + ' 흔들었어요!',
  flip:          ()  => '뒤집었어요!',
  delete_fruit:  (p) => ({ largest:'가장 큰', smallest:'가장 작은', random:'랜덤' }[p.target]) + ' 과일 삭제!',
  spawn_rainbow: ()  => '🌈 레인보우 과일 소환!',
};

async function sendLLMCommand() {
  const text = llmInput.value.trim();
  if (!text) return;

  llmBtn.disabled = true;
  llmFeedback.className = '';
  llmFeedback.textContent = '생각 중...';

  try {
    const res = await fetch('/api/llm/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const json = await res.json();

    if (!res.ok || json.error) throw new Error(json.error ?? '서버 오류');

    if (json.action === 'none') {
      llmFeedback.className = 'err';
      llmFeedback.textContent = `❌ ${json.reason ?? '할 수 없는 명령이에요.'}`;
    } else {
      const result = game.executeAction(json);
      if (result?.ok === false) {
        llmFeedback.className = 'err';
        llmFeedback.textContent = `❌ ${result.reason}`;
      } else {
        llmFeedback.className = '';
        llmFeedback.textContent = ACTION_LABELS[json.action]?.(json.params ?? {}) ?? '실행했어요!';
        llmInput.value = '';
      }
    }
  } catch (e) {
    llmFeedback.className = 'err';
    llmFeedback.textContent = `❌ 오류: ${e.message}`;
  } finally {
    llmBtn.disabled = false;
    llmInput.focus();
  }
}

llmBtn.addEventListener('click', sendLLMCommand);
llmInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendLLMCommand(); });
