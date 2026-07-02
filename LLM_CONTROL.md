# LLM 게임 컨트롤 기획안

전공체험용 자연어 명령 인터페이스 — 기존 WebGL/Three.js 게임에 LLM을 붙여 사용자가 자연어로 게임을 조작.

---

## 프로젝트 개요

사용자가 자연어로 명령을 입력하면 LLM이 사전 정의된 게임 액션(JSON)으로 변환하고, 게임이 즉시 실행.

**핵심 원칙**
- LLM은 게임 코드를 직접 수정하지 않음 — "자연어 → 구조화된 명령" 번역기 역할만
- 액션은 화이트리스트로 제한 (예상 범위 내 동작만 수행)
- 패턴: Function Calling / Tool Use → 프롬프트로 JSON 출력 강제

---

## 아키텍처

```
[브라우저 - 텍스트 입력창]
       ↓ fetch POST /api/command
[서버리스 엔드포인트 (Vercel Function)]
       ↓ Claude API (Haiku — 빠름·저렴)
[LLM → JSON 반환]
       ↓ 검증 레이어
       - action이 화이트리스트에 있는가?
       - params 타입/범위 유효한가?
       ↓ 통과 시만
[게임 엔진 - executeAction(json)]
```

> 서버사이드 프록시를 두는 이유: API 키 브라우저 노출 방지. Vercel Function 1개로 충분.

---

## 액션 화이트리스트

LLM은 아래 액션 중에서만 선택. 그 외 요청은 `action: "none"` 반환.

```json
{ "action": "drop_fruit",   "params": { "level": 1, "x_ratio": 0.5 } }
{ "action": "shake",        "params": { "intensity": "light" | "medium" | "hard" } }
{ "action": "flip",         "params": {} }
{ "action": "delete_fruit", "params": { "target": "largest" | "smallest" | "random" } }
{ "action": "set_gravity",  "params": { "direction": "down" | "up" | "left" | "right" } }
{ "action": "spawn_rainbow","params": {} }
{ "action": "none",         "reason": "..." }
```

| action | 설명 | 기존 구현 |
|--------|------|-----------|
| `drop_fruit` | 지정 레벨 과일을 x 위치에 드롭 | 일부 재활용 |
| `shake` | 바구니 흔들기 | ✅ 상점 재활용 |
| `flip` | 바구니 뒤집기 | ✅ 상점 재활용 |
| `delete_fruit` | 특정 조건 과일 삭제 | ✅ 상점 재활용 |
| `set_gravity` | 중력 방향 변경 | 신규 구현 필요 |
| `spawn_rainbow` | 레인보우 과일 즉시 스폰 | 신규 구현 필요 |

---

## 프롬프트 설계

```
System:
  너는 과일 합체 게임의 컨트롤러다.
  사용자의 자연어 명령을 아래 액션 중 하나로 변환해 JSON만 반환한다.
  반드시 허용된 액션 중에서만 선택. 불가능하면 { "action": "none", "reason": "..." }.

  허용 액션: [drop_fruit, shake, flip, delete_fruit, set_gravity, spawn_rainbow]
  level 범위: 1(체리)~11(수박), x_ratio 범위: 0.0(왼쪽)~1.0(오른쪽)

  예시:
  "제일 큰 거 없애줘"      → { "action": "delete_fruit", "params": { "target": "largest" } }
  "수박 떨어뜨려"          → { "action": "drop_fruit", "params": { "level": 11, "x_ratio": 0.5 } }
  "왼쪽에 사과 떨어뜨려"  → { "action": "drop_fruit", "params": { "level": 3, "x_ratio": 0.2 } }
  "핵폭탄 터뜨려"          → { "action": "none", "reason": "지원하지 않는 액션입니다." }
```

---

## 게임 측 통합

`Game.js`에 `executeAction()` 메서드 하나 추가. 기존 코드 변경 최소화.

```js
executeAction({ action, params }) {
  switch (action) {
    case 'drop_fruit':    this._dropAtRatio(params.level, params.x_ratio); break;
    case 'shake':         this._shop.shake(params.intensity); break;
    case 'flip':          this._shop.flip(); break;
    case 'delete_fruit':  this._deleteFruit(params.target); break;
    case 'set_gravity':   this._setGravity(params.direction); break;
    case 'spawn_rainbow': this._spawnRainbow(); break;
  }
}
```

---

## UI

```
┌─────────────────────────────────────┐
│  🤖 AI에게 명령하세요               │
│  ┌──────────────────────┐  [전송]   │
│  │ "사과 왼쪽에 떨어뜨려"│           │
│  └──────────────────────┘           │
│  → 🍎 사과를 왼쪽에 드롭했어요!     │
└─────────────────────────────────────┘
```

- 전송 중 로딩 표시 → 실행 후 피드백 텍스트
- `action: "none"` 이면 "할 수 없는 명령이에요" 안내

---

## 구현 순서

| 단계 | 내용 | 난이도 |
|------|------|--------|
| 1 | `executeAction()` + 기존 상점 액션 연결 | 낮음 |
| 2 | Vercel Function으로 Claude API 프록시 | 낮음 |
| 3 | 프롬프트 튜닝 + 검증 레이어 | 중간 |
| 4 | UI 입력창 + 피드백 텍스트 | 낮음 |
| 5 | `set_gravity` 등 신규 액션 구현 | 높음 |

---

## 모델

**Claude Haiku** 권장
- 응답 속도 ~0.5초, 전공체험 트래픽 수준에서 비용 거의 없음
- JSON 강제 출력은 `tool_use` 방식 또는 system 프롬프트로 처리
