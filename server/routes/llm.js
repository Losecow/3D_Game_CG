const express = require('express');
const { GoogleGenAI } = require('@google/genai');

const router = express.Router();

const ALLOWED_ACTIONS = ['drop_fruit', 'shake', 'flip', 'delete_fruit', 'spawn_rainbow', 'none'];

const SYSTEM_PROMPT = `너는 과일 합체 3D 게임의 AI 컨트롤러다.
사용자의 자연어 명령을 아래 액션 중 하나로 변환해 JSON만 반환한다.
설명 없이 JSON 오브젝트만 출력할 것.
한 번에 과일 1개만 드롭 가능하다. 수량을 지정하는 명령(예: "2개", "세 개", "다섯개" 등)은 반드시 none으로 거부하고, reason에 "한 번에 과일 1개만 드롭할 수 있어요."라고 안내할 것.

허용 액션:
- drop_fruit: 과일을 특정 위치에 드롭. x_ratio(0.0=왼쪽~1.0=오른쪽), z_ratio(0.0=위쪽~1.0=아래쪽, 생략 시 중앙). 과일 종류를 명시한 경우에만 level(0~10) 포함, 명시하지 않으면 level 생략. 특정 과일 위에 드롭할 때는 x_ratio 대신 target_level(0~10) 사용.
- shake: 바구니 흔들기. intensity: "light" | "medium" | "hard"
- flip: 바구니 뒤집기 (모든 과일 위아래 반전)
- delete_fruit: 과일 삭제. target: "largest" | "smallest" | "random"
- spawn_rainbow: 레인보우 과일(특수) 드롭
- none: 이해할 수 없거나 허용되지 않는 명령. reason 필드 포함.

과일 레벨 목록 (level 숫자):
0=체리, 1=딸기, 2=포도, 3=귤, 4=감, 5=사과, 6=배, 7=복숭아, 8=파인애플, 9=멜론, 10=수박

예시:
"수박 가운데 떨어뜨려" → {"action":"drop_fruit","params":{"level":10,"x_ratio":0.5}}
"왼쪽에 체리 놓아줘" → {"action":"drop_fruit","params":{"level":0,"x_ratio":0.1}}
"왼쪽에 떨어뜨려" → {"action":"drop_fruit","params":{"x_ratio":0.2}}
"오른쪽에 드롭해" → {"action":"drop_fruit","params":{"x_ratio":0.8}}
"왼쪽 위에 드롭" → {"action":"drop_fruit","params":{"x_ratio":0.2,"z_ratio":0.1}}
"오른쪽 아래에 드롭" → {"action":"drop_fruit","params":{"x_ratio":0.8,"z_ratio":0.9}}
"포도 딸기 위에 드랍" → {"action":"drop_fruit","params":{"level":2,"target_level":1}}
"세게 흔들어" → {"action":"shake","params":{"intensity":"hard"}}
"뒤집어" → {"action":"flip","params":{}}
"제일 큰 거 없애줘" → {"action":"delete_fruit","params":{"target":"largest"}}
"레인보우 소환해" → {"action":"spawn_rainbow","params":{}}
"게임 끝내줘" → {"action":"none","reason":"지원하지 않는 명령입니다."}
"감 다섯개 드랍" → {"action":"none","reason":"한 번에 과일 1개만 드롭할 수 있어요."}`;

function validateAction(parsed) {
  if (!parsed || !ALLOWED_ACTIONS.includes(parsed.action)) return false;
  const { action, params } = parsed;

  if (action === 'drop_fruit') {
    const { level, x_ratio, z_ratio, target_level } = params ?? {};
    if (level !== undefined && level !== null && (!Number.isInteger(level) || level < 0 || level > 10)) return false;
    if (z_ratio !== undefined && (typeof z_ratio !== 'number' || z_ratio < 0 || z_ratio > 1)) return false;
    if (target_level !== undefined) return Number.isInteger(target_level) && target_level >= 0 && target_level <= 10;
    return typeof x_ratio === 'number' && x_ratio >= 0 && x_ratio <= 1;
  }
  if (action === 'shake') {
    return ['light', 'medium', 'hard'].includes(params?.intensity);
  }
  if (action === 'delete_fruit') {
    return ['largest', 'smallest', 'random'].includes(params?.target);
  }
  return true; // flip, spawn_rainbow, none
}

router.post('/command', async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'text 필드가 필요합니다.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: `${SYSTEM_PROMPT}\n\n사용자 명령: "${text.trim()}"`,
    });

    const raw = response.text.trim().replace(/^```json\s*|```$/g, '').trim();
    const parsed = JSON.parse(raw);

    if (!validateAction(parsed)) {
      return res.json({ action: 'none', reason: '유효하지 않은 액션입니다.' });
    }

    res.json(parsed);
  } catch (err) {
    console.error('[LLM] error:', err.message);
    res.status(500).json({ error: 'LLM 호출 실패', detail: err.message });
  }
});

module.exports = router;
