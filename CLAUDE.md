# CLAUDE.md — MakerStudio 개발 가이드

Claude Code가 이 저장소에서 작업할 때 항상 먼저 읽어야 하는 파일입니다. 상세 설계는 아래 문서를 참고하세요 (이 파일에 중복 작성하지 않음 — 문서가 둘로 갈라지면 둘 다 낡습니다):

- `docs/MakerStudio_Project_Design_v2.4.md` — 전체 설계 배경("왜")
- `docs/MakerStudio_MVP_Scope_v1.2.md` — 지금 뭘 만들어야 하는지(Must/Should/Could/Won't)
- `docs/MakerStudio_API_Spec_v1.0.md`, `DB_Schema`, `Auth_Flow`, `NonFunctional_Requirements` — 기술 명세
- `docs/MakerStudio_Dev_Sequence_v1.0.md` — 지금 순서상 뭘 먼저 짜야 하는지

## 절대 원칙 (다른 무엇보다 우선)

1. **미성년 학습자 화면에 결제 관련 코드를 절대 넣지 않는다.** `role=student_child` 또는 `student_teen`인 요청이 `billing/*` API에 닿으면 무조건 `403`. UI에서 버튼을 숨기는 것만으로 끝내지 않는다 (`Auth_Flow.md` §3).
2. **Premium 콘텐츠는 정적 생성(SSG)하지 않는다.** `content/examples/:id` 응답은 항상 서버에서 구독 상태를 확인한 뒤 `code`/`explain` 필드 포함 여부를 결정한다 (`Design.md` §7.2).
3. **계정 삭제와 환불은 분리된 프로세스다.** 삭제 요청이 환불을 막지 않는다 (`Design.md` §4.5).
4. **만 14세 미만 가입 시 서버가 SMS 인증 성공 여부를 반드시 재확인한다.** 클라이언트가 보낸 동의값만 믿지 않는다 (`Auth_Flow.md` §2.3).

이 4가지는 스코프 협상이나 일정 단축의 대상이 아닙니다. 급하다고 이 부분을 건너뛰지 마세요.

## 코드를 짤 때 항상 지키는 것

- **콘텐츠 검증**: `content/examples/`에 파일을 추가/수정하면 `npm run validate-content`와 `npm run validate-arduino`를 반드시 통과해야 함. CI가 자동으로 막지만, 로컬에서 먼저 돌려볼 것.
- **테스트**: 결제·인증 관련 로직은 단위 테스트 없이 커밋하지 않는다 (`lib/rate-limit.test.ts` 참고 패턴).
- **도메인 분리**: 새 API 라우트는 `app/api/{domain}/...` 형태로, `identity`/`billing`/`content`/`learning`/`notifications`/`commerce` 중 하나에 속하게 만든다. 도메인끼리는 직접 DB를 건드리지 않고 함수 호출/이벤트로 통신한다 (`Design.md` §5.5).
- **버전 관리**: 위 `docs/` 문서 중 하나라도 이 저장소의 결정과 달라지면, 코드보다 문서를 먼저 고치고 커밋 메시지에 사유를 남긴다. 문서가 낡으면 다음 세션(다른 AI든 사람이든)이 잘못된 전제로 작업하게 된다.
- **환경 변수**: `.env.local`에만 시크릿 저장, 커밋 금지. 새 시크릿이 필요하면 `.env.local.example`에 키 이름만 추가.

## 지금까지 실제로 구현된 것 (재구현하지 말고 재사용)

- `app/api/tutor/route.ts` — AI 튜터 서버 프록시. Rate limit 포함(현재 IP 기준, DB 붙으면 `lib/rate-limit.ts` 주석대로 user_id로 전환).
- `content/examples/*.json` — Blink/Fade/초음파센서 3개, 전부 실제 avr-gcc 컴파일 검증 통과.
- `scripts/validate-content.ts`, `scripts/validate-arduino-code.ts` — 콘텐츠 검증 파이프라인, CI에 연결됨.
- `lib/schema.ts` — 콘텐츠 zod 스키마 (다국어 대비 구조로 확장 예정, `Design.md` §6.2 참고).
- `lib/identity/childSignup.ts` — 초등학생 보호자 동의 재검증 로직 (절대 원칙 4번의 실제 구현, 단위테스트 6개로 검증됨).
- `app/api/identity/*` — 로그인·로그아웃·비밀번호 찾기/재설정·프로필(me)·일반가입·초등학생 가입 2단계, 전부 라우트 존재. **단, 실제 Supabase 프로젝트 연결 전이라 Supabase 호출 지점에서는 에러가 남 — 이건 정상.** `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`를 `.env.local`에 채우면 바로 작동하도록 짜여 있음.
- `lib/supabase/server.ts`, `lib/supabase/auth-context.ts` — Supabase 서버 클라이언트 + 인증 헬퍼.
- `supabase/migrations/0001_init.sql` — DB 스키마 전체, 로컬 Postgres로 실제 실행 검증 완료(제약조건 포함).
- `app/page.tsx`(랜딩), `app/login`, `app/signup`, `app/forgot-password` — 프로토타입에서 이식한 실제 화면, 위 API에 실제 연결됨. 콘텐츠 목록은 `app/examples`로 이동함.
- `lib/sms/solapi.ts` — 실제 SMS 발송(Solapi). **설정 안 되어 있으면 명확히 실패함(성공한 척 안 함) — 이 원칙을 다른 외부 서비스 연동(포트원 등)에도 그대로 적용할 것.**

## 아직 안 된 것 (2단계 잔여)

- 소셜 로그인(카카오·구글) OAuth 콜백 자체 연동 — Supabase 프로젝트에서 OAuth 프로바이더 설정 필요
- `guardian_child_links` 실제 연결 로직 (초등학생 가입 완료 시 보호자 계정과 매칭하는 부분, `app/api/identity/signup/child/verify/route.ts`의 TODO 참고)
- 나머지 화면 이식(카탈로그·결제·학습화면) — Dev_Sequence.md 기준 해당 백엔드 단계가 준비될 때 순서대로

## 지금 뭘 해야 하는지 모르겠으면

`docs/MakerStudio_Dev_Sequence_v1.0.md`를 열어서 아직 안 끝난 가장 앞 단계부터 시작하세요. 순서를 건너뛰지 마세요 — 예를 들어 DB 스키마 없이 결제 연동부터 시작하면 나중에 되돌리는 비용이 큽니다.
