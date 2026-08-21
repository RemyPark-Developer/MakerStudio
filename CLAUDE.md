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
- **도메인 분리**: 새 API 라우트는 `app/api/{domain}/...` 형태로, `identity`/`billing`/`content`/`learning`/`notifications`/`commerce`/`moderation` 중 하나에 속하게 만든다. 도메인끼리는 직접 DB를 건드리지 않고 함수 호출/이벤트로 통신한다(`Design.md` §5.5) — 이 저장소엔 실제 이벤트 버스가 없어서 "이벤트"는 지금까지 전부 순수 함수 호출로 구현됨(`notifyGuardian()` 등). **`moderation` 도메인(관리자 콘텐츠 검수)과 "AI 튜터 아동 안전장치"(`lib/learning/tutorSafety.ts`)는 이름이 비슷해 보여도 완전히 다른 기능이니 헷갈리지 말 것** — 후자는 `learning` 도메인 하위.
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
- `supabase/migrations/0001_init.sql`, `0002_tutor_usage_increment.sql`, `0003_auto_create_profile.sql`, `0004_grant_service_role.sql`, `0005_subscriptions_unique.sql` — DB 스키마 전체 + AI튜터 사용량 원자적 증가 함수 + 회원가입 시 profiles 자동생성 트리거 + service_role 권한 부여 + subscriptions 유니크 제약. 전부 로컬 Postgres로 실제 실행·검증 완료. **Supabase에 처음 적용할 때 0001→0002→0003→0004→0005 순서대로 SQL Editor에서 실행할 것.**
- `lib/billing/*`, `app/api/billing/*`, `app/checkout/page.tsx` — 포트원(PortOne) V2 결제 연동. **서버가 결제를 만드는 게 아니라 브라우저가 결제창을 열고 서버는 검증만 하는 구조**(다른 PG 연동과 헷갈리지 말 것). `activateSubscription()`이 checkout/verify와 webhook 양쪽에서 호출되므로 반드시 멱등성(중복 처리 방지)을 유지할 것. **checkout의 `customData`엔 반드시 `guardianId`를 담을 것** — 이게 빠지면 웹훅(`webhook/portone/route.ts`)이 조용히 스킵된다(2026-08-14~08-20 사이 실제로 이 상태였던 버그, 08-20에 수정).
- **Family 요금제(2026-08-20 도입, 전체 라이프사이클 완성)** — `family_groups`/`family_group_members`(`0014`), `lib/billing/activateFamilyGroup.ts`(재결제 시 좌석 자동 리셋+정원초과 자동정리 포함), `lib/billing/activateFamilySeatAddon.ts`(좌석 추가), `app/api/billing/family/{members,cancel}/*`, `lib/billing/familyMembership.ts`(`checkCanAddFamilyMember`)+`familySeatReconciliation.ts`(`selectMembersToRemove`), `/mypage/billing`의 Family 카드. **`guardian_child_links`는 이 기능이 절대 건드리지 않음** — `family_group_members`에 아이 추가 전 반드시 `guardian_child_links`로 법적 관계를 서버에서 재확인(`checkCanAddFamilyMember`). 결제내역(`payments.family_group_id`, 0015)·환불(`refund/calculate`의 `family:true` 분기, 5개 이용내역 테이블 합산 판단)·정원초과 동시성 방어(`add_family_member` RPC, 0020)·좌석 추가(₩4,900/좌석, 최대 6석, **그 결제 주기만 유효** — 이 프로젝트는 정기결제가 아니라 매번 브라우저가 여는 일회성 결제 구조라 자동 재청구 불가)·해지 API 전부 구현·검증 완료. 상세 설계 판단은 `docs/MakerStudio_Session_2026-08-20_Summary_v1.1.md` §3·7·8·9·10 참고.
- **notifications 도메인(2026-08-20 실제 채워짐)** — `lib/notifications/notify.ts`의 `notifyGuardian()`이 billing/family/learning 도메인 이벤트(결제 성공/실패, 구독·Family 해지, Family 멤버/좌석 변경, `child_chat_flagged` 등)를 email(Resend)로, 그중 `payment_failed`/`child_chat_flagged` 2종만 SMS(Solapi, **dev bypass 상태 — 프로덕션 키 미설정**)로도 보냄. `notifications` 테이블은 `0001_init.sql`부터 있었지만 이 도메인이 생기기 전까진 계속 비어있던(insert하는 코드가 없던) 테이블이었음. SMS 받으려면 guardian이 `/mypage/settings`에서 전화번호를 직접 입력해야 함(`profiles.phone`, 0018 추가 — 이전엔 이 컬럼 자체가 없었음). 인앱 알림함은 `/mypage/notifications`.
- **AI 튜터 아동 안전장치(2026-08-20, `lib/learning/tutorSafety.ts`)** — `student_child`가 AI 튜터에 욕설/개인정보(휴대폰번호·주민등록번호)를 입력하면 Anthropic 호출 전에 차단(`app/api/tutor/route.ts`), 차단된 시도는 하루 10회 quota를 안 깎음, 응답에도 PII 재스캔. `guardian_child_links`로 연결된 보호자에게 `notifyGuardian()`으로 알림. `moderation` 도메인과는 무관(위 도메인 분리 항목 참고).
- **`lib/content/gate.ts` 접근 판단 버그 수정(2026-08-20)** — `hasPremiumAccess()`/`hasFamilyPlanAccess()`가 원래 `status === 'active'`까지 요구해서, 구독/Family를 해지한 순간(잔여기간이 남았어도) 즉시 접근이 끊기고 있었음(§4.3 "해지해도 결제기간 끝까지는 이용 가능" 원칙 위반, 개인/Family 둘 다 해당). 지금은 `current_period_end`만으로 판단 — **새 접근 제어 로직을 짤 때 이 원칙(해지 ≠ 즉시 차단, 기간 만료만 차단)을 그대로 따를 것.**
- **`payments`/`subscriptions`/`notifications` RLS 구현(2026-08-21)** — `Auth_Flow.md` §3이 약속하는 "API 미들웨어 + RLS 이중 방어"가 실제로는 RLS 없이 API 레이어만 있었던 걸 채움(`supabase/migrations/0022_rls_billing_notifications.sql`, `0023_grant_family_groups_for_payments_rls.sql`). guardian은 본인 것만 select, admin은 전체 select, student_child/teen은 항상 0건(정책 미매치) + insert 하드 차단. 실제 JWT로 실증 테스트 완료. `family_groups`/`family_group_members`는 0014에 이미 RLS 정책이 있어 새 정책 추가는 이번 범위에서 제외했지만, 조사 중 이 두 테이블도 `authenticated` GRANT가 없어 실제로는 owner조차 막히고 있었던 걸 발견해서 GRANT만 보완함(`0023`이 `family_groups`, `0024_grant_family_group_members_select.sql`이 `family_group_members`) — 둘 다 실제 JWT로 재검증 완료. **이 프로젝트는 `anon`/`authenticated`에 대한 기본 GRANT 자체가 없어서(바로 아래 항목과 같은 원인), RLS 정책만 만들면 guardian 본인조차 42501로 막힌다 — 새 테이블에 RLS를 붙일 때 정책과 `grant select(...) on ... to authenticated`를 항상 세트로 만들 것.** 같은 문제가 있던 `learning_progress`/`quiz_attempts`/`tutor_messages`/`content_review_messages`도 `0025_grant_remaining_rls_tables.sql`로 같은 날 마저 보완 — 이 프로젝트에 RLS 걸린 테이블 중 GRANT 안 맞는 곳은 이제 없음. **`pg_policies`는 PostgREST가 REST로 노출하지 않아 직접 조회가 안 됐는데, `0026_debug_list_policies.sql`로 `public.debug_list_policies()`(service_role 전용 RPC)를 만들어 영구 보관함 — RLS 정책이 실제로 있는지 의심되면 이 함수를 RPC로 호출할 것.** 이걸로 조회하다가 `profiles`/`progress`/`saved_codes`에 **이 저장소 마이그레이션 파일 어디에도 없던 RLS 정책이 이미 실DB에 있었던 것**(Supabase 대시보드 "Enable RLS" 마법사로 만들어진 것으로 추정)을 발견해 `0027`로 이력에 백필했고, `profiles`의 "연결된 자녀 프로필 조회" 정책이 참조하는 `guardian_child_links`에 RLS는 켜져 있는데 정책이 하나도 없어서 **그 정책이 한 번도 정상 동작한 적이 없었던 것**도 발견해 `0028`로 고침(실제 guardian_child_links row로 실증 검증 완료). **정책이 다른 테이블을 서브쿼리로 참조하면 그 테이블의 RLS/GRANT도 항상 같이 확인할 것** — 이 세션에 이 패턴으로 두 번(payments↔family_groups, profiles↔guardian_child_links) 발이 걸렸다. `content_modules`도 같은 GRANT 누락으로 막혀 있어 `0029`로 anon+authenticated GRANT 보완(정책 주석의 원래 설계 의도대로) — `content_generation_log`는 원래부터 관리자 전용이라 정책·GRANT 자체가 없는 게 맞는 상태라 그대로 둠. (`content_modules.is_premium`은 같은 날 나중에 실제로 추가됐음 — 바로 아래 항목 참고, 이때 이 경고대로 RLS 정책도 같이 고쳤음.) 마지막으로 실DB 19개 테이블 전체를 전수 확인함(`examples`/`password_reset_tokens`/`tutor_usage`/`wishlist_items` 포함) — 이 4개는 정책·GRANT가 원래 없고 그게 맞는 상태(service_role 전용 설계, client 접근 의도 자체가 없음). **이 프로젝트의 실DB 테이블 중 더 확인이 필요한 곳은 없음(2026-08-21 기준).** `examples`는 `is_premium`을 이미 갖고 있는데 GRANT가 없어 완전히 막혀 있는 것도 확인 — 지금은 premium 우회 경로 없음.
- **`content_modules.is_premium` 추가 + 관리자 유료 설정(2026-08-21)** — RGB LED 색상 제어 강의를 실제로 유료 판매해야 해서, 2026-08-20에 보류했던 항목을 완료함(`supabase/migrations/0030_content_modules_is_premium.sql`). `lib/content/publishedModules.ts`의 하드코딩된 `isPremium: false`를 `row.is_premium`으로 교체, `app/admin/content-review/[id]/page.tsx`에 "유료 콘텐츠로 설정" 체크박스 추가(승인 시점에만 반영). **컬럼 추가와 `content_modules_public_read_published` RLS 정책 수정(`status='published' and is_premium=false`만 anon에게 노출)을 한 마이그레이션에 같이 묶었음** — 컬럼만 먼저 추가하면 그 사이 우회 노출 창이 열리기 때문(위 RLS 항목의 경고 그대로 따름). `lib/content/gate.ts`는 수정 불필요(재확인 완료). 실제 admin 승인 API로 RGB LED를 진짜 유료 전환하고 무료/비로그인/유료 토큰 + anon 직접 REST까지 실증 검증 완료. **DB 생성 콘텐츠를 유료로 만들 땐 이제 마이그레이션 없이 관리자 화면 체크박스만으로 충분.**
- **⚠️ 절대 규칙 (2026-08-14 추가)**: Supabase 프로젝트를 새로 만들 때 "Automatically expose new tables"를 끄면, service_role조차 새 테이블에 접근 못 하게 된다(`42501 permission denied`). 이 프로젝트는 0004 마이그레이션으로 이미 복구·재발방지 처리를 했지만, **새 Supabase 프로젝트를 만드는 상황이 또 생기면 이 마이그레이션도 반드시 같이 적용할 것.**
- **⚠️ 절대 규칙 추가 (2026-08-14)**: `auth.users`를 생성하는 코드(회원가입 등)에서 **절대로 `profiles`를 별도 `.insert()`로 만들지 말 것.** `0003_auto_create_profile.sql`의 트리거가 `user_metadata`(role, nickname)를 읽어서 자동으로 만든다. 별도 insert를 추가하면 트리거와 충돌해 중복키 에러가 난다. 새 가입 경로를 만들 때는 `createUser({ user_metadata: { role, nickname } })` 패턴만 쓸 것.
- **⚠️ 절대 규칙 추가 (2026-08-21) — `getSupabaseServerClient()`(service_role 싱글턴)에서 세션을 바꾸는 인증 메서드를 절대 호출하지 말 것**: `signInWithPassword`/`refreshSession`/`updateUser`/`verifyOtp`/`signUp` 같은 메서드는 `persistSession: false`여도 클라이언트 인스턴스의 메모리상 현재 세션을 바꿔버린다. 이 싱글턴에서 한 번이라도 호출하면, 그 순간부터 서버 프로세스가 살아있는 동안 **이 싱글턴 전체가 service_role이 아니라 그 사용자 권한으로 영구 고정**돼 그 이후 모든 사용자·모든 요청에 영향을 준다(실제로 로그인 한 번 이후 RLS 걸린 콘텐츠가 전부 안 보이는 버그로 드러남, `password/reset`은 다른 사용자 비밀번호가 바뀔 수 있는 취약점이었음 — 둘 다 2026-08-21 수정). **이런 호출이 필요하면 반드시 `lib/supabase/server.ts`의 `createSupabaseAuthClient()`(매 요청 새로 생성, anon key)를 쓸 것.** `.auth.admin.*`과 `.auth.getUser(명시적 토큰)`은 상태를 안 바꾸는 stateless 호출이라 기존 싱글턴 그대로 써도 안전함 — 헷갈리지 말 것. 상세: 메모리 `project_supabase_singleton_session_pollution_bug`.
- `app/page.tsx`(랜딩), `app/login`, `app/signup`, `app/forgot-password` — 프로토타입에서 이식한 실제 화면, 위 API에 실제 연결됨. 콘텐츠 목록은 `app/examples`로 이동함.
- `lib/sms/solapi.ts` — 실제 SMS 발송(Solapi). **설정 안 되어 있으면 명확히 실패함(성공한 척 안 함) — 이 원칙을 다른 외부 서비스 연동(포트원 등)에도 그대로 적용할 것.**
- `lib/email/resend.ts` — 실제 이메일 발송(Resend). 회원가입 시 이메일 실소유 확인에 사용. **같은 원칙 — 설정 안 되어 있으면 명확히 실패.**
- `lib/content/gate.ts` + `app/api/content/examples/[id]/route.ts` — §7.2(Premium 콘텐츠 SSG 금지)의 실제 구현. code/explain/quiz(정답 포함) 전부 게이팅 대상. `app/examples/[id]/page.tsx`는 더 이상 `generateStaticParams`를 쓰지 않음. **새 콘텐츠 관련 페이지를 만들 때 절대 이 패턴(정적 생성)으로 되돌리지 말 것.**
- `app/api/learning/progress`, `app/api/learning/code`, `app/mypage/page.tsx` — 진도·저장코드 실데이터 연동, 전부 인증 필수.
- `app/api/tutor/route.ts` — AI 튜터, **로그인 필수**(2026-08-13 결정), `lib/rate-limit-db.ts`(DB 기반, user_id 기준) 사용. 시스템 프롬프트에 예제 범위 밖 질문 거절 규칙 포함.
- `lib/client-auth.ts` (`authedFetch`) — **인증이 필요한 API를 클라이언트에서 호출할 땐 항상 이 함수를 써야 함, 원시 `fetch`+수동 헤더 방식 금지.** 액세스 토큰 만료(기본 1시간) 시 자동으로 리프레시 토큰으로 갱신 후 재시도한다. **동시에 여러 요청이 401을 받아도 갱신은 1번만 일어나도록 락이 걸려있음(2026-08-13 경쟁조건 버그 수정) — 이 락을 제거하지 말 것.**
- `lib/api-error-handler.ts` (`withErrorHandling`) — **모든 API 라우트는 이걸로 감싸야 함.** 안 감싸면 예상 못 한 예외가 HTML 에러 페이지로 나가서 클라이언트에 "서버에 연결할 수 없어요" 같은 오해를 주는 메시지가 뜬다(2026-08-13 실사용자 테스트 중 발견). **새 라우트를 만들 때 이 패턴을 반드시 따를 것.**
- **Premium VIP 요금제(월 ₩100,000, 2026-08-22, `0035`)** — `subscriptions.plan`에 `premium_vip` 추가, `vip_mentor_requests` 테이블. "AI 초안 + admin 승인 후 발송" 구조 — `app/api/learning/vip/admin/[id]/approve-and-send`를 거치지 않고는 `final_feedback`이 절대 채워지지 않는다(AI 단독 응답 절대 금지, 표시광고법 허위광고 리스크 + 정직성 원칙). `app/api/learning/vip/submit`(학생 제출, 월 4회 한도, `lib/learning/tutorSafety.ts` 안전필터 재사용), `app/admin/vip-review`(관리자 검수, `content-review`와 동일 패턴), `app/mypage/vip`(학생 본인 + guardian 열람), `app/mypage/billing`에 자녀별 VIP 카드. **`lib/content/gate.ts`의 `hasPremiumAccess()`가 `premium_vip`도 인정하도록 확장됨** — VIP 구독자는 일반 Premium 콘텐츠도 함께 이용 가능(새 게이팅 로직 짤 때 이 포함 관계 기억할 것). `hasVipAccess()`는 Family 경유 없음(개인 구독 전용).

## 아직 결정 안 된 것

(현재 없음 — 2026-08-13 AI튜터 로그인 필수 여부 결정으로 마지막 미결 항목 해소됨)

## 아직 안 된 것

- 소셜 로그인(카카오·구글) OAuth 콜백 자체 연동 — Supabase 프로젝트에서 OAuth 프로바이더 설정 필요
- Solapi 프로덕션 키 설정 — 로직·검증은 끝났고 키만 넣으면 됨(서비스 오픈 준비 시점, `.env.local`)
- ~~회사 귀책(중복결제·시스템오류) 전액환불 자동 판별~~ — 2026-08-21 완료(`payments.refund_reason`, `0031`). `refund_reason`을 세팅하는 admin API/화면은 여전히 없음(SQL Editor로 수동) — 필요해지면 별도 작업.
- Family→Premium/Free 요금제 티어 전환, 구독/Family 만료 임박 알림(cron 인프라 필요), 콘텐츠 검수 승인/반려 알림(비-admin 제출 플로우 필요) — 전부 의도적으로 보류된 항목, 대표님이 먼저 꺼낼 때 시작. 각각의 판단 근거는 `~/.claude/projects/-workspaces-MakerStudio/memory/`의 project 메모리 참고.
- §6.3-a 개선판(v2) 콘텐츠를 실제로 다르게 편집하는 UI — "개선판 만들기" 버튼은 v1을 그대로 복제한 draft만 만든다(2026-08-21, `content_modules.slug`/`0032`). 지금은 검수 화면에 편집 폼이 없어서, 내용을 실제로 바꾸려면 반려 후 `generate` 파이프라인으로 다시 만들거나 관리자가 DB를 직접 고치는 수밖에 없다.
- VIP "승인만 하고 발송 보류" UI — 지금은 "승인 후 발송"이 한 클릭으로 묶여있다(대표님 지시, 2026-08-22). `vip_mentor_requests.status`엔 `approved` 값이 체크 제약에 남아있지만 정상 플로우에서 실제로는 안 거쳐간다.
- (**"나머지 화면 이식"은 2026-08-20 기준 사실상 완료** — `guardian_child_links` 실제 연결 로직도 2026-08-18에 이미 구현됨. 이 섹션이 예전엔 이 두 개를 "미완료"로 적어뒀었는데, 실제로는 끝나 있었던 걸 2026-08-20에 발견함 — 이 파일도 코드만큼 자주 낡을 수 있다는 반증이니 의심되면 실제 코드/커밋을 먼저 확인할 것.)

## 지금 뭘 해야 하는지 모르겠으면

`docs/MakerStudio_Dev_Sequence_v1.0.md`를 열어서 아직 안 끝난 가장 앞 단계부터 시작하세요. 순서를 건너뛰지 마세요 — 예를 들어 DB 스키마 없이 결제 연동부터 시작하면 나중에 되돌리는 비용이 큽니다.
