# MakerStudio 코드베이스 변경 이력

이 파일은 `makerstudio-web-scaffold_vX.X.zip`의 버전과 함께 관리됩니다. 문서(design doc 등)와 마찬가지로, 코드를 전달할 때마다 버전을 올리고 여기에 한 줄씩 남깁니다.

## v1.4 — 2026-08-13

**요약**: v1.3에서 알려진 범위 밖으로 남겨뒀던 퀴즈 게이팅 구멍을 닫음. Premium 콘텐츠가 잠겼을 때 `quiz`(정답 포함) 필드도 code/explain과 함께 제거되도록 수정.

- 수정: `lib/content/gate.ts` — 잠긴 응답에서 `quiz` 필드도 함께 제거
- 수정: `app/examples/[id]/page.tsx` — quiz 데이터가 없을 때 QuizBlock을 렌더링하지 않도록 방어
- 수정: `lib/content/gate.test.ts` — quiz 제거를 검증하는 어서션 추가
- 검증: 실제 API 호출로 잠긴 콘텐츠에서 `quiz` 필드가 응답에 없는 것 확인, 테스트 14개 전부 통과, 클린룸 재검증 통과

## v1.3 — 2026-08-13

**요약**: Dev_Sequence.md 3단계(§7.2 콘텐츠 게이팅) 구현. `app/examples/[id]/page.tsx`가 `generateStaticParams`로 정적 생성되던 것을 동적 렌더링으로 전환.

- 신규: `lib/content/gate.ts` — §7.2의 실제 구현. Premium 콘텐츠는 구독 확인 후에만 code/explain 포함, **확인 실패 시 항상 잠금(fail-closed)**
- 신규: 단위테스트 4개 (`lib/content/gate.test.ts`) — 무료/Premium(비로그인)/Premium(구독확인불가)/미리보기필드 보존 케이스
- 신규: `app/api/content/examples/[id]/route.ts` — `export const dynamic = "force-dynamic"` 명시, 게이팅 로직 호출
- 변경: `lib/schema.ts`에 `isPremium` 필드 추가(기본값 false)
- 변경: `content/examples/ultrasonic.json`을 `isPremium: true`로 표시 — 실제 게이팅 동작을 검증할 실물 테스트 대상
- 변경: `app/examples/[id]/page.tsx` — 서버 컴포넌트+SSG에서 클라이언트 컴포넌트+API fetch로 전환, 잠금 상태 UI(코드/설명 대신 "Premium 구독하기" 카드) 추가
- 검증: 빌드 로그에서 `examples/[id]`가 `●`(SSG)→`ƒ`(Dynamic)로 바뀐 것 확인, 실제 HTTP로 무료 콘텐츠는 code 포함/Premium은 code 필드 자체가 없는 것 확인, 브라우저 스크린샷으로 잠금 UI 실제 렌더링 확인
- 알려진 범위 밖 항목: `quiz` 필드는 현재 게이팅 대상에 포함하지 않음(정답이 잠긴 콘텐츠에도 노출됨) — 설계서에 명시된 범위(code/explain)만 우선 구현, 필요시 다음 버전에서 논의

## v1.2 — 2026-08-13

**요약**: 초등학생 가입의 SMS 발송을 실제 외부 서비스(Solapi)로 정확히 연동. 이전 버전은 콘솔 로그만 찍고 화면에는 "보냈다"고 거짓으로 표시하던 문제가 있었음(사용자 실제 테스트 중 발견) — 이번에 바로잡음.

- 신규: `lib/sms/solapi.ts` — Solapi 공식 SDK 연동. 설정이 안 되어 있으면 명확한 에러를 던짐(침묵하지 않음)
- 수정: `app/api/identity/signup/child/route.ts` — 실제 발송 실패 시 502로 정직하게 응답(이전엔 무조건 200)
- 수정: `.env.local.example` — `SOLAPI_API_KEY`/`SOLAPI_API_SECRET`/`SOLAPI_SENDER_NUMBER` 추가
- 검증: 자격증명 없이 실제 호출 → 502 확인, 브라우저 화면에 "인증번호 발송에 실패했어요" 에러가 실제로 뜨는 것까지 스크린샷으로 확인. 클린룸(테스트10개+빌드) 재검증 통과

## v1.1 — 2026-08-13

**요약**: 프로토타입(HTML)의 랜딩페이지·로그인·회원가입·비밀번호찾기 화면을 실제 Next.js 페이지로 이식하고, v1.0에서 만든 인증 API에 실제로 연결. 라우팅 정리(`/`=랜딩페이지, `/examples`=기존 콘텐츠 목록).

- 신규: `app/page.tsx` — 실제 랜딩페이지 (히어로 라이브 데모, 차별점 3종 기사형 레이아웃, 신뢰배지바)
- 신규: `app/login/page.tsx`, `app/signup/page.tsx`, `app/forgot-password/page.tsx` — 실제 인증 화면, API 실연결
- 신규: `app/api/identity/signup/route.ts` — **API_Spec.md에 빠져있던 걸 발견해서 추가**(이메일/비밀번호 로그인은 있는데 그 계정을 만드는 일반 가입 라우트가 없었음). 다음 API 명세서 개정 때 문서에도 반영 필요
- 이동: `app/page.tsx`(기존 콘텐츠 목록) → `app/examples/page.tsx`
- 확장: `app/globals.css`에 랜딩·인증 화면 스타일 추가 (프로토타입 CSS 변수 그대로 재사용, 새 디자인 시스템 도입 안 함)
- 검증: 실제 브라우저(Playwright)로 랜딩·로그인·가입 화면 스크린샷 확인 + 초등학생 가입 흐름을 끝까지 클릭해서 "동의 미확인" 에러가 실제 화면에 뜨는 것까지 확인

## v1.0 — 2026-08-13

**요약**: Dev_Sequence.md 1~2단계(Supabase 연결 기반 + 인증) 진행. 콘텐츠 파이프라인은 그 이전부터 존재하던 것.

- 신규: `CLAUDE.md` — Claude Code용 프로젝트 가이드, 절대 원칙 4가지 명시
- 신규: `docs/` — 설계서·MVP범위·API명세·DB스키마·인증플로우·비기능요구사항·개발순서표 7종
- 신규: `supabase/migrations/0001_init.sql` — 전체 DB 스키마, 로컬 Postgres로 실제 실행·제약조건 검증 완료
- 신규: `lib/identity/childSignup.ts` + 단위테스트 6개 — 초등학생 보호자 동의 서버 재검증 로직(절대 원칙 4번)
- 신규: `app/api/identity/*` 라우트 6개 — 로그인/로그아웃/비밀번호 찾기·재설정/프로필(me)/초등학생가입 2단계
- 신규: `lib/supabase/server.ts`, `lib/supabase/auth-context.ts` — Supabase 클라이언트 + 인증 헬퍼
- 수정: `package.json` test 스크립트 — bash 글롭 확장 버그로 신규 테스트 폴더가 생기자 기존 테스트가 조용히 스킵되던 문제 수정 (따옴표로 감싸 Node 자체 glob 처리로 전환)
- 검증: 클린룸(새 폴더에 복사 후 처음부터) `npm install`→테스트 10개 통과→콘텐츠검증→빌드까지 확인

**기존(v1.0 이전부터 존재, 이번에 처음 버전 태그를 붙임)**:
- Next.js 스캐폴드, 콘텐츠 플러그인 구조(`content/examples/*.json` 3개, 전부 avr-gcc 컴파일 검증 통과)
- AI 튜터 서버 프록시(`app/api/tutor/route.ts`) + Rate limit(`lib/rate-limit.ts`)
- 콘텐츠 검증 파이프라인(`scripts/validate-content.ts`, `validate-arduino-code.ts`) + GitHub Actions CI

## 다음 버전에 들어갈 것 (예정)
- 소셜 로그인(카카오·구글) 실제 OAuth 연동 — 개발자 콘솔 등록 필요
- `guardian_child_links` 실제 연결 로직
- 나머지 화면 이식(카탈로그·결제·학습화면) — 해당 백엔드 단계가 준비될 때 순서대로
