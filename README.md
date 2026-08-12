# MakerStudio Web (스캐폴드)

`MakerStudio_Project_Design_v2.md`의 §5(기술 아키텍처), §6(AI 콘텐츠 파이프라인) 설계를
실제로 실행 가능한 형태로 옮긴 최소 스캐폴드입니다. 로그인/결제/AI튜터는 아직 없고,
**"콘텐츠 = 데이터, 코드 = 렌더러"인 플러그인 구조가 실제로 동작하는지**를 확인하는 것이
이 스캐폴드의 목적입니다.

## 실행해보기

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:3000 을 열면 Blink / Fade 두 예제가 목록으로 뜨고,
클릭하면 각 예제 상세 페이지(부품/코드/설명/미션/퀴즈)가 보입니다.

## 핵심 구조 — "플러그인"이 실제로 어떻게 동작하는가

```
content/examples/blink.json   ─┐
content/examples/fade.json    ─┼─▶  lib/content.ts (스키마 검증 + 로드) ─▶  app/page.tsx, app/examples/[id]/page.tsx
content/examples/(새 파일).json ─┘
```

`app/page.tsx`와 `app/examples/[id]/page.tsx`는 예제 내용을 코드에 직접 담고 있지 않습니다.
전부 `content/examples/*.json`을 읽어서 화면을 그립니다. 즉:

**새 예제를 추가하려면 코드를 한 줄도 안 고치고, `content/examples/` 에 `lib/schema.ts`의
`ExampleSchema`에 맞는 JSON 파일 하나만 추가하면 됩니다.**

한번 시험해보세요 — `content/examples/button.json`을 아래처럼 만들고 `npm run dev`를 다시 실행해보시면,
홈 화면에 세 번째 카드가 자동으로 나타납니다.

```json
{
  "id": "button",
  "icon": "🔘",
  "label": "Button",
  "board": "Arduino UNO",
  "difficulty": 1,
  "estimatedMinutes": 20,
  "pin": "D2",
  "intro": "버튼을 눌렀을 때만 LED가 켜지도록 만들어봅니다.",
  "parts": ["Arduino UNO", "브레드보드", "LED", "220Ω 저항", "푸시 버튼", "10kΩ 저항"],
  "codeFilename": "button.ino",
  "code": "const int buttonPin = 2;\nconst int ledPin = 13;\n\nvoid setup() {\n  pinMode(buttonPin, INPUT);\n  pinMode(ledPin, OUTPUT);\n}\n\nvoid loop() {\n  int state = digitalRead(buttonPin);\n  digitalWrite(ledPin, state);\n}",
  "explain": "digitalRead(pin)은 핀의 상태(HIGH/LOW)를 읽어옵니다.",
  "mission": "버튼을 누르지 않았을 때 켜지고, 눌렀을 때 꺼지도록 바꿔보세요.",
  "quiz": {
    "question": "digitalRead()가 반환하는 값은?",
    "options": ["0~255", "HIGH 또는 LOW", "문자열"],
    "answer": 1,
    "explain": "digitalRead()는 HIGH 또는 LOW 둘 중 하나만 반환합니다."
  },
  "sourceExample": "Arduino IDE 기본 제공 예제 - Digital > Button (public domain)"
}
```

## 콘텐츠 검증 (§6.3의 "2단계 자동 검증"에 해당)

두 단계로 검증합니다.

```bash
npm run validate-content   # JSON 스키마 검사
npm run validate-arduino   # 진짜 avr-gcc로 컴파일 검증 (Arduino UNO만 지원)
```

`validate-arduino`는 시뮬레이션이 아니라 실제 avr-gcc + Arduino 코어 소스로 컴파일합니다.
로컬에서 돌리려면 AVR 툴체인이 필요합니다 (Ubuntu/Debian 기준):

```bash
sudo apt-get install gcc-avr avr-libc binutils-avr arduino-core-avr
```

`.github/workflows/ci.yml`이 PR마다 이 두 스크립트를 모두 자동으로 실행합니다 — AI가 만든 콘텐츠
모듈도 스키마 검증과 실제 컴파일을 둘 다 통과해야만 사람 검수 단계로 넘어갈 수 있습니다.

> 현재는 Arduino UNO(atmega328p)만 지원합니다. ESP32/Pico/micro:bit 등 다른 보드가 추가되면
> `scripts/validate-arduino-code.ts`에 보드별 툴체인 분기를 추가해야 합니다 (design doc §6.5 참고).

## 폴더 구조

```
app/                    Next.js 페이지 (App Router)
  page.tsx               홈 — 예제 목록
  examples/[id]/page.tsx  예제 상세 페이지
lib/
  schema.ts               콘텐츠 스키마 (zod)
  content.ts               JSON 로더 + 검증
content/
  examples/*.json          예제(모듈) 데이터 — "플러그인"
scripts/
  validate-content.ts       CI에서 실행되는 검증 스크립트
.github/workflows/ci.yml    빌드 + 콘텐츠 검증 자동화
```

## 다음 단계 (design doc 로드맵 기준)

- [ ] Supabase 연동 (로그인, 진도 저장) — §5.2
- [ ] Wokwi 임베드로 회로 시뮬레이션 교체 — §5.2, §5.3
- [ ] AI 튜터 서버 프록시 (`/api/tutor`) 추가 — §5.2
- [ ] `content/courses/*.json` + course 스키마로 복합 키트 코스 지원 — §6.5
- [ ] 포트원 결제 연동 — §4.4

## Git / GitHub로 시작하기

```bash
git init
git add .
git commit -m "chore: initial MakerStudio web scaffold"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

이후 새 콘텐츠는 `content/새예제` 브랜치를 만들어 PR로 올리면,
`.github/workflows/ci.yml`이 자동으로 검증합니다 (design doc §5.4 참고).
