# Staunton 3D Chess

브라우저에서 플레이하는 클래식 우드 3D 체스. 규칙 판정은 [chess.js](https://github.com/jhlywa/chess.js)가 맡고, 3D는 three.js + React Three Fiber로 그립니다.

## 실행

```bash
npm install
npm run dev      # 개발 서버 (http://localhost:5173)
npm run test     # 엔진·좌표·도움말 로직 단위 테스트 (Vitest)
npm run build    # 타입 검사 + 프로덕션 빌드 → dist/
npm run preview  # 빌드 결과 미리보기
```

## 기능

- **대국**: 같은 화면 2인 대전, 컴퓨터 대전(쉬움 = 무작위 / 보통 = 깊이 2 / 어려움 = 깊이 3, Web Worker에서 계산)
- **규칙**: 캐슬링·앙파상·프로모션(선택 창), 체크·체크메이트·스테일메이트, 50수·3회 반복·기물 부족 무승부
- **좌표 확인**: 황동 좌표 라벨(항상 카메라를 바라봄), 호버 칸 테두리 + 좌하단 좌표 표시, 기보 클릭 시 출발·도착 칸 깜빡임, 백/흑/위에서 시점 프리셋
- **연출**: 포물선 이동(나이트는 높이 점프), 착지 먼지, 잡기 나무 파편·플래시·흔들림, 캐슬링 순차 이동, 프로모션 빛기둥, 체크 붉은 글로우·화면 테두리, 체크메이트 줌인·킹 쓰러짐·"CHECKMATE!" 3D 글자·음성, 승리 컨페티·발광, 무승부 어두워짐·"DRAW"
- **소리**: Web Audio 합성 효과음(파일로 교체 가능), 브라우저 TTS "Checkmate!" / "Check!", 음소거·볼륨(localStorage 저장)
- **규칙 도움말**: `?` 버튼 또는 `H`. 선택한 말의 이동 패턴(파란 칸)·합법 수(연두 점)·못 가는 이유 툴팁, 체크·캐슬링·앙파상·프로모션 상황 안내, 5×5 미니 데모 기물 카드. 열려 있는 동안 AI와 대국 시계가 멈춤
- **설정**: 좌표 라벨, 효과 줄이기, 턴마다 시점 전환, "Check!" 음성, 대국 모드·난이도·내 색

## 조작

| 동작 | 방법 |
|---|---|
| 말 선택·이동 | 말 클릭 → 연두 점(이동) 또는 붉은 테두리(잡기) 칸 클릭 |
| 시점 회전·줌 | 드래그 / 휠·핀치 |
| 도움말 | `H` 또는 `?`, 닫기 `Esc` |
| 프로모션 | 창에서 선택 또는 `Q` `R` `B` `N` |

## 에셋 바꾸기

- **기물 모델**: 지금은 Khronos 샘플 "A Beautiful Game"(CC BY 4.0)을 변환해 씁니다. 원본 GLB를 받아 `node scripts/build-chess-model.mjs ABeautifulGame.glb`로 다시 만들 수 있고, 다른 모델로 바꾸려면 [public/models/README.md](public/models/README.md) 참고
- **효과음**: `public/sounds/` + `sounds.json` — [public/sounds/README.md](public/sounds/README.md)
- 추가한 자원의 출처·라이선스는 [CREDITS.md](CREDITS.md)에 기록

## 구조

설계 원칙과 폴더 구조는 [CLAUDE.md](CLAUDE.md)를 따릅니다. 요약하면:

- `src/engine/` — chess.js 래퍼(불변 `GameState`, Move → 이벤트), 기물 id 추적, AI. React·Three.js를 import하지 않음
- `src/scene/coords.ts` — 보드 좌표 ↔ 3D 위치 변환의 유일한 진실
- `src/effects/`, `src/audio/` — 엔진 이벤트 버스를 구독해 연출·소리 재생
- `src/ui/` — HTML 오버레이, `src/ui/help/` — 규칙 도움말

## 배포

`main` 브랜치에 push하면 `.github/workflows/deploy.yml`이 GitHub Pages로 배포합니다.
저장소 Settings → Pages → Source를 **GitHub Actions**로 한 번 설정해 주세요.
빌드는 상대 경로(`base: './'`)라 어느 하위 경로에 올려도 동작합니다.
