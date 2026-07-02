# AI 자연어 게임 컨트롤

전공체험용 자연어 명령 인터페이스 — 사용자가 한국어로 명령을 입력하면 Gemini LLM이 게임 액션(JSON)으로 변환하고 즉시 실행.

---

## 개요

```
[브라우저 - 하단 AI 명령 입력창]
       ↓ fetch POST /api/llm/command
[Express 서버 (server/routes/llm.js)]
       ↓ Gemini API (gemini-flash-lite-latest)
[LLM → JSON 반환]
       ↓ 검증 레이어 (validateAction)
       - action이 화이트리스트에 있는가?
       - params 타입/범위 유효한가?
       ↓ 통과 시만
[game.executeAction(json) — src/Game.js]
```

**핵심 원칙**
- LLM은 게임 코드를 직접 수정하지 않음 — "자연어 → 구조화된 명령" 번역기 역할만
- 액션은 화이트리스트로 제한, 그 외 요청은 `action: "none"` 반환
- API 키는 서버에서만 보유 (브라우저 노출 없음)

---

## 지원 액션

| action | params | 설명 |
|--------|--------|------|
| `drop_fruit` | `level`: 0~10, `x_ratio`: 0.0~1.0 | 지정 과일을 x 위치에 드롭 |
| `shake` | `intensity`: `"light"` \| `"medium"` \| `"hard"` | 바구니 흔들기 |
| `flip` | — | 바구니 뒤집기 (과일 위아래 반전) |
| `delete_fruit` | `target`: `"largest"` \| `"smallest"` \| `"random"` | 조건에 맞는 과일 삭제 |
| `spawn_rainbow` | — | 레인보우 과일 즉시 드롭 |
| `none` | `reason`: string | 불가 명령 (거부) |

**과일 레벨**

| level | 과일 |
|-------|------|
| 0 | 체리 |
| 1 | 딸기 |
| 2 | 포도 |
| 3 | 귤 |
| 4 | 감 |
| 5 | 사과 |
| 6 | 배 |
| 7 | 복숭아 |
| 8 | 파인애플 |
| 9 | 멜론 |
| 10 | 수박 |

---

## 명령 예시

| 입력 | 결과 |
|------|------|
| `"수박 가운데 떨어뜨려"` | `drop_fruit level:10 x_ratio:0.5` |
| `"왼쪽에 체리 놓아줘"` | `drop_fruit level:0 x_ratio:0.1` |
| `"세게 흔들어"` | `shake intensity:hard` |
| `"뒤집어"` | `flip` |
| `"제일 큰 거 없애줘"` | `delete_fruit target:largest` |
| `"레인보우 소환해"` | `spawn_rainbow` |
| `"게임 끝내줘"` | `none` (거부) |

---

## 모델

**`gemini-flash-lite-latest`** (Google Gemini)
- 무료 티어 동작 확인
- 응답 속도 빠름, 전공체험 트래픽 수준에서 비용 거의 없음
- JSON 출력은 system 프롬프트로 강제

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `server/routes/llm.js` | Gemini 호출 + 액션 검증 라우트 |
| `src/Game.js` | `executeAction()` + 각 액션 메서드 |
| `main.js` | UI 이벤트 처리, fetch 호출, 피드백 표시 |
| `index.html` | 하단 AI 명령 패널 마크업 |
| `style.css` | AI 패널 스타일 |

---

## 환경변수 설정

`server/.env` (로컬) 또는 Render 대시보드 (배포):

```
GEMINI_API_KEY=발급받은_키
```

API 키 발급: [Google AI Studio](https://aistudio.google.com/apikey)
