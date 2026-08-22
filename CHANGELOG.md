# MakerStudio 코드베이스 변경 이력

이 파일은 `makerstudio-web-scaffold_vX.X.zip`의 버전과 함께 관리됩니다. 문서(design doc 등)와 마찬가지로, 코드를 전달할 때마다 버전을 올리고 여기에 한 줄씩 남깁니다.

**⚠️ 2026-08-22 정정**: v2.9(2026-08-14) 이후 8일간 갱신이 끊겨 있었음 — 그 사이 Family 요금제,
RLS, VIP 요금제, 데이터 보관 정책, 소셜 로그인 등 큰 기능들이 전부 기록 안 된 채로 쌓여 있던 걸
발견해서 실제 커밋 이력(`git log`)을 기준으로 v2.10~v2.32를 한 번에 채움. 각 항목의 더 상세한
설계 판단/검증 방법은 `docs/MakerStudio_Session_2026-08-2{0,1,2}_Summary_*.md`에 있음 — 여기선
간략하게만 기록.

## v2.34 — 2026-08-22

**요약**: admin 계정이 결제 관련 화면에서 막히던 버그 2건 수정 — 대표님이 admin 계정으로
실사용 테스트하다 발견(`Premium 구독하기` → `/mypage`로 조용히 튕김, `/mypage/billing`에서
로그인돼 있는데 "로그인이 필요해요" 화면이 뜸).

- 신규: `lib/supabase/auth-context.ts`의 `requireGuardianOrAdmin()` — 결제 "조회 전용" 라우트
  에서만 쓰는 가드(쓰기/액션 라우트에는 절대 쓰면 안 됨, 함수 주석에 경고 명시)
- 변경: `app/api/billing/history`, `app/api/billing/family/members`(GET만)가
  `requireGuardian()` 대신 `requireGuardianOrAdmin()`을 쓰도록 — 프론트엔드는 이미 admin을
  통과시키고 있었는데 서버만 guardian으로 막고 있던 불일치를 해소
- 변경: `app/examples/[id]/page.tsx` — `childId` 없을 때 무조건 `/mypage`로 보내던 걸 role별
  안내(비로그인/자녀 미연결 guardian/admin/학생)로 세분화
- 변경: `app/mypage/billing/page.tsx` — 결제내역 조회 실패(403 등)가 401(진짜 미로그인)과
  뭉뚱그려져 "로그인이 필요해요" 화면으로 잘못 넘어가던 걸 분리, 결제내역 섹션에 별도 에러
  메시지 추가
- 검증: 실DB+Playwright로 admin/guardian(자녀有)/guardian(자녀無)/student_teen 4개 역할
  조합 10개 체크 전부 통과

## v2.33 — 2026-08-22

**요약**: "점진적, 선택적 모듈화" 아키텍처 원칙 확정 — 전체를 한 번에 완벽한 플러그형
구조로 만들지 않고, 재사용 가치가 높고 위험이 낮은 부분부터 순서대로 인터페이스 뒤로 감춘다.

- 신규: `docs/Architecture_Principles_v1.0.md` — 우선순위 표(1순위 결제/SMS/이메일 프로바이더
  추상화 → 2순위 도메인별 Repository 계층 → 3순위 인증 어댑터는 실제 두 번째 프로젝트가
  생기기 전까지 보류, 한국 규제 로직은 항상 그대로 유지)
- 변경: `Project_Design_v2.6.md`(v2.5→v2.6, git mv) §5.6 신설 — §5.5(이벤트 버스 완전분리
  구조)가 장기 목표이고 지금은 이 우선순위를 따른다는 점을 §5.5 본문에도 명시
- 변경: `CLAUDE.md`에 새 `## 아키텍처 원칙` 섹션 + 세션 시작 시 `Architecture_Principles_v1.0.md`/
  `CHANGELOG.md` 최신 항목을 먼저 확인하라는 규칙 추가. 기존 "도메인 분리" 문구 옆에 "DB 접근은
  아직 각 라우트가 Supabase 클라이언트를 직접 쓰고 있고 Repository 전환은 시작 전"이라는 현재
  상태를 괄호로 명시(과장된 인상 방지)

## v2.32 — 2026-08-22

**요약**: API_Spec/DB_Schema/Dev_Sequence/NonFunctional_Requirements 4개 문서가 "작성일
2026-08-13" 버전 그대로 8일 넘게 방치돼 있던 것(내용은 계속 갱신됐는데 버전 번호만 안 올라감)과,
Auth_Flow/MVP_Scope/Project_Design 3개는 내부 버전과 파일명이 서로 어긋나 있던 것을 발견해 정리.

- 변경: 위 4개 문서를 실제 마이그레이션 36개·API 라우트 40개와 전부 대조해 누락·오류 정정(예:
  `/api/learning/tutor`가 실제로는 `/api/tutor`, `POST /api/billing/checkout`은 존재하지 않는
  엔드포인트였음, `content_generation_log`/`content_review_messages`/`learning_progress`/
  `quiz_attempts` 4개 테이블이 DB_Schema에 아예 없었음 등), 각 문서 버전을 v1.1로 올림
- 변경: `git mv`로 파일명을 내부 버전에 맞게 정정 — `Auth_Flow_v1.0.md`→`v1.2`,
  `MVP_Scope_v1.2.md`→`v1.13`, `Project_Design_v2.4.md`→`v2.5`. 참조하던 다른 문서·코드 주석
  (`lib/identity/childSignup.ts`, `lib/sms/solapi.ts` 등)도 전부 같이 갱신
- 변경: 이 CHANGELOG — v2.9 이후 8일치 누락분(v2.10~v2.31) 보충

## v2.31 — 2026-08-22

**요약**: 소셜 로그인(구글) 최초 연동 + 조사 중 발견한 이메일 가입 버그 수정 (커밋 `75fb546`).

- 신규: `lib/supabase/browser.ts` — 브라우저 전용 anon-key Supabase 클라이언트(서버의
  service_role 싱글턴과 별개)
- 신규: `app/SocialLoginButtons.tsx`, `app/auth/callback/page.tsx` — `signInWithOAuth` 리다이렉트
  방식(카카오도 같은 구조로 확장 가능하게 설계, 토큰 방식은 카카오 미지원이라 채택 안 함).
  콜백 페이지가 Supabase 세션을 기존 `ms_access_token`/`ms_refresh_token` 체계로 브리징해서
  `authedFetch` 등 기존 인증 인프라를 그대로 재사용
- 수정: `app/signup/page.tsx`의 `TeenSignupForm`이 아동 SMS 인증 전용 엔드포인트를 잘못 호출해
  이메일 가입이 항상 실패하던 버그(원래 `/api/identity/signup`을 써야 했음)
- 검증: 실 Supabase 세션으로 신규/기존 사용자 온보딩 분기, 세션 브리징, 이메일 가입 전 구간을
  Playwright로 실증

## v2.30 — 2026-08-22

**요약**: 해지 후 30일 데이터 보관 정책 — 준비 단계만(`0036`, 커밋 `e69aca8`). 실제 자동 파기(cron)는
범위 밖, 법적 고지 문구는 전부 초안(법률 검토 필요).

- 신규: `subscriptions`/`family_groups.data_retention_until`(해지 시 `current_period_end`+30일로
  계산 — `canceled_at` 아님, §4.3 원칙과 일관), `lib/billing/dataRetention.ts`
- 신규: `scripts/purge-expired-data.ts` — 관리자 수동 실행 전용, 기본 dry-run,
  `hasPremiumAccess()`로 다른 경로 접근권 재확인하는 안전장치
- 신규: `docs/MakerStudio_Privacy_Policy_DRAFT_addendum_v0.1.md` — 이 조항 하나만 다루는 초안
- 검증: 해지→보관기한 계산, 재구독→초기화, 파기 스크립트 3가지 케이스 전부 실DB로 실증

## v2.29 — 2026-08-22

**요약**: Premium VIP 요금제(월 ₩100,000) 신설 — "AI 초안 + admin 승인 후 발송" 비동기 멘토링
(`0035`, 커밋 `d20ec37`). AI가 단독으로 응답을 보내는 건 절대 금지.

- 신규: `subscriptions.plan`에 `premium_vip` 추가, `vip_mentor_requests` 테이블
- 신규: `app/api/learning/vip/{submit,my-requests,admin/*}`, `app/admin/vip-review`,
  `app/mypage/vip`, `/mypage/billing`의 자녀별 VIP 카드
- 변경: `lib/content/gate.ts`의 `hasPremiumAccess()`가 `premium_vip`도 인정하도록 확장(VIP는
  일반 Premium의 상위 호환)
- 검증: 제출→PII차단→월4회한도→AI초안→관리자승인+발송→학생/보호자 열람까지 22개 체크 실증

## v2.28 — 2026-08-22

**요약**: 가격 정책 페이지(`/pricing`) 신설(`0034`, 커밋 `6c8864d`) — 다크패턴 금지 원칙 적용.

- 신규: `app/pricing/page.tsx` — Premium 메인/Family 보조 노출, 가짜 정가·사전체크 없음
- 신규: `waitlist_emails` 테이블 + `POST /api/notifications/waitlist` — 출시 알림 신청,
  `marketing_consent` 기본 미체크(정보통신망법 제50조)

## v2.27 — 2026-08-21

**요약**: `content_modules.is_premium` 추가 + 관리자 검수 화면에서 유료 여부 설정(`0030`,
커밋 `5807660`) — RGB LED 색상 제어 강의를 실제로 유료 판매하기 위함.

- 변경: `lib/content/publishedModules.ts`의 하드코딩된 `isPremium: false`를 `row.is_premium`으로
- 신규: `app/admin/content-review/[id]/page.tsx`에 "유료 콘텐츠로 설정" 체크박스(승인 시점에만 반영)
- **컬럼 추가와 RLS 정책 수정(`is_premium=false`만 anon에 노출)을 한 마이그레이션에 같이 묶음** —
  컬럼만 먼저 추가하면 그 사이 우회 노출 창이 열리기 때문

## v2.26 — 2026-08-21

**요약**: 회사 귀책(중복결제·시스템오류) 전액환불 자동 판별(`0031`, 커밋 `f2c70f4`).

- 신규: `payments.refund_reason`(`duplicate_payment`\|`system_error`\|null)
- 변경: `refund/calculate`가 이 값이 세팅된 결제 건은 기간·사용여부 무관 전액환불하도록 확장
  (개인/Family 공통). 세팅 자체는 여전히 CS/관리자가 SQL Editor로 수동

## v2.25 — 2026-08-21

**요약**: §6.3-a 콘텐츠 버전 고정 정책 — "개선판 만들기" 기능(`0032`, 커밋 `5390c3d`).

- 신규: `content_modules.slug`(버전과 무관한 안정 식별자), `UNIQUE(slug, version)`
- 신규: `POST /api/content/:id/revise` — 게시된 콘텐츠를 복제해 다음 버전을 검수 대기로 생성
- 신규: `getPublishedModuleForUser()` — 이미 학습 중인 사용자는 진도 시작 시점 버전으로 고정,
  신규 학습자는 최신 버전

## v2.24 — 2026-08-21

**요약**: 관리자 대시보드(매출·요금제별 고객수/이탈률) 신설(`0033`, 커밋 `3ed549e`).

- 신규: `admin_monthly_revenue`/`admin_plan_customers`/`admin_plan_churn` 뷰 3개(service_role
  전용 — `authenticated` GRANT 주면 RLS 우회되는 위험이 있어 의도적으로 GRANT 없음)
- 신규: `GET /api/billing/dashboard`, `app/admin/dashboard`
- 검증: 임시 계정+구독 조합으로 수기 계산한 기대값과 실제 뷰 응답 일치 확인

## v2.23 — 2026-08-21

**요약**: `payments`/`subscriptions`/`notifications` RLS 실제 구현(`0022`~`0029`, 커밋
`8c9d32f`~`3cbd5cd`, 5개 커밋 묶음) — `Auth_Flow.md` §3이 약속하던 "API 미들웨어 + RLS
이중 방어"가 실제론 RLS 없이 API 레이어만 있었던 걸 채움.

- 신규: guardian은 본인 것만 select, admin은 전체 select, student_child/teen은 항상 0건 +
  insert 하드 차단
- **발견한 구조적 문제**: 이 프로젝트는 `anon`/`authenticated`에 대한 기본 GRANT 자체가 없어서
  RLS 정책만 만들면 owner조차 42501로 막힘 — `family_groups`/`family_group_members`/
  `learning_progress`/`quiz_attempts`/`tutor_messages`/`content_review_messages`/
  `content_modules`까지 같은 문제로 순차 발견·보완
- 발견: `profiles`/`progress`/`saved_codes`에 이 저장소 마이그레이션 어디에도 없던 RLS 정책이
  이미 실DB에 있었던 것(Supabase 대시보드 마법사로 생성된 것으로 추정)을 발견해 이력에 백필,
  `guardian_child_links`는 RLS는 켜져 있는데 정책이 하나도 없어 한 번도 정상 동작한 적 없었던
  것도 발견해 수정
- 신규: `public.debug_list_policies()` RPC — PostgREST가 `pg_policies`를 REST로 노출하지 않아
  RLS 정책 존재 여부를 직접 조회할 방법이 없던 것을 보완(service_role 전용, 영구 보관용 진단 도구)

## v2.22 — 2026-08-20

**요약**: Family 좌석 추가(4번째부터, ₩4,900/좌석)와 Family 해지 API 추가, `gate.ts` 접근 판단
버그 수정(`0021`, 커밋 `62c1199`).

- 신규: `POST /api/billing/family/cancel`, `lib/billing/activateFamilySeatAddon.ts`
- **버그 수정**: `hasPremiumAccess()`/`hasFamilyPlanAccess()`가 `status==='active'`까지 요구해서
  해지 즉시(잔여기간 무시) 접근이 끊기던 문제 — §4.3 "해지해도 잔여기간까지 이용 가능" 원칙 위반이었음

## v2.21 — 2026-08-20

**요약**: Family 좌석초과 동시성 방어(`0020`, 커밋 `7093977`).

- 신규: `add_family_member(p_family_group_id, p_child_id)` RPC — `family_groups` row를
  `for update`로 잠가 동시 추가 요청을 직렬화, 정원 판단을 원자적으로 재확인

## v2.20 — 2026-08-20

**요약**: 죽은 컬럼 `profiles.guardian_id` 제거(`0019`, 커밋 `cab326f`) — `guardian_child_links`
테이블로 완전히 대체된 뒤 안 쓰이던 컬럼 정리.

## v2.19 — 2026-08-20

**요약**: notifications 도메인에 SMS 채널 추가(`0018`, 커밋 `e517ae8`).

- 신규: `profiles.phone`(guardian이 `/mypage/settings`에서 직접 입력)
- 변경: `payment_failed`/`child_chat_flagged` 2종만 email+SMS, 나머지는 email만(Solapi는
  프로덕션 키 미설정, dev bypass로 로직만 완성)

## v2.18 — 2026-08-20

**요약**: AI 튜터 아동 안전장치 추가(`0017`, 커밋 `d97a641`) — 실사용자 없어 후순위였지만 서비스
오픈 전 최소 안전장치는 필요하다는 판단.

- 신규: `student_child`의 욕설/개인정보(휴대폰번호·주민등록번호) 입력을 Anthropic 호출 전에 차단
  (`lib/learning/tutorSafety.ts`), 차단 시 하루 10회 quota 안 깎임, 응답에도 PII 재스캔
- 변경: `tutor_messages`에 `flagged`/`flag_reason` 컬럼, 차단 시 원문 대신 치환된 텍스트 저장
- 신규: 연결된 보호자에게 `notifyGuardian()`으로 즉시 알림

## v2.17 — 2026-08-20

**요약**: notifications 도메인 실제 연결(`0016`, 커밋 `d0980ba`) — 테이블은 `0001_init.sql`부터
있었지만 실제로 insert하는 코드가 없어 계속 비어있었음.

- 신규: `lib/notifications/notify.ts`의 `notifyGuardian()` — billing/family 도메인 이벤트(결제
  성공/실패, 구독·Family 해지, Family 멤버 추가/제거)를 email(Resend)로 발송
- 신규: `GET /api/notifications`, `PATCH /api/notifications/:id/read`

## v2.16 — 2026-08-20

**요약**: Family 결제내역을 `payments`에 통합(`0015`, 커밋 `01af218`).

- 변경: `payments.family_group_id`(nullable) 추가, `subscription_id`와 배타적 제약(정확히 하나만)
- 변경: `/api/billing/history` → `/mypage/billing`이 Family 결제도 함께 조회하도록 확장

## v2.15 — 2026-08-20

**요약**: Family 요금제(₩19,900/월, 최대 3명) 구독 그룹 구조 신설(`0014`, 커밋 `d7e783e`) —
Won't→Should로 승격된 첫 구현.

- 신규: `family_groups`/`family_group_members` 테이블(보호자당 1개, `owner_id` unique라 결제
  검증·웹훅 중복 처리에도 자연히 멱등적)
- **`guardian_child_links`와는 별개 개념**임을 명시 — 아이를 family_group에 추가하려면 서버가
  먼저 `guardian_child_links`로 법적 관계를 확인해야 함(`checkCanAddFamilyMember`)

## v2.14 — 2026-08-20

**요약**: 관리자 콘텐츠 검수 화면(목록/상세/AI 채팅/승인·반려) 신설(`0013`, 커밋 `2dca5d3`).

- 신규: `app/admin/content-review`, `content_review_messages` 테이블(검수 중 AI와 나눈 대화,
  admin만 select)
- 신규: `GET /api/content/pending`, `GET/POST /api/content/:id`, `POST /api/content/:id/review`,
  `GET/POST /api/content/:id/review-chat`

## v2.13 — 2026-08-19

**요약**: AI 튜터 대화 기록 저장(`0012`, 커밋 `33b088f`) — `/mypage/history` 화면의 기반.

- 신규: `tutor_messages` 테이블(본인만 select), `app/api/tutor/route.ts`가 매 대화를 기록하도록 변경

## v2.12 — 2026-08-19

**요약**: 로그인 사용자 닉네임 표시 + AI 콘텐츠 자동 생성 파이프라인(§6.3) 최초 구현(`0010`~`0011`,
커밋 `7210c39`).

- 신규: `content_modules`/`content_generation_log` 테이블, `POST /api/content/generate` —
  AI 초안→스키마 검증→실제 avr-gcc 컴파일 검증까지 자동 재시도(최대 3회)
- 변경: `app/NavAuthButtons.tsx` — 로그인 상태면 닉네임 표시

## v2.11 — 2026-08-19

**요약**: `learning` 도메인 퀴즈 제출 API 추가(`0008`~`0009`, 커밋 `0180129`).

- 신규: `learning_progress`/`quiz_attempts` 테이블, `submit_quiz_attempt` RPC(퀴즈 시도 기록+진도
  갱신을 한 트랜잭션으로 원자 처리) — 정적 `examples` 콘텐츠 전용이던 기존 `progress` 테이블과는
  별개로, `content_modules`(AI 생성 콘텐츠) 전용 진도 시스템
- 신규: `POST /api/learning/quiz`

## v2.10 — 2026-08-18

**요약**: 로그인 무한루프, `guardian_child_links` 연결, `childId` 매핑 버그 수정(`0007`,
커밋 `2b16a05`).

- 신규: `profiles.guardian_id`(나중에 `0019`에서 죽은 컬럼으로 판명돼 제거됨 — 당시엔 필요하다고
  판단했던 임시 컬럼)
- 수정: 초등학생 SMS 인증 완료 시 로그인된 guardian과 실제로 `guardian_child_links`가 연결되도록,
  `identity/me` 응답의 `childId` 매핑 버그 수정

## v2.9 — 2026-08-14

**요약**: 실제 포트원 테스트 결제 중 발견된 두 번째 필수 필드 누락 — "이니시스 V2 일반 결제의 경우 구매자 휴대폰 번호는 필수 입력입니다."

- 변경: `app/checkout/page.tsx` — 결제자 휴대폰 번호 입력란 추가, `PortOne.requestPayment()`의 `customer.phoneNumber`로 전달
- 검증: 빌드·테스트22개·클린룸 재검증 통과
- **참고**: 지금은 결제 화면에서 매번 직접 입력받는 방식(§3.2 아동 개인정보 최소화 원칙상 보호자 휴대폰번호를 profiles에 상시 저장하지 않음). 나중에 보호자 프로필에 연락처를 정식으로 저장하는 흐름이 생기면 자동 채움으로 개선 가능

## v2.8 — 2026-08-14

**요약**: 실제 포트원(KG이니시스 V2 테스트 채널) 연동 중 발견된 버그 수정. "이니시스 V2 일반 결제의 경우 구매자 이메일은 필수 입력입니다"라는 실제 에러로 발견 — `PortOne.requestPayment()` 호출 시 `customer.email`을 안 보내고 있었음.

- 변경: `lib/supabase/auth-context.ts`의 `AuthedUser`에 `email` 필드 추가
- 변경: `app/api/identity/me/route.ts` — 응답에 `email` 포함
- 변경: `app/checkout/page.tsx` — 결제 요청 전 `/api/identity/me`로 로그인한 사용자(보호자)의 이메일을 가져와 `customer.email`로 전달
- 검증: 빌드 통과, 테스트22개 전부 통과, 클린룸 재검증 통과. **실제 KG이니시스 테스트 채널로 결제창까지 뜨는지는 대표님이 이어서 확인 필요**

## v2.7 — 2026-08-14

**요약**: Dev_Sequence.md 5단계(결제) 구현 — 포트원(PortOne) V2 연동. 처음 가정했던 "서버가 결제 세션을 만드는" 구조가 아니라 실제로는 "브라우저에서 결제창을 직접 열고 서버는 검증만 하는" 구조라는 걸 재조사로 확인하고 정확하게 구현.

- 신규: `lib/billing/refund.ts` — 일할계산 환불 로직(§4.5), 데모에서 검증했던 정확한 사례(₩9,900×29/31=₩9,261) 포함 단위테스트 7개
- 신규: `lib/billing/portone.ts` — 포트원 결제 검증. **클라이언트가 보낸 금액을 절대 신뢰하지 않고 포트원 서버에서 재조회**
- 신규: `lib/billing/activateSubscription.ts` — 구독 활성화 공용 로직, **멱등성 보장**(같은 결제가 checkout/verify와 webhook 양쪽에서 와도 한 번만 처리)
- 신규: `app/api/billing/*` 6개 라우트 — plans, checkout/verify, subscription/cancel, refund/calculate, history, webhook/portone
- 신규: `app/checkout/page.tsx` — 실제 `@portone/browser-sdk`로 결제창을 여는 클라이언트 페이지
- 신규: `supabase/migrations/0005_subscriptions_unique.sql` — `subscriptions`에 (guardian_id, child_id) 유니크 제약. **로컬 Postgres로 재구독 시나리오(같은 조합으로 두 번 upsert) 실제 테스트 — 새 행이 아니라 기존 행이 갱신되는 것 확인**
- 검증: 환불계산 테스트 7개 전부 통과(총 22개), 마이그레이션 0001~0005 순서대로 재적용 확인, 웹훅 서명 검증 — **가짜 서명은 401로 거부, 시크릿 자체가 없으면 500으로 명확히 구분**되는 것 실제 서버로 확인. 클린룸 재검증(테스트22+빌드) 통과
- **라이브 테스트 필요**: 포트원 실계정으로 실제 결제창이 뜨고, checkout/verify와 webhook이 실제 결제 데이터로 정확히 맞물리는지는 대표님의 포트원 콘솔 "테스트 결제" 기능으로 확인 필요

## v2.6 — 2026-08-14

**요약**: v2.5에서 이메일 인증을 필수로 만든 뒤, 인증 메일 발송이 한 번 실패하면(스팸함, 설정 문제, 오타 등) 그 이메일로 재가입도 안 되고 인증 메일 재발송도 안 되는 "막다른 골목"이 생기는 걸 실사용자 테스트 중 발견 — 수정.

- 변경: `signup/route.ts` — "이미 가입된 이메일" 에러 발생 시, 해당 계정이 **미확정 상태로 낀 계정**이면 재가입을 막는 대신 인증 메일을 다시 보냄. 이미 정상 확정된 계정이면 "로그인해주세요"로 명확히 안내
- 리팩터링: 인증 링크 생성+발송 로직을 `sendSignupVerification()` 함수로 분리해 신규가입/재발송 두 경로에서 재사용
- 검증: 테스트15개+빌드 클린룸 재검증 통과. **실제 낀 계정 시나리오는 대표님 실사용자 테스트로 발견된 케이스라, 라이브 환경에서 같은 이메일로 재가입 시도 시 재발송으로 이어지는지 재확인 필요**

## v2.5 — 2026-08-14

**요약**: "한 사람이 여러 계정을 만들 수 있다"는 지적에서 시작해 네이버/카카오(CI 기반 완전 중복차단)와 구글(사후 감지 방식) 방식을 벤치마킹. CI 방식은 사업자 심사·비용·아동 대상 서비스에 과한 개인정보 수집 부담이 있어 채택하지 않고, 그보다 먼저 빠져있던 기본기(이메일 실소유 확인)부터 보완하기로 결정.

- **발견한 더 근본적인 문제**: 지금까지 회원가입이 `email_confirm: true`로 이메일 소유 확인을 아예 건너뛰고 있었음 — 존재하지 않는 이메일로도 즉시 가입이 됐음
- 신규: `lib/email/resend.ts` — Resend 연동 실제 이메일 발송. 설정 안 되어 있으면 명확히 실패(SMS 연동과 동일 원칙)
- 변경: `signup/route.ts` — `email_confirm: false`로 전환, `admin.generateLink`로 실제 확인 링크 생성 후 이메일 발송. 발송 실패 시 "메일 보냈다"고 거짓 응답하지 않고 502로 정직하게 실패
- 변경: `login/route.ts` — 이메일 미확인 상태를 구분해서 안내("인증 메일의 링크를 눌러주세요")
- 변경: `app/signup/page.tsx` — 가입 완료 메시지를 상황에 맞게 분리(이메일 인증 필요 vs 초등학생은 불필요)
- 변경: `app/login/page.tsx` — 이메일 인증 링크를 클릭하고 돌아왔을 때(`?verified=1`) 성공 배너 표시
- 검증: 브라우저로 가입 완료 메시지·로그인 인증완료 배너 렌더링 확인, 설정 없을 때 정직하게 실패하는 것 확인, 테스트15개+빌드 클린룸 재검증 통과
- **채택 안 한 것(의도적)**: CI 기반 중복가입 완전 차단 — 사업자 심사 필요, 실명연계 데이터 보관 부담, 아동 대상 서비스의 개인정보 최소화 원칙(§3.2)과 배치. 실제 어뷰징 사례가 나타나면 재검토

## v2.4 — 2026-08-14

**요약**: 회원가입 완료 후에도 "누구신가요?"(중고등·성인/초등학생 선택 탭)가 계속 화면에 남아있어 혼란을 주던 문제 수정. 실사용자가 두 번째 계정으로 테스트하다 발견.

- 변경: `app/signup/page.tsx` — 가입 완료 상태(`done`)를 하위 폼 컴포넌트가 아니라 페이지 최상단에서 관리하도록 구조 변경. 가입이 끝나면 역할 선택 탭 전체를 감추고 완료 메시지만 깔끔하게 보여줌
- 검증: API 응답을 성공으로 흉내낸 브라우저 테스트로 완료 화면이 탭 없이 깨끗하게 나오는 것 확인, 클린룸 재검증(테스트15+빌드) 통과

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
