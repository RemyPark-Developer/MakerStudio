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

## AI 튜터 (서버 프록시 + 사용량 제한)

이전 버전(목업 HTML 데모)은 브라우저가 Anthropic API를 직접 호출했습니다 — 테스트용으로는 괜찮지만
API 키가 누구에게나 노출되고, 무료/유료 사용량 구분이 불가능하다는 문제가 있었습니다
(design doc §5.2, §6 취약점 검토 1번 참고).

지금은 `app/api/tutor/route.ts`가 서버에서만 Anthropic API를 호출하고, `lib/rate-limit.ts`가
하루 10회(무료 플랜 기준)로 사용량을 제한합니다. 실행하려면:

```bash
cp .env.local.example .env.local
# .env.local 파일을 열어 ANTHROPIC_API_KEY=sk-ant-... 채우기
npm run dev
```

⚠️ **알려진 한계 (Phase 3 전까지의 임시 구현)**: 지금은 로그인이 없어서 사용자 대신 IP 주소로
사용량을 구분하고, 카운트는 서버 메모리에만 저장됩니다(재배포하면 초기화, 인스턴스 여러 개면
따로 카운트). Supabase 로그인이 붙으면 `lib/rate-limit.ts`의 주석을 따라 user_id 기반 +
DB/Redis 저장으로 교체해야 합니다. 자세한 내용은 `lib/rate-limit.ts` 상단 주석 참고.

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

## Claude Code로 이어서 개발하기

이 저장소에는 `CLAUDE.md`가 있습니다 — Claude Code가 세션마다 자동으로 읽는 파일로, 절대 원칙(미성년자 결제 차단, Premium 콘텐츠 게이팅 등)과 지금까지 구현된 것을 요약해뒀습니다.

- `docs/` — 설계서·MVP범위·API명세·DB스키마·인증플로우·비기능요구사항·개발순서표 7종 전체
- `supabase/migrations/0001_init.sql` — DB 스키마 문서를 실제 SQL로 옮긴 것. 로컬 Postgres에 실제로 실행해서 제약조건(역할 체크, 보호자 동의 필수 등)이 의도대로 작동하는지 확인 완료.

새 세션을 시작할 때는 `docs/MakerStudio_Dev_Sequence_v1.0.md`를 열어 아직 안 끝난 가장 앞 단계부터 진행하세요.

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
