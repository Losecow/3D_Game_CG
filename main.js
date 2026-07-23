import { Game }        from './src/Game.js';
import { Auth }        from './src/Auth.js';
import { Settings }    from './src/Settings.js';
import { Shop }        from './src/Shop.js';
import { CameraModal } from './src/CameraModal.js';

const auth        = new Auth();
const game        = new Game(document.getElementById('canvas-container'), auth);
const settings    = new Settings(game, game.sound, auth);
const shop        = new Shop(game, auth);
const cameraModal = new CameraModal(game);

document.getElementById('splitview-btn').addEventListener('click', () => {
  settings.handleSplitViewToggle();
});

auth.init();

// ── AI 명령 패널 ──
const llmInput    = document.getElementById('llm-input');
const llmBtn      = document.getElementById('llm-send-btn');
const llmFeedback = document.getElementById('llm-feedback');

const FRUIT_NAMES_KO = ['체리','딸기','포도','귤','감','사과','배','복숭아','파인애플','멜론','수박'];

const ACTION_LABELS = {
  drop_fruit:    (p) => {
    const name = p.level !== undefined ? (FRUIT_NAMES_KO[p.level] ?? '과일') : '과일';
    return `🍎 ${name} 드롭!`;
  },
  shake:         (p) => ({ light:'살살', medium:'흔들흔들', hard:'세게' }[p.intensity] ?? '') + ' 흔들었어요!',
  flip:          ()  => '뒤집었어요!',
  delete_fruit:  (p) => ({ largest:'가장 큰', smallest:'가장 작은', random:'랜덤' }[p.target]) + ' 과일 삭제!',
  spawn_rainbow: ()  => '🌈 레인보우 과일 소환!',
};

function applyResult(json) {
  if (json.action === 'none') {
    llmFeedback.className   = 'err';
    llmFeedback.textContent = `❌ ${json.reason ?? '할 수 없는 명령이에요.'}`;
  } else {
    const result = game.executeAction(json);
    if (result?.ok === false) {
      llmFeedback.className   = 'err';
      llmFeedback.textContent = `❌ ${result.reason}`;
    } else {
      llmFeedback.className   = '';
      llmFeedback.textContent = ACTION_LABELS[json.action]?.(json.params ?? {}) ?? '실행했어요!';
      llmInput.value = '';
    }
  }
}

let _llmBusy = false;

async function sendLLMCommand() {
  if (_llmBusy) return;
  const text = llmInput.value.trim();
  if (!text) return;

  _llmBusy = true;
  llmBtn.disabled = true;
  llmFeedback.className   = '';
  llmFeedback.textContent = '생각 중...';

  try {
    if (_vizOn) {
      const apiPromise = fetch('/api/llm/command?debug=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      }).then(async r => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? '서버 오류');
        return j;
      }).catch(e => ({ error: e.message }));

      await runViz(text, apiPromise);
    } else {
      const res  = await fetch('/api/llm/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? '서버 오류');
      applyResult(json);
    }
  } catch (e) {
    llmFeedback.className   = 'err';
    llmFeedback.textContent = `❌ 오류: ${e.message}`;
  } finally {
    _llmBusy      = false;
    llmBtn.disabled = false;
    llmInput.focus();
  }
}

llmBtn.addEventListener('click', sendLLMCommand);
llmInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); sendLLMCommand(); }
});


// ── LLM 처리 과정 시각화 ──

const VIZ_LS       = 'llm_viz_on';
let   _vizOn       = localStorage.getItem(VIZ_LS) === '1';

const vizOverlay   = document.getElementById('llm-viz-overlay');
const vizCloseBtn  = document.getElementById('llm-viz-close');
const vizToggleBtn = document.getElementById('llm-viz-toggle');

function syncVizToggle() {
  vizToggleBtn.textContent = _vizOn ? '🔬 ON' : '🔬';
  vizToggleBtn.title       = _vizOn ? '처리 과정 보기 켜짐 (클릭하면 끔)' : '처리 과정 보기 (클릭하면 켬)';
  vizToggleBtn.classList.toggle('viz-on', _vizOn);
}
syncVizToggle();

vizToggleBtn.addEventListener('click', () => {
  _vizOn = !_vizOn;
  localStorage.setItem(VIZ_LS, _vizOn ? '1' : '0');
  syncVizToggle();
});

vizCloseBtn.addEventListener('click', () => vizOverlay.classList.add('hidden'));
vizOverlay.addEventListener('click', e => {
  if (e.target === vizOverlay) vizOverlay.classList.add('hidden');
});

// ── 시각화 유틸리티 ──

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function typeText(el, text, charMs = 12) {
  el.textContent = '';
  for (const ch of text) {
    el.textContent += ch;
    if (charMs > 0) await delay(charMs);
  }
}

function revealEl(el) {
  el.style.display = 'block';
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('viz-visible')));
}

function revealFlex(el) {
  el.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('viz-visible')));
}

// ── 키워드 추출 (교육용 단순 매칭) ──

const KW_FRUITS  = ['레인보우','파인애플','복숭아','멜론','수박','사과','포도','체리','딸기','귤','감','배'];
const KW_DIRS    = ['왼쪽','오른쪽','가운데','중앙','위쪽','아래쪽','위','아래'];
const KW_ACTIONS = ['떨어뜨려줘','떨어뜨려','드롭해줘','드롭해','드랍해줘','드랍해','드롭','드랍',
                    '넣어줘','넣어','놓아줘','놓아','소환해줘','소환해','소환',
                    '흔들어줘','흔들어','뒤집어줘','뒤집어',
                    '삭제해줘','삭제해','없애줘','없애'];

function extractKeywords(text) {
  const found = [];
  for (const w of KW_FRUITS)  { if (text.includes(w)) { found.push({ word: w, type: 'fruit',  label: '과일'  }); break; } }
  for (const w of KW_DIRS)    { if (text.includes(w)) { found.push({ word: w, type: 'pos',    label: '위치'  }); break; } }
  for (const w of KW_ACTIONS) { if (text.includes(w)) { found.push({ word: w, type: 'action', label: '동작'  }); break; } }
  const qtyMatch = text.match(/(\d+개|두\s*개|세\s*개|네\s*개|다섯|여러)/);
  if (qtyMatch) found.push({ word: qtyMatch[0], type: 'qty', label: '수량(주의)' });
  return found;
}

// ── 시스템 프롬프트 요약 (교육용 표시) ──
const SYS_DISPLAY =
`너는 과일 합체 3D 게임의 AI 컨트롤러다.
자연어 명령 → JSON 변환 후 출력.
액션: drop_fruit / shake / flip / delete_fruit / spawn_rainbow / none
소환 가능 과일: 체리~감 (레벨 0~4)`;

// ── Step 4 결과 HTML 생성 ──
function buildResultHTML(json) {
  if (json.error) {
    return `<div class="viz-result-err">⚠️ 오류: ${json.error}</div>`;
  }

  if (json.action === 'none') {
    return `
      <div class="viz-result-row">
        <span class="viz-result-key">액션</span>
        <span class="viz-result-val viz-action-none">none (거부)</span>
      </div>
      <div class="viz-result-final viz-final-reject">❌ ${json.reason ?? '할 수 없는 명령'}</div>`;
  }

  const paramRows = json.params
    ? Object.entries(json.params).map(([k, v]) => `
      <div class="viz-result-row">
        <span class="viz-result-key">${k}</span>
        <span class="viz-result-val">${JSON.stringify(v)}</span>
      </div>`).join('')
    : '';

  const label = ACTION_LABELS[json.action]?.(json.params ?? {}) ?? '실행했어요!';

  return `
    <div class="viz-result-row">
      <span class="viz-result-key">액션</span>
      <span class="viz-result-val viz-action-ok">${json.action}</span>
    </div>
    ${paramRows}
    <div class="viz-result-final">✅ ${label}</div>`;
}

// ── 메인 시각화 흐름 ──
async function runViz(text, apiPromise) {
  const IDS = ['viz-step-1','viz-step-2','viz-step-3','viz-step-4',
                'viz-conn-1','viz-conn-2','viz-conn-3'];
  IDS.forEach(id => {
    const el = document.getElementById(id);
    el.style.display = 'none';
    el.classList.remove('viz-visible', 'viz-active');
  });
  document.getElementById('viz-keywords').innerHTML      = '';
  document.getElementById('viz-sys-text').textContent    = '';
  document.getElementById('viz-usr-text').textContent    = '';
  document.getElementById('viz-raw-response').textContent = '';
  document.getElementById('viz-result').innerHTML        = '';

  vizOverlay.classList.remove('hidden');

  // ─── Step 1: 입력 분석 ───
  const step1 = document.getElementById('viz-step-1');
  revealEl(step1);
  step1.classList.add('viz-active');
  document.getElementById('viz-input-raw').textContent = `"${text}"`;

  await delay(700);

  const kwsEl   = document.getElementById('viz-keywords');
  const keywords = extractKeywords(text);
  for (const kw of keywords) {
    const chip = document.createElement('div');
    chip.className = `viz-keyword-chip kw-${kw.type}`;
    chip.innerHTML = `<span class="chip-word">${kw.word}</span><span class="chip-label">${kw.label}</span>`;
    kwsEl.appendChild(chip);
    await delay(60);
    chip.classList.add('chip-visible');
    await delay(350);
  }

  await delay(350);

  // ─── Connector 1 ───
  const conn1 = document.getElementById('viz-conn-1');
  revealEl(conn1);
  await delay(280);

  // ─── Step 2: 프롬프트 구성 ───
  const step2 = document.getElementById('viz-step-2');
  revealEl(step2);
  step2.classList.add('viz-active');
  step2.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  await delay(180);
  await typeText(document.getElementById('viz-sys-text'), SYS_DISPLAY, 5);
  await delay(280);
  await typeText(document.getElementById('viz-usr-text'), `사용자 명령: "${text}"`, 16);
  await delay(380);

  // ─── Connector 2 ───
  const conn2 = document.getElementById('viz-conn-2');
  revealEl(conn2);
  await delay(280);

  // ─── Step 3: Gemini API ───
  const step3    = document.getElementById('viz-step-3');
  const apiBadge = document.getElementById('viz-api-badge');
  const respEl   = document.getElementById('viz-raw-response');

  revealEl(step3);
  step3.classList.add('viz-active');
  step3.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  apiBadge.textContent = '전송 중...';
  apiBadge.className   = 'viz-api-badge sending';

  // API 응답 대기 (최소 700ms 표시)
  const [json] = await Promise.all([apiPromise, delay(700)]);

  apiBadge.textContent = json.error ? '오류 발생' : '응답 수신!';
  apiBadge.className   = `viz-api-badge ${json.error ? 'errored' : 'received'}`;

  const rawText = json._raw ?? JSON.stringify(
    json.error
      ? { error: json.error }
      : { action: json.action, ...(json.params ? { params: json.params } : {}), ...(json.reason ? { reason: json.reason } : {}) },
    null, 2
  );
  await typeText(respEl, rawText, 9);
  await delay(380);

  // ─── Connector 3 ───
  const conn3 = document.getElementById('viz-conn-3');
  revealEl(conn3);
  await delay(280);

  // ─── Step 4: 해석 & 실행 ───
  const step4 = document.getElementById('viz-step-4');
  revealEl(step4);
  step4.classList.add('viz-active');
  step4.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  document.getElementById('viz-result').innerHTML = buildResultHTML(json);

  if (!json.error) {
    applyResult(json);
  } else {
    llmFeedback.className   = 'err';
    llmFeedback.textContent = `❌ 오류: ${json.error}`;
  }
}
