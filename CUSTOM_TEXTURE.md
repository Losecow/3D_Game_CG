# 커스텀 텍스쳐 기능 설계

## 개요

웹캠으로 실시간 촬영한 사진을 과일 텍스쳐로 적용하는 기능.  
DB 저장 없이 로컬 세션에서만 동작하며, 새로고침하면 초기화된다.

## 사용자 플로우

```
[📷 카메라] 버튼 클릭
    ↓
카메라 권한 요청 (getUserMedia)
    ↓
모달 오픈: 실시간 웹캠 미리보기
    ↓
[촬영] 버튼 클릭 → 캔버스에 프레임 캡처
    ↓
적용할 과일 레벨 선택 (과일 미리보기 그리드)
    ↓
해당 레벨 과일의 텍스쳐가 사진으로 교체
    ↓
모달 닫기 → 게임 재개
```

## 결정 사항

| 항목 | 결정 | 이유 |
|------|------|------|
| 저장 방식 | 로컬 메모리만 (새로고침 초기화) | DB 불필요, 단순함 |
| 적용 과일 | 유저가 선택 (1~11개 중 1개) | 자유도 부여 |
| 동시 적용 수 | 레벨당 1개, 여러 레벨 가능 | 여러 사진 촬영 후 각각 지정 |
| 이미지 소스 | 웹캠 촬영 또는 파일 업로드 | 카메라 없는 환경 대비 |
| 텍스쳐 형태 | `THREE.CanvasTexture` | blob URL보다 메모리 효율적 |
| 적용 시점 | 모달 닫는 즉시 | 이미 떨어진 과일은 유지, 이후 스폰되는 과일부터 적용 |
| HTTPS 필요 | 있음 (`getUserMedia` 요구사항) | 로컬 dev(localhost)는 예외 |

## 기술 구현

### 파일 구조

```
src/
  CameraModal.js   ← 신규: 카메라 UI + 캡처 로직
  TextureStore.js  ← 신규: 커스텀 텍스쳐 전역 저장소
  Fruit.js         ← 수정: 스폰 시 TextureStore 먼저 확인
main.js            ← 수정: CameraModal 인스턴스화
index.html         ← 수정: 카메라 버튼 + 모달 HTML
style.css          ← 수정: 카메라 모달 스타일
```

### TextureStore (전역 커스텀 텍스쳐 저장소)

```js
// src/TextureStore.js
const _custom = new Map(); // level → THREE.CanvasTexture

export function setCustomTexture(level, texture) { _custom.set(level, texture); }
export function getCustomTexture(level)           { return _custom.get(level) ?? null; }
export function clearCustomTexture(level)         { _custom.delete(level); }
```

### Fruit.js 수정

`_buildMesh`에서 `_texCache` 조회 전에 `getCustomTexture(this.level)` 먼저 확인.

### CameraModal.js 역할

- `getUserMedia({ video: true })` 로 스트림 열기
- `<video>` 태그에 스트림 연결, 실시간 미리보기
- 촬영: `canvas.drawImage(video, ...)` → 정사각형 크롭
- 과일 선택 UI: 11개 과일 미리보기 그리드
- 선택 확정 → `new THREE.CanvasTexture(canvas)` → `setCustomTexture(level, tex)`
- 파일 업로드 대안: `<input type="file" accept="image/*">` → `FileReader` → Image → canvas

## UI 위치

- **버튼**: `#ui` 패널 하단 (상점 버튼 아래)  
- **모달**: 다른 모달과 동일한 중앙 오버레이

## 미결 사항

- [ ] 촬영한 사진을 원형으로 마스킹할지 (과일이 구체라 둥근 게 자연스러움)
- [ ] 여러 레벨에 같은 사진 한번에 적용하는 "전체 적용" 버튼 여부
- [ ] 이미 씬에 있는 과일에도 즉시 반영할지 (현재: 이후 스폰되는 것만)
