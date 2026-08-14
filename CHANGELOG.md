# MakerStudio 코드베이스 변경 이력

이 파일은 `makerstudio-web-scaffold_vX.X.zip`의 버전과 함께 관리됩니다. 문서(design doc 등)와 마찬가지로, 코드를 전달할 때마다 버전을 올리고 여기에 한 줄씩 남깁니다.

## v2.3 — 2026-08-14

**요약**: 로그인 상태가 실제로는 유지되고 있는데도, 랜딩페이지 상단바와 로그인 페이지가 이걸 전혀 확인하지 않아서 "로그인했는데도 계속 로그인하라고 하는 것처럼 보이는" UX 문제 수정.

- 신규: `app/NavAuthButtons.tsx` — 로그인 여부에 따라 "로그인/무료로 시작하기" 또는 "마이페이지/로그아웃"을 보여주는 클라이언트 컴포넌트. 랜딩페이지 나머지는 그대로 서버 렌더링(SEO 유지), 상단바만 분리해서 로그인 상태 확인
- 변경: `app/page.tsx` — 상단바를 `NavAuthButtons`로 교체
- 변경: `app/login/page.tsx` — 이미 로그인된 상태로 `/login`에 재방문하면 자동으로 `/mypage`로 이동
- 검증: 브라우저로 로그아웃 상태/로그인 상태 두 화면 다 스크린샷 확인, 클린룸 재검증(테스트15+빌드) 통과. `/`가 여전히 정적 페이지(○)로 남아있는 것도 확인 — SEO 목적의 정적 생성이 이번 변경으로 깨지지 않음

## v2.2 — 2026-08-14 (진짜 근본 원인 수정)

**요약**: v2.1의 진단 로그로 실사용자 터미널에서 정확한 원인을 확인함 — Postgres 에러 `42501 permission denied for table profiles`. **v1.9까지의 토큰 경쟁조건도, v2.0의 반쪽 계정 문제도 전부 실재하는 버그였지만, 진짜 최종 원인은 따로 있었음.**

- **근본 원인**: Supabase 프로젝트 생성 시 대표님께 "Automatically expose new tables"를 끄시라고 권했었는데(§보안 강화 목적), 이 설정이 "API 노출 제어"뿐 아니라 **"새 테이블에 service_role 권한을 자동으로 부여하는 것"까지 같이 꺼버렸음**. 그 결과 0001~0003에서 SQL Editor로 만든 모든 테이블이 service_role조차 못 읽고 못 쓰는 상태였음
- 신규: `supabase/migrations/0004_grant_service_role.sql` — `public` 스키마 전체에 service_role 권한을 명시적으로 부여하고, `ALTER DEFAULT PRIVILEGES`로 앞으로 만드는 테이블에도 자동 적용되도록 설정(재발 방지)
- 검증: 로컬 Postgres에 실사용자와 동일한 `42501` 에러를 실제로 재현 → 수정 SQL 적용 후 해결 확인 → 0001~0004 전체 순서로 처음부터 다시 적용해 문제없음 확인 → **가입(트리거로 프로필 자동생성)부터 조회, AI튜터 사용량 확인까지 전체 흐름을 service_role 권한으로 엔드투엔드 실행 성공**
- 이번 사례에서 배운 것: `lib/supabase/auth-context.ts`가 `profiles` 조회 실패 시 에러 내용을 버리고 있어서 실제 원인이 안 보였음(v2.1에서 로그 추가로 해결) — **에러를 조용히 삼키지 않고 항상 로그로 남기는 습관이, 이번처럼 예상 밖의 인프라 설정 문제를 찾는 데 결정적이었음**

## v2.1 — 2026-08-14 (진단용 릴리스)

**요약**: v2.0 적용 후에도 마이페이지 401이 재현됨. 이번엔 profiles 행이 실제로 존재하는데도 실패해서, v2.0의 진단(반쪽 계정)이 전체 원인은 아니었던 것으로 보임. **아직 진짜 원인을 못 찾았고, 정확히 찾기 위한 진단 로그를 추가한 버전.**

- 변경: `lib/supabase/auth-context.ts`의 `getAuthedUser()` — 각 단계(토큰 파싱, `auth.getUser()` 결과, `profiles` 조회 결과/에러)마다 콘솔 로그 추가. **기존 코드는 `profiles` 조회 실패 시 에러 내용을 그대로 버리고 있었음 — 그게 진짜 원인을 숨기고 있었을 가능성이 있음**
- 확인: `@supabase/supabase-js`는 이미 최신 버전(2.112.3) 사용 중 — 라이브러리 구버전 문제는 배제됨
- **다음 단계**: 이 버전을 배포한 뒤 마이페이지에서 문제를 재현하고, Codespaces 터미널에 찍히는 `[getAuthedUser]` 로그를 확인해야 정확한 원인이 나옴. 이 로그 없이는 더 이상 추측으로 진행하지 않기로 함

## v2.0 — 2026-08-14

**요약**: v1.9로도 안 풀렸던 "로그인해도 마이페이지에서 계속 로그인 필요하다고 뜨는" 문제의 진짜 원인 발견 및 수정. 실제 원인은 토큰 문제가 아니라, **회원가입 시 `auth.users`는 생성됐는데 `profiles` 행이 안 만들어진 "반쪽 계정"** 이었음 (Supabase Table Editor에서 실사용자 계정으로 직접 확인).

- **근본 원인**: 계정 생성이 "auth.users 생성"과 "profiles 생성"이라는 별개의 API 호출 두 단계로 나뉘어 있어서, 앞 단계는 성공하고 뒤 단계가 실패해도 감지가 안 되는 구조였음
- 신규: `supabase/migrations/0003_auto_create_profile.sql` — `auth.users` insert 시 DB 트리거로 `profiles`를 원자적으로 함께 생성. 두 단계를 사실상 하나로 묶어 "반쪽 계정" 자체를 구조적으로 불가능하게 만듦 (업계 표준 Supabase 패턴)
- 변경: `signup/route.ts`, `signup/child/verify/route.ts` — 별도 `profiles.insert()` 제거, `user_metadata`로 role/nickname을 넘기고 트리거에 위임 (아니면 방금 만든 트리거와 충돌해 중복키 에러가 남)
- 변경: `profiles.nickname`을 NULL 허용으로 완화 — 소셜 로그인처럼 메타데이터 없이 트리거가 프로필을 만들 때 nickname을 비워둔 채로 만들어야, 기존 "닉네임 없으면 최초 온보딩"이라는 판단 로직이 계속 정확히 작동함
- 변경: `me/route.ts` — 온보딩 필요 여부 판단 기준을 "프로필 행 존재"에서 "닉네임 존재"로 수정 (트리거가 행을 항상 만들기 때문에 기존 기준은 더 이상 유효하지 않았음)
- 검증: 로컬 Postgres로 (1) 메타데이터 없는 가입 → nickname NULL, 온보딩 필요=true, (2) 메타데이터 있는 가입 → nickname 채워짐, 온보딩 필요=false, 두 시나리오 모두 실제 실행 확인. 테스트 15개 전부 통과, 클린룸 재검증 통과
- **실사용자 계정 즉시 복구용 SQL 필요** — 이미 반쪽 상태로 만들어진 기존 계정은 트리거 적용만으론 자동 복구 안 됨(트리거는 이후 신규 가입에만 적용). 아래 응급 SQL로 직접 복구 필요.

## v1.9 — 2026-08-13

**요약**: v1.8의 토큰 자동갱신 로직에 있던 경쟁조건(race condition) 버그 수정. 실사용자 테스트 중 "로그인했더니 진도 화면이 잠깐 보이다가 다시 로그인하라고 뜨는" 증상으로 발견.

- **원인**: 마이페이지가 진도(`progress`)와 저장코드(`code`)를 동시에 요청하는데, 둘 다 401을 받으면 각자 독립적으로 토큰 갱신을 시도했음. Supabase의 리프레시 토큰은 1회용이라, 먼저 갱신에 성공한 요청이 새 토큰을 저장해도 뒤이어 도착한 요청이 이미 무효화된 옛 리프레시 토큰으로 재시도하다 실패하면서 **방금 저장된 새 토큰까지 지워버리는** 문제였음
- 수정: `lib/client-auth.ts`에 진행 중인 갱신 요청을 공유하는 락(단일 in-flight 프라미스) 추가 — 동시에 여러 요청이 401을 받아도 실제 갱신 네트워크 호출은 1번만 일어나고, 나머지는 그 결과를 같이 기다림
- 신규: `lib/client-auth.test.ts` — 이 경쟁조건에 대한 회귀 테스트. **수정 전 코드로 실제로 되돌려서 테스트가 실패하는 것(2번 호출됨)을 먼저 확인한 뒤, 수정본으로 되돌려 통과하는 것까지 검증** — 버그 재현과 수정 둘 다 실측
- 검증: 테스트 15개(신규 1개 포함) 전부 통과, 클린룸 재검증 통과

## v1.8 — 2026-08-13

**요약**: 실사용자 테스트 중 발견된 버그 수정 — 로그인했는데 1시간쯤 뒤 "로그인이 필요해요"가 다시 뜨는 문제. 원인은 로그인 시 액세스 토큰만 저장하고 리프레시 토큰을 저장·사용하지 않아서, 액세스 토큰(기본 1시간 만료) 만료 후 자동 갱신이 안 됐던 것.

- 신규: `app/api/identity/refresh/route.ts` — 리프레시 토큰으로 새 액세스 토큰을 발급받는 라우트(Supabase 상호작용은 항상 서버에서만, 기존 아키텍처와 일관)
- 신규: `lib/client-auth.ts` (`authedFetch`) — 인증 필요한 API 호출 공용 헬퍼. 401을 받으면 저장된 리프레시 토큰으로 자동 갱신 후 1회 재시도. 리프레시 토큰마저 만료됐으면 저장된 토큰을 지우고 확실히 로그인 화면으로 유도
- 변경: `app/login/page.tsx` — `refreshToken`도 함께 저장하도록 수정 (이전엔 accessToken만 저장하던 게 근본 원인)
- 변경: `AiTutorPanel.tsx`, `app/mypage/page.tsx` — 원시 `fetch`+수동 헤더 방식에서 `authedFetch`로 교체
- 검증: 리프레시 라우트의 입력 검증(400)·에러 처리 확인, 브라우저에서 토큰 없는 상태의 UI 정상 동작(회귀 없음) 확인, 클린룸 재검증(테스트14+빌드) 통과. **실제 만료 후 자동 갱신 자체는 라이브 Supabase 세션에서 실사용자 확인 필요** — 이 sandbox엔 라이브 자격증명이 없어 로직 검증까지만 가능했음

## v1.7 — 2026-08-13

**요약**: AI 튜터를 로그인 필수로 전환 (대표님과 비용/복잡도 논의 후 결정). rate-limit을 IP→user_id(DB) 기준으로 전환, 주제 범위 밖 질문 거절 규칙 추가.

- 신규: `supabase/migrations/0002_tutor_usage_increment.sql` — 원자적 증가 RPC 함수. **로컬 Postgres로 20개 동시요청 테스트 실행 → 정확히 10개만 허용되는 것 확인 (경쟁조건 없음)**
- 신규: `lib/rate-limit-db.ts` — 위 RPC를 호출하는 DB 기반 rate limiter, 확인 실패 시 fail-closed
- 변경: `app/api/tutor/route.ts` — 로그인 필수(`getAuthedUser`), DB 기반 rate limit로 교체, 시스템 프롬프트에 "예제 범위 밖 질문 거절" 규칙 추가, `withErrorHandling`으로 감쌈
- 변경: `AiTutorPanel.tsx` — Authorization 헤더 전송, 401 시 "로그인하러 가기" 안내 카드 표시
- 검증: 비로그인 상태로 튜터 호출 → 401 확인, 브라우저 스크린샷으로 로그인 유도 UI 실제 렌더링 확인, 클린룸 재검증(테스트14+빌드) 통과
- **결정 배경 요약**: IP 기준 제한은 VPN 등으로 쉽게 우회되어 비용 방어가 약함 / tutor_usage 테이블이 원래 user_id 기준으로 설계되어 있어 오히려 더 단순 / 랜딩페이지 데모는 정적 목업이라 마케팅 훅과 무관 / 무료 콘텐츠는 비로그인 열람 가능, 튜터 사용 시점에만 가입 유도

## v1.6 — 2026-08-13

**요약**: 실사용자 테스트 중 발견된 버그 수정 — 회원가입 시 "서버에 연결할 수 없어요"라는 오해를 주는 메시지가 뜨는 문제. 원인은 `getSupabaseServerClient()`가 환경변수 누락 시 던지는 예외를 감싸는 안전망이 없어서, Next.js가 HTML 에러 페이지를 반환하고 클라이언트의 `res.json()`이 파싱에 실패해 엉뚱한 메시지를 보여준 것.

- 신규: `lib/api-error-handler.ts` — `withErrorHandling` 래퍼. 예상 못 한 예외를 잡아서 항상 JSON으로, 실제 에러 메시지와 함께 응답
- 수정: identity 도메인 7개 라우트(signup, login, logout, me, password/reset, learning/progress, learning/code) 전부 이 래퍼로 감쌈
- 검증: 환경변수를 실제로 비워서 재현 → 이전엔 애매했을 상황에서 **"SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다"라는 정확한 원인이 실제로 화면에 뜨는 것 확인**. 클린룸 재검증(테스트14+빌드) 통과
- **주의(다음 버전에서 재검토 필요)**: 지금은 개발 편의를 위해 실제 에러 메시지를 그대로 노출함. 프로덕션 전환 시 사용자에게는 일반화된 메시지만 보여주고 상세 내용은 서버 로그로만 남기도록 바꿔야 함(NFR.md §3 보안 섹션과 연결)

## v1.5 — 2026-08-13

**요약**: Dev_Sequence.md 4단계(마이페이지 실데이터 연동) 착수 — 진도·저장코드 API + 실제 마이페이지 화면.

- 신규: `app/api/learning/progress/route.ts` — GET(조회)/POST(upsert), 인증 필수
- 신규: `app/api/learning/code/route.ts` — GET(조회)/POST(저장), 인증 필수, 코드 길이 상한(2만자) 방어
- 신규: `app/mypage/page.tsx` — 실제 진도·저장코드를 API에서 가져와 표시. 비로그인 접근 시 로그인 유도 화면
- 변경: `app/login/page.tsx` — 로그인 성공 시 `/examples` 대신 `/mypage`로 이동
- 검증: 인증 없이 각 API 호출 시 401 확인, 비로그인 상태로 `/mypage` 접속 시 로그인 유도 화면이 실제로 뜨는 것 스크린샷 확인, 클린룸 재검증(테스트14+콘텐츠검증+빌드) 통과
- **보류 항목(의도적)**: AI 튜터 rate-limit을 IP→user_id 기준으로 전환하는 작업은 이번에 안 함 — 이걸 하면 비로그인 사용자는 AI튜터를 아예 못 쓰게 되는데, 이게 의도한 정책인지(Free 이용에 로그인이 필수인지) 아직 미확정이라 임의로 결정하지 않음. 다음 논의 필요.

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
