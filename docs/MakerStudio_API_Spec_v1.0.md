# MakerStudio API 명세서 (MVP 범위)

**버전**: v1.2 · **작성일**: 2026-08-13 · **최종 수정**: 2026-08-23(`billing/subscription/retry` — 구현된 적 없는 엔드포인트였음을 확인, 알림+마이페이지 배너 재사용 방식으로 정정)

이전 수정(v1.1, 2026-08-22): 전 도메인 실제 라우트와 대조해 누락·불일치 정정 — `identity/refresh`, `content` 도메인 관리자 라우트 5개, `learning/tutor-history` 추가, `/api/learning/tutor`→`/api/tutor`·`/api/learning/quiz/submit`→`/api/learning/quiz` 경로 오류 정정, `billing/checkout` 문서-코드 불일치 정정
**짝 파일**: `MakerStudio_Project_Design_v2.6.md` · `MakerStudio_MVP_Scope_v1.13.md`

## 0. 이 문서의 목적과 범위

`MakerStudio_MVP_Scope_v1.13.md`에서 확정된 **Must·Should·Could 항목만** 엔드포인트로 정의합니다. Won't 항목(교사 대시보드, 학급코드, 코스 다중모듈, 평점·리뷰 등)의 API는 이 문서에 포함하지 않습니다 — Phase 4 이후 별도 문서로 추가합니다.

## 1. 공통 규칙

- **Base URL**: `/api/{domain}/...` — §5.5의 도메인 구분을 URL 경로에 그대로 반영합니다.
- **인증**: Supabase Auth 기반 JWT. `Authorization: Bearer {token}` 헤더. 미인증 시 `401`.
- **역할(role)**: `student_teen`(중고등/성인), `student_child`(초등, 보호자 연결), `guardian`(보호자), `admin`. 역할별 접근 제어는 엔드포인트마다 명시.
- **에러 응답 포맷** (공통):
```json
{ "error": "invalid_request", "message": "사람이 읽을 수 있는 설명", "field": "email" }
```
- **날짜/시간**: ISO 8601 (`2026-08-13T09:00:00+09:00`)
- **금액**: 원화 정수(₩), 소수점 없음

---

## 2. `identity` 도메인

| Method | Path | 인증 | 설명 |
|---|---|---|---|
| POST | `/api/identity/signup` | ✕ | 중고등/성인 이메일 가입. `{email, password, nickname}` → `role: 'student_teen'` 계정 생성, 확인 메일 발송(`needsEmailVerification: true`) |
| POST | `/api/identity/signup/child` | ✕ | 초등학생 개인가입 1단계. `{nickname, guardianPhone}` → 인증 SMS 발송, `verifyToken` 반환 |
| POST | `/api/identity/signup/child/verify` | ✕ | 2단계. `{verifyToken, smsCode, agreeChildPrivacy: true}` → 계정 생성. `agreeChildPrivacy`가 `false`면 `403`(§3.2 준수, 서버가 반드시 재검증 — 클라이언트 체크박스만 믿지 않음) |
| POST | `/api/identity/login` | ✕ | `{email, password}` → JWT 발급 |
| (없음 — 브라우저가 직접 처리) | 소셜 로그인/가입 (Google, 2026-08-22 구현) | — | ~~`POST /api/identity/signup/social`~~는 실제로 만들지 않음 — 브라우저가 `supabase.auth.signInWithOAuth()`로 직접 Google과 통신하고(`lib/supabase/browser.ts`), `/auth/callback` 페이지가 그 결과 세션을 `GET/PATCH /api/identity/me`(바로 아래)로 브리징한다. 카카오는 Supabase가 토큰 방식(`signInWithIdToken`)을 지원하지 않아 리다이렉트 방식으로 통일 — 대표님이 Supabase 대시보드에 Kakao 프로바이더를 등록하면 같은 구조 그대로 확장 가능. `Auth_Flow.md` §2.1/2.2 참고 |
| POST | `/api/identity/password/forgot` | ✕ | `{email}` → 재설정 메일 발송 (항상 200 반환 — 가입 여부를 노출하지 않기 위함) |
| POST | `/api/identity/password/reset` | ✕ | `{resetToken, newPassword}` → 변경 완료 |
| GET | `/api/identity/me` | ✓ | 내 프로필 조회. `role='guardian'`이면 연결된 자녀 `childId`도 같이 반환(현재 스코프: guardian 1명=자녀 1명, §10). 닉네임이 비어 있으면(신규 소셜/온보딩 미완료) `{needsNickname:true}`만 반환 |
| PATCH | `/api/identity/me` | ✓ | `{nickname?, avatar?, phone?, role?}` — `role`은 신규 사용자(닉네임 미설정)일 때만 반영(§3.3, 기존 계정의 role은 이 경로로 변경 불가). `phone`은 guardian의 SMS 알림 수신 번호(`/mypage/settings`, 2026-08-20 추가) |
| POST | `/api/identity/refresh` | ✕ | `{refreshToken}` → 액세스 토큰 재발급(기본 1시간 만료 대응, 2026-08-13 추가— 원래 이 문서에 없었음) |
| POST | `/api/identity/logout` | ✓ | 세션 무효화 |
| DELETE | `/api/identity/me` | ✓ (guardian만, 자녀 계정 삭제 시) | §4.5 흐름 시작 — 아래 `billing/refund/calculate` 먼저 호출 후 이 엔드포인트로 최종 확정 |

**⚠️ 구현 시 반드시 지킬 것 (§7.2·§3.2 원칙)**: `signup/child/verify`는 클라이언트가 보낸 동의 여부를 그대로 믿지 말고, SMS 인증 성공 여부를 서버에서 재확인한 뒤에만 계정을 생성합니다.

---

## 3. `billing` 도메인

| Method | Path | 인증 | 설명 |
|---|---|---|---|
| GET | `/api/billing/plans` | ✕ | 요금제 목록 (Free, Premium 개인, Family 최대 3명 — B2B는 Won't) |
| GET | `/api/billing/family/members` | ✓ (guardian 또는 admin, 2026-08-22) | 내 family_group 상태 + 현재 멤버 + `guardian_child_links` 기준 추가 가능한 자녀 목록. `requireGuardianOrAdmin()` — admin은 읽기만(`/mypage/billing` 지원·테스트 목적) |
| POST | `/api/billing/family/members` | ✓ (guardian) | `{childId}` → family_group에 추가. 서버가 `guardian_child_links`로 법적 관계를 먼저 검증(`lib/billing/familyMembership.ts`) |
| DELETE | `/api/billing/family/members/:childId` | ✓ (guardian) | family_group 멤버십만 제거 (`guardian_child_links`는 유지) |
| POST | `/api/billing/family/cancel` | ✓ (guardian) | Family 해지. `subscription/cancel`과 동일 원칙 — 즉시 끊지 않고 결제주기 종료일까지 유지(§4.3, 2026-08-20 추가). **해지 후 30일 데이터 보관 정책 준비(2026-08-22, 0036)**: `data_retention_until`(결제주기 종료일+30일)도 같이 기록 — 실제 파기는 자동 실행 안 됨(`scripts/purge-expired-data.ts` 수동 실행 전까지 없음), 문구는 초안·법률 검토 필요 |
| (서버 라우트 없음 — 브라우저가 직접 결제창을 연다) | 결제 시작 | — | **이 프로젝트는 서버가 결제 세션을 만드는 구조가 아니다** — `app/checkout/page.tsx`가 브라우저에서 `@portone/browser-sdk`의 `PortOne.requestPayment()`를 직접 호출해 결제창을 연다(다른 PG 연동과 헷갈리지 말 것). `planId`는 `premium`\|`premium_vip`(월 ₩100,000, 2026-08-22 추가)\|`family`\|`family_extra_seat`(좌석 추가, ₩4,900/좌석, 2026-08-20 추가, 그 결제주기만 유효). 결제 후 아래 `checkout/verify`만 서버가 처리한다(2026-08-22 문서-코드 불일치 정정 — 예전엔 `POST /api/billing/checkout`이라는 존재하지 않는 서버 엔드포인트가 적혀 있었음) |
| POST | `/api/billing/checkout/verify` | ✓ (guardian) | `{paymentId, childId?, planId}` → 포트원 서버에서 실제 결제 정보를 다시 조회해 금액이 일치하는지 검증(클라이언트가 보낸 금액을 그대로 믿지 않음) 후 `activateSubscription()`/`activateFamilyGroup()`/`activateFamilySeatAddon()`으로 활성화. **웹훅(`webhook/portone`)이 최종 진실 공급원**이고 이 라우트는 결제 직후 화면을 빠르게 갱신하기 위한 보조 역할 — 둘 다 같은 활성화 함수를 호출해 멱등성 보장. **학생(role=student_child/student_teen) 토큰으로 호출 시 무조건 `403`**(§3.2 "학생 화면엔 결제 버튼 없음" 원칙을 서버에서도 강제) |
| POST | `/api/billing/webhook/portone` | ✕ (포트원 서명 검증으로 대체) | PG사 웹훅 수신. 결제 성공/실패에 따라 구독 상태 갱신 + `notifications` 도메인에 이벤트 발행 |
| POST | `/api/billing/subscription/cancel` | ✓ (guardian) | 즉시 해지 예약, 현재 결제주기 종료일까지는 유지(§4.3). **해지 후 30일 데이터 보관 정책 준비(2026-08-22, 0036)**: `data_retention_until`도 같이 기록(위 `family/cancel` 행 참고, 원칙 동일) |
| (서버 라우트 없음 — 알림+마이페이지 배너로 대체, 2026-08-23 정정) | 결제 실패 후 재시도 | — | **전용 API를 만들지 않기로 결정** — 이 프로젝트는 정기결제가 아니라 매번 브라우저가 여는 일회성 결제 구조라, 서버가 대신 재결제를 시도할 방법 자체가 없다(카드 정보 미저장). 즉시 실패(카드 거절 등)는 `app/checkout/page.tsx`가 에러를 보여주고 버튼을 다시 누를 수 있게 해서 이미 해결됨. 비동기 실패(웹훅으로만 도착하는 `Transaction.Failed`)는 `webhook/portone`이 정확한 `planId`/`childId`가 담긴 재시도 링크(`/checkout?plan=...&childId=...`)를 `notifications`(`payment_failed`/`payment_activation_failed`)로 보내고, `/mypage/billing`이 안 읽은 해당 알림을 배너로 띄워 그 링크로 안내한다(기존 `GET /api/notifications`·`PATCH /api/notifications/:id/read` 재사용, 새 스키마·API 없음). 예전엔 이 행에 존재하지 않는 `POST /api/billing/subscription/retry`가 적혀 있었음 — 실제로 구현된 적 없음 |
| GET | `/api/billing/history` | ✓ (guardian 또는 admin, 2026-08-22) | 결제 내역/영수증 목록. `requireGuardianOrAdmin()` — admin은 자기 명의 결제(항상 0건)를 읽기만, 다른 사람 데이터가 보이는 게 아님 |
| POST | `/api/billing/refund/calculate` | ✓ (guardian) | `{childId}`(개인) 또는 `{family:true}`(Family, 2026-08-20 추가) → 일할계산 또는 미사용 전액환불 예정액 반환 (§4.5, 계산식: `월구독료 × 잔여일수/전체주기일수`). Family는 7일 이내+가족 전원 미사용 시 전액환불. **회사 귀책(중복결제·시스템오류) 전액환불도 지원(2026-08-21)** — `payments.refund_reason`이 세팅된 결제 건이 있으면 기간·사용여부 무관 그 결제금액 전액환불(`reason: "company_fault"`). 세팅 자체는 여전히 CS/관리자가 SQL Editor로 수동 |
| GET | `/api/billing/dashboard` | ✓ (admin) | **관리자 대시보드(2026-08-21)** — 이번달 매출/유료 구독자 수/이탈률/신규 결제 요약, 요금제별(premium/family) 고객수·비율·이탈률, 최근 6개월 매출 추이. `supabase/migrations/0033`의 뷰 3개를 service_role로만 조회(DB_Schema §2 참고, 뷰를 `authenticated`에 GRANT하면 RLS가 우회되는 위험이 있어 의도적으로 GRANT 없음) |

---

## 4. `content` 도메인

| Method | Path | 인증 | 설명 |
|---|---|---|---|
| GET | `/api/content/examples` | ✕ | 콘텐츠 목록 (PUBLISHED만, 카탈로그 화면용). 쿼리파라미터 `?q=검색어&sort=name\|difficulty` |
| GET | `/api/content/examples/:id` | ✓ (선택적) | 단일 콘텐츠 조회. **§7.2 핵심 원칙**: Free 콘텐츠는 비로그인도 전체 반환, Premium 콘텐츠는 서버가 구독 상태 확인 후에만 `code`·`explain` 필드를 포함. 미구독 시 `intro`만 포함한 축약 응답(미리보기용). **§6.3-a(2026-08-21)**: `content_modules` 기반 콘텐츠는 `:id`가 슬러그를 가리키며, 요청 사용자가 그 슬러그로 이미 학습 중(=`learning_progress` 행 존재)이면 진도 시작 시점 기준으로 고정된 버전을, 신규 학습자·비로그인이면 최신 버전을 반환 |
| POST | `/api/content/:id/revise` | ✓ (admin) | §6.3-a "개선판 만들기" — 게시된 `content_modules` 행(`:id`, 기술적 PK)을 복제해 같은 슬러그의 다음 버전을 `pending_review`로 생성. 이미 검증된 코드의 복제라 자동 재검증(스키마+컴파일) 없이 곧장 검수 대기로 들어감. 응답: `{ok, id, version}`. `source` 행이 `published`가 아니면 `409` |

**⚠️ 이 도메인이 §7.2 위반이 가장 쉽게 발생하는 지점입니다.** `getStaticProps`/SSG로 이 엔드포인트를 대체하지 말 것 — 반드시 요청마다 서버에서 권한을 확인하는 동적 응답이어야 합니다.

**`app/admin/content-review` 화면(§6.3 AI 콘텐츠 파이프라인, 2026-08-22 문서에 처음 채움 — 원래 기록된 적 없었음)**:

| Method | Path | 인증 | 설명 |
|---|---|---|---|
| POST | `/api/content/generate` | ✓ (admin) | `{topic, board?}` → AI 초안 생성 → 스키마 검증 → 실제 avr-gcc 컴파일 검증까지 자동 재시도(최대 3회, §6.3 "2단계 자동 검증"). 셋 다 통과하면 `content_modules`에 `pending_review`로 저장, 실패가 반복되면 `automation_stuck` |
| GET | `/api/content/pending` | ✓ (admin) | `content_modules` 목록. `?status=pending\|published\|withdrawn\|all`(기본 `pending` — `pending_review`+`automation_stuck`) |
| GET | `/api/content/:id` | ✓ (admin) | `content_modules` 단일 조회(기술적 PK `:id` 기준) + 코드 syntax highlight(`codeHtml`, shiki) |
| POST | `/api/content/:id/review` | ✓ (admin) | `{action: 'approve'\|'reject', note?, isPremium?}` → 승인 시 `published`+`is_premium` 확정(§6.3-a), 반려 시 `withdrawn`. 이미 `pending_review`/`automation_stuck`이 아니면 `409` |
| GET | `/api/content/:id/review-chat` | ✓ (admin) | 검수 중 AI와 나눈 대화(`content_review_messages`) 조회 |
| POST | `/api/content/:id/review-chat` | ✓ (admin) | 검수 중 AI에게 질문 → `lib/rate-limit-db.ts`의 `checkReviewChatUsage()`로 사용량 제한 |

---

## 5. `learning` 도메인

| Method | Path | 인증 | 설명 |
|---|---|---|---|
| GET | `/api/learning/progress` | ✓ | 내 진도 목록 (마이페이지, `progress` 테이블 — 정적 `examples` JSON 콘텐츠 전용, 아래 `learning/quiz`가 쓰는 `learning_progress`와는 다른 테이블) |
| POST | `/api/learning/progress` | ✓ | `{exampleId, step}` → 진도 갱신 |
| POST | `/api/tutor` | ✓ (로그인 필수, 2026-08-13 결정) | `{question, exampleId, stepName}` — **경로 정정(2026-08-22)**: `/api/learning/tutor`가 아니라 `/api/tutor`가 실제 경로(도메인 접두사 예외, 원래부터 `learning` 하위로 옮긴 적 없음). `lib/rate-limit-db.ts`(DB 기반, user_id 기준, 하루 10회) 사용. `student_child`의 욕설/개인정보 입력은 `lib/learning/tutorSafety.ts`가 Anthropic 호출 전에 차단(2026-08-20) |
| GET | `/api/learning/code` | ✓ | 저장한 코드 목록 (마이페이지) |
| POST | `/api/learning/code` | ✓ | `{exampleId, code}` → 저장 (컴파일 검증 통과 후에만 허용 — 클라이언트 검증과 별개로 서버도 최소 문법 체크 권장) |
| GET | `/api/learning/wishlist` | ✓ | **Could 항목, 미구현** — 찜한 키트 목록. 실제로 만들어지지 않았고 협상 결과 제외되면 이 행 자체를 지운다 |
| POST/DELETE | `/api/learning/wishlist/:kitId` | ✓ | 찜 추가/제거 (Could, 미구현) |
| POST | `/api/learning/quiz` | ✓ | `{moduleId, score, passed, answers?}` → **경로 정정(2026-08-22)**: `/api/learning/quiz/submit`이 아니라 `/api/learning/quiz`가 실제 경로. `content_modules` 기반 콘텐츠 전용 — `submit_quiz_attempt` RPC(0008/0009)가 `quiz_attempts`에 시도 기록 + `learning_progress`를 원자적으로 갱신(DB_Schema.md §4 참고) |
| GET | `/api/learning/tutor-history` | ✓ | AI 튜터 대화 기록(`tutor_messages`, `/mypage/history`). `?childId=`로 guardian이 연결된 자녀 기록 열람(`guardian_child_links` 검증) — 원래 이 문서에 없었음(2026-08-22 추가) |

**Premium VIP 멘토링(2026-08-22, 0035)** — "AI 초안 + admin 승인 후 발송" 구조. AI가
사람인 척 단독으로 응답을 보내는 것은 절대 금지(표시광고법 허위광고 리스크 + 정직성 원칙).

| Method | Path | 인증 | 설명 |
|---|---|---|---|
| POST | `/api/learning/vip/submit` | ✓ (student, `premium_vip` 구독자만) | `{submissionContent}` → 안전필터(`checkInputSafety`) 통과 시 저장 + AI 초안 동기 생성. 월 4회 초과 시 `429`. 안전필터에 걸리면 `{blocked:true}` 응답, 한도 안 깎임 |
| GET | `/api/learning/vip/my-requests` | ✓ (student 본인 또는 guardian, `?childId=`) | `ai_draft_feedback`은 응답에 아예 없음(관리자 승인 전 절대 노출 안 함). `finalFeedback`은 `status='sent'`일 때만 채워짐 |
| GET | `/api/learning/vip/admin` | ✓ (admin) | 목록, `?status=pending\|sent\|all` |
| GET | `/api/learning/vip/admin/:id` | ✓ (admin) | 상세(제출 원문 + AI 초안) |
| POST | `/api/learning/vip/admin/:id/approve-and-send` | ✓ (admin) | `{finalFeedback}` → 확정 저장 + `status:'sent'`(중간 `approved` 상태를 거치지 않고 한 번의 클릭으로) + guardian에게 `vip_feedback_sent` 알림. 이미 발송된 건은 `409` |

---

## 6. `moderation` 도메인

MVP 범위(§ MVP문서 3항목표: "관리자 검수 — Should, 비-UI 가능")에 따라 **전용 API를 만들지 않고 Supabase 대시보드 등에서 DB를 직접 조작**하는 것으로 충분합니다. 콘텐츠 개수가 늘어나 Phase 6 이후 전용 관리자 화면이 필요해지면 이 섹션에 엔드포인트를 추가합니다.

---

## 7. `notifications` 도메인 (2026-08-20 구현)

| Method | Path | 인증 | 설명 |
|---|---|---|---|
| GET | `/api/notifications` | ✓ | 내 알림 목록 |
| PATCH | `/api/notifications/:id/read` | ✓ | 읽음 처리 (본인 알림만) |
| POST | `/api/notifications/waitlist` | ✕ | `/pricing` 페이지용(2026-08-22). `{email, marketingConsent?}` → `waitlist_emails`에 upsert. 로그인 불필요(비로그인 방문자가 주 대상), `marketingConsent`는 정보통신망법 제50조 별도 동의라 기본 `false` — 프론트엔드가 절대 사전 체크하지 않음(다크패턴 금지 원칙). 잘못된 이메일 형식만 `400`, 그 외엔 항상 `{ok:true}`(이메일 존재 여부를 노출하지 않는 원칙, `password/forgot`과 동일) |

내부적으로 다른 도메인(billing/family)이 `lib/notifications/notify.ts`의 `notifyGuardian()`을 직접
호출하면 이 도메인이 `notifications` row를 만들고 이메일(Resend)로도 발송을 시도합니다. 이 저장소엔
실제 이벤트 버스가 없어서(§5.5가 허용하는 대로) 지금은 순수 함수 호출로 연결돼 있습니다 — 나중에
큐/이벤트 인프라가 생기면 `notifyGuardian()` 내부만 바꾸면 되도록 설계함.

**실제 연결된 트리거**: 결제 성공(`payment_success`), 결제 활성화 실패(`payment_activation_failed`),
결제 실패(`payment_failed`, `webhook/portone`의 `Transaction.Failed` 처리), 구독 해지
(`subscription_canceled`), Family 멤버/좌석 변경(`family_member_added`/`family_member_removed`/
`family_seat_added`/`family_seat_reduced`), AI 튜터 아동 안전장치 발동(`child_chat_flagged`,
2026-08-20), VIP 피드백 발송(`vip_feedback_sent`, 2026-08-22). 전부 guardian에게만 간다(아동
계정은 수신자가 되지 않음). **채널(2026-08-22 정정)**: `payment_failed`/`child_chat_flagged`
2종만 email+SMS, 나머지는 email만(`profiles.phone`, 0018 — guardian이 `/mypage/settings`에서
직접 입력해야 SMS를 받음. Solapi는 프로덕션 키 미설정이라 dev bypass 상태).

**아직 없음**: 구독 만료 임박 알림(cron 인프라 필요), 콘텐츠 검수 승인/반려 알림(제출자가 항상
admin이라 실질적 수신자 없음), 알림 on/off 설정 API. **인앱 알림함 UI(`/mypage/notifications`)는
있음** — 위 목록에서 빠져 있던 기존 오류 정정(2026-08-22).

---

## 8. `commerce-integration` 도메인

| Method | Path | 인증 | 설명 |
|---|---|---|---|
| POST | `/api/commerce/cart/add` | ✓ | **미구현(2026-08-22 확인)** — §4-B 딥링크 스펙만 정의돼 있고 `app/api/commerce/`는 저장소에 없음. `{sku, qty, ref}` → 쇼핑몰 장바구니 URL 반환. 실패 시 `{fallbackUrl}`만 반환(§4-A 방식 B 폴백) |

---

## 9. 이 문서에서 아직 정의하지 않은 것

- 실제 요청/응답의 정확한 필드 타입(TypeScript interface 수준) — DB 스키마 문서와 함께 다음 단계에서 작성
- 에러 코드 전체 목록
- Rate limit 세부 수치(현재 AI튜터만 하루 10회로 확정, 나머지 엔드포인트는 미정)
