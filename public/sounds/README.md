# 효과음 파일

여기에 **CC0 라이선스** 효과음 파일을 넣고 `sounds.json`에 등록하면, 합성음 대신 그 파일이 재생됩니다.

```json
{
  "select": "select.mp3",
  "move": "move.mp3",
  "capture": "capture.mp3",
  "promotion": "promotion.mp3",
  "check": "check.mp3",
  "checkmate": "checkmate.mp3",
  "victory": "victory.mp3",
  "draw": "draw.mp3",
  "invalid": "invalid.mp3"
}
```

등록하지 않은 소리는 `src/audio/synth.ts`의 Web Audio 합성음으로 재생됩니다.
파일을 추가했다면 `CREDITS.md`에 출처와 라이선스를 적어 주세요.
