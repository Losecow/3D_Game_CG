# 🛒 상점 기능 설계

> 게임 내 재화(수박 🍉)로 아이템을 구매할 수 있는 상점 시스템

---

## 💰 재화

- **단위**: 수박 🍉
- **출처**: 게임 중 만든 수박의 **누적 합계** (`users.total_watermelons`)
- **차감 시점**: 아이템 구매 시 즉시 차감
- **환불**: 없음
- **비로그인 시**: 상점 사용 불가 (로그인 유도 메시지 표시)

---

## 🛍️ 판매 품목

### 1. 섞기 (흔들기)
- **가격**: 🍉 1개
- **효과**: 박스 안의 모든 과일에 랜덤 방향으로 힘을 가해 위치를 섞음
- **제한**: 게임당 1회 사용 가능
- **구현 포인트**: cannon-es `body.applyImpulse()` 로 각 과일에 랜덤 impulse 적용

### 2. 과일 삭제
- **가격**: 🍉 1개
- **효과**: 클릭으로 직접 지정한 과일 1개 제거
- **제한**: 구매 후 삭제 대상 클릭 모드 진입 → 과일 클릭 시 즉시 제거
- **구현 포인트**: 구매 후 클릭 이벤트를 삭제 모드로 전환, 과일 선택 시 `destroy()` 호출

### 3. 닉네임 변경권
- **가격**: 🍉 1개
- **효과**: 구매 즉시 닉네임 변경 모달 오픈 (소모품)
- **제한**: 구매와 동시에 사용, 미사용 보관 불가
- **구현 포인트**: 기존 `/api/me/nickname` PUT 엔드포인트 재사용, 차감 후 모달 열기

---

## 🖥️ UI

- **상점 버튼**: 게임 화면 UI 패널에 🛒 버튼 추가 (게임 중에도 접근 가능)
- **상점 모달**: 설정 모달과 동일한 스타일
  - 보유 수박 수 표시 (상단)
  - 아이템 카드 3개 (이름 / 설명 / 가격 / 구매 버튼)
  - 잔액 부족 시 버튼 비활성화
  - 비로그인 시 전체 비활성화 + 로그인 유도 문구
- **인게임 퀵 버튼**: 구매한 즉시 사용 아이템(섞기, 과일 삭제)은 게임 화면에 퀵 버튼으로 표시

---

## 🗄️ DB 변경사항

### `users` 테이블
```sql
-- 이미 존재하는 컬럼 (재화로 사용)
total_watermelons INTEGER DEFAULT 0
```
> 별도 재화 컬럼 없이 `total_watermelons` 를 재화로 직접 사용

### `shop_purchases` 테이블 (신규)
```sql
CREATE TABLE shop_purchases (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  item_id    VARCHAR(50) NOT NULL,   -- 'shake' | 'delete' | 'nickname'
  cost       INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔌 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET`  | `/api/shop/items`    | 상점 품목 목록 + 현재 보유 수박 수 |
| `POST` | `/api/shop/purchase` | 아이템 구매 (재화 차감 + 구매 이력 저장) |

### POST /api/shop/purchase
```json
// Request
{ "item_id": "shake" }

// Response
{ "ok": true, "total_watermelons": 12 }

// Error
{ "error": "insufficient_funds" }
```

---

## 📋 확정 사항

| 항목 | 결정 |
|------|------|
| 아이템 가격 | 모두 🍉 1개 |
| 게임 중 상점 접근 | 허용 (일시정지 없음) |
| 섞기 횟수 제한 | 게임당 1회 |
| 과일 삭제 방식 | 구매 후 클릭으로 직접 지정 |
| 닉네임 변경권 보관 | 소모품, 구매 즉시 사용 |
| 비로그인 처리 | 상점 사용 불가 |
