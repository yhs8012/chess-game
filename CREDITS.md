# CREDITS

이 프로젝트에 들어간 외부 자원과 라이선스입니다. 새 자원을 추가하면 여기에 꼭 기록해 주세요.

## 3D 모델

| 자원 | 출처 | 라이선스 |
|---|---|---|
| **기물 `public/models/chess-set.glb`** — "A Beautiful Game" | 원본 모델: MaterialX Project / © 2020 ASWF · glTF 변환: © 2022 Ed Mackey · [KhronosGroup/glTF-Sample-Assets › Models/ABeautifulGame](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/ABeautifulGame) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| 임시 기물 (GLB를 못 불러올 때) | 코드로 직접 생성 (`src/scene/pieces/latheGeometry.ts`) | 프로젝트와 동일 |

> **변경 사항 (CC BY 4.0 요구)**: 백 기물 6종만 남기고 보드·재질·텍스처를 제거, 기물당 약 4,500 삼각형으로 단순화, 나이트 방향 회전, Draco 압축.
> 변환 스크립트: `scripts/build-chess-model.mjs`. 게임 안 Help 패널·설정 메뉴에도 출처를 표시합니다.

## 텍스처

| 자원 | 출처 | 라이선스 |
|---|---|---|
| 메이플·월넛·마호가니·회양목·흑단·테이블 나뭇결 | 캔버스로 절차적 생성 (`src/scene/materials.ts`) | 프로젝트와 동일 |
| UI 종이 질감 | SVG `feTurbulence` 노이즈 (`src/styles.css`) | 프로젝트와 동일 |

## 사운드

| 자원 | 출처 | 라이선스 |
|---|---|---|
| 모든 효과음 (틱·톡·쾅·차임·경고음·팡파르·종소리·삑) | Web Audio API 합성음 (`src/audio/synth.ts`) | 프로젝트와 동일 |
| "Checkmate!" / "Check!" 음성 | 브라우저 내장 TTS (Web Speech API) | 사용자 OS·브라우저의 음성 |

> CC0 효과음 파일은 `public/sounds/`에 넣고 `public/sounds/sounds.json`에 등록하세요.

## 폰트

| 자원 | 출처 | 라이선스 |
|---|---|---|
| EB Garamond (UI 제목, 3D 좌표 라벨) | [Google Fonts](https://fonts.google.com/specimen/EB+Garamond) via `@fontsource/eb-garamond` | SIL Open Font License 1.1 |
| Droid Serif Bold typeface ("CHECKMATE!" / "DRAW" 3D 글자) | three.js `examples/fonts/droid` (Google Droid fonts) | Apache License 2.0 |

## 라이브러리

| 라이브러리 | 라이선스 |
|---|---|
| Draco 디코더 (`public/draco/`, three.js 동봉) | Apache License 2.0 |
| chess.js | BSD-2-Clause |
| three.js, @react-three/fiber, @react-three/drei, @react-three/postprocessing, postprocessing | MIT |
| React | MIT |
| Howler.js | MIT |
