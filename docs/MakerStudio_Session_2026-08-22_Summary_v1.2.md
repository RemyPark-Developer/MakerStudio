# 2026-08-22 세션 요약 — 설계 판단과 구현 범위

**버전**: v1.2 · **최종 수정**: 2026-08-22 · **짝 파일**: `MakerStudio_DB_Schema_v1.0.md`, `MakerStudio_Session_2026-08-21_Summary_v1.11.md`

### 개정 이력
| 버전 | 날짜 | 주요 변경 |
|---|---|---|
| v1.2 | 2026-08-22 | 해지 후 30일 데이터 보관 정책(준비 단계) 이어붙임 — 스키마+수동 파기 스크립트+법적 고지 문구 초안. PDF 포트폴리오는 별도 작업으로 분리 |
| v1.1 | 2026-08-22 | Premium VIP 요금제(월 ₩100,000, AI초안+admin승인 비동기 멘토링) 이어붙임 — 5단계로 나눠 진행, 실증 검증까지 완료 |
| v1.0 | 2026-08-22 | 최초 작성 — 가격 정책 페이지(`/pricing`) 신설 |

날짜가 바뀌어 전날(2026-08-21) 문서에 이어붙이지 않고 새 파일로 만듦
(`Session_2026-08-20_Summary_v1.1.md` §개요 아래 안내된 컨벤션 그대로).

## 개요

| 순서 | 작업 | 커밋 | 마이그레이션 |
|---|---|---|---|
| 1 | 가격 정책 페이지 (`/pricing`) | `6c8864d` | `0034` |
| 2 | Premium VIP 요금제 (AI초안+admin승인 비동기 멘토링) | `d20ec37` | `0035` |
| 3 | 해지 후 30일 데이터 보관 정책 (준비 단계) | (미커밋) | `0036` |

---

## 1. 가격 정책 페이지 (`/pricing`)

**커밋**: `6c8864d` · **마이그레이션**: `0034`(대표님이 SQL Editor에서 적용 완료, 실증 검증까지 마침)

### 배경

`GET /api/billing/plans`이 이미 Free/Premium/Family를 반환하고 있어, 그 응답을 기반으로
실제 화면을 만들어달라는 요청. Premium을 메인으로, Family를 보조로 노출하고 다크패턴
금지 원칙을 지키며, 하단에 출시 알림 신청 섹션을 추가하는 것이 핵심.

### 조사 중 발견한 것 — 요청의 전제 3가지가 실제와 달랐음

- **재사용할 프로토타입 파일이 저장소에 없었다.** `Project_Design_v2.4.md` 헤더가 "짝 파일:
  `makerstudio-prototype.html`"이라고 적어두고 있지만, 저장소 전체를 뒤져도 그런 파일은
  없음(`find . -iname "*.html"` 무결과) — 랜딩/로그인/가입 화면과 달리 이번엔 이식할
  기존 HTML이 없어서 처음부터 실코드로 작성하되, 기존 실제 화면(`app/page.tsx`,
  `app/checkout/page.tsx`)의 클래스 체계(`wrap`/`card`/`tab`/`btn btnCoral`·`btnOutline`/
  `muted`)로 톤만 맞춤.
- **"VIP" 요금제는 이 저장소 어디에도(문서·코드·커밋) 정의된 적이 없다** — `grep -r VIP`
  전체 무결과. `Project_Design_v2.4.md` §4.3의 실제 5-트랙은 Free/Premium개인/Premium가족
  (Family)/낱개코스구매/Classroom(B2B)이고 VIP는 없음. 대표님 지시가 "VIP는 제외"라
  결과적으로 문제는 없었지만(어차피 안 만듦), 확인한 사실은 대표님께 그대로 전달함.
- **"기존에 검증된 Family 절약액 문구"도 저장소에 없었다** — `grep -r 절약` 전체 무결과.
  `PLAN_PRICES.premium(₩9,900) × 3명 = ₩29,700` vs `PLAN_PRICES.family(₩19,900)`으로
  **새로 계산**(월 ₩9,800 절약, 약 33%) — "자녀 3명 기준"은 실제로 정확함(Family는
  `0014_family_groups.sql`부터 `seat_limit default 3`으로 최대 3명이 기본 캡). 가격이
  바뀌어도 항상 정확하도록 하드코딩하지 않고 코드에서 직접 계산.

### 핵심 설계 판단

- **"출시 알림 신청" 저장소는 신규 테이블(`waitlist_emails`, `0034`)로 분리** —
  `notifications`는 `user_id`가 필수 FK라 비로그인 방문자의 이메일을 못 담음(가격
  페이지는 비로그인 방문자가 주 대상). RLS/GRANT 없음(`tutor_usage`/`wishlist_items`와
  동일 패턴, service_role 전용). 재제출은 에러가 아니라 `upsert(onConflict:"email")`로
  갱신 처리 — 마케팅 동의를 나중에 바꿔 다시 제출해도 자연스러움.
- **IP 기준 rate limit은 이번엔 안 넣음** — `lib/rate-limit.ts`(메모리 기반)가 지금
  어디서도 실제로 안 쓰이는 죽은 코드였고(AI튜터가 DB 기반 `rate-limit-db.ts`로 이미
  전환), 이 저장소에 "Next.js 라우트에서 클라이언트 IP를 뽑는" 검증된 패턴 자체가 없음.
  외부 API 호출 비용도 없는 단순 폼이라 `unique(email)` 자체로 스팸 반복 제출을 막는
  것으로 충분하다고 판단, 새 미검증 인프라를 추가하지 않음(이메일 형식 검증만 zod
  `.email()`로 서버에서 함).
- **다크패턴 금지 원칙을 화면에 실제로 적용**: 가짜 취소선 정가 없음(Family 절약액은
  실제 계산값만), 긴급성 카피 없음, 마케팅 수신 동의 체크박스는 기본 미체크
  (`app/signup/page.tsx`의 체크박스 스타일 재사용), "출시 알림 신청" 버튼은 결제
  버튼(`btnCoral`)과 시각적으로 분리된 `btnOutline` 사용 + "알림 받기"로만 표기.
  Premium/Family 카드 둘 다 "언제든 해지 가능, 해지해도 남은 기간은 이용 가능" 명시
  (`app/checkout/page.tsx`의 기존 카피 원칙 재사용).
- CTA 링크: Premium → `/signup`(랜딩페이지 CTA와 동일 패턴), Family →
  `/checkout?plan=family`(childId 불필요 — `mypage/billing/page.tsx`의 실제 동작 패턴
  그대로).
- 가격 값은 `PLAN_PRICES`(`lib/billing/plans.ts`)를 서버 컴포넌트에서 직접 import —
  `GET /api/billing/plans`과 소스가 같아 별도 클라이언트 fetch 왕복 없이 렌더.

### 문서 동기화

- `DB_Schema_v1.0.md` §5(`notifications` 도메인) 아래 `waitlist_emails` 섹션 추가.
- `API_Spec_v1.0.md` — `POST /api/notifications/waitlist` 행 추가.
- `MVP_Scope_v1.2.md` v1.10 — "가격 정책 페이지" 항목 신설(이전엔 스코프된 적 없던 항목,
  VIP 부재 확인 사실도 개정 이력에 기록).

### 검증 방법 — 대표님이 `0034`를 SQL Editor에서 적용한 뒤 실DB로 전 구간 실증 완료

- `npm test` 53개 회귀 확인, `tsc --noEmit` 신규 에러 없음.
- 실제 dev server + Playwright로 `/pricing` 렌더 스크린샷 확인 — Premium이 시각적으로
  메인(굵은 테두리), Family가 보조로 아래 배치, 절약액 계산(₩9,800/33%) 정확히 표시.
  마케팅 동의 체크박스가 `isChecked()`로 실제 `false`인 것까지 프로그래밍적으로 확인
  (사전 체크 없음을 코드 리뷰가 아니라 렌더링된 DOM으로 직접 검증).
- **실제 `POST /api/notifications/waitlist` 호출로 확인**: 최초 신청 → 행 생성 +
  `marketing_consent` 기본 `false` 확인 → 같은 이메일 재제출(`marketingConsent:true`) →
  에러 없이 `200` + 행이 갱신됨(새 행이 추가되는 게 아니라 정확히 1개로 유지, `unique`
  제약과 upsert 로직 둘 다 실증) → 잘못된 이메일 형식(`"not-an-email"`) → `400`, 행 생성
  안 됨.
- **실제 브라우저로 `/pricing` 폼을 채우고 제출까지 확인**: 이메일 입력 → 마케팅 동의
  체크 → "출시 알림 받기" 클릭 → "알림 신청이 완료됐어요" 메시지 렌더 → DB에
  `marketing_consent: true`로 정확히 반영된 행 생성 확인(체크박스 상태가 실제로 서버까지
  전달되는지 프론트~백엔드 전 구간 확인).
- 테스트로 넣은 행 전부 삭제 확인(`waitlist_emails` 0건으로 복귀).

### 의도적으로 제외한 것

- IP 기준 rate limit — 위 참고, 필요해지면 이 저장소에 "IP 추출" 패턴부터 새로 검증해야 함.
- VIP 요금제 카드 — 대표님 지시대로 제외, 애초에 이 저장소에 정의된 적도 없음.
- 낱개 코스 구매·Classroom(B2B) 트랙 노출 — §4.3엔 있지만 이번 요청 범위(Premium
  메인/Family 보조) 밖.
- 관리자가 `waitlist_emails` 목록을 보는 화면 — 이번 범위는 수집까지만.

(상세: [[project-pricing-page]])

---

## 2. Premium VIP 요금제 (AI초안+admin승인 비동기 멘토링)

**커밋**: `d20ec37` · **마이그레이션**: `0035`(대표님이 SQL Editor에서 적용 완료, 실증 검증까지 마침)

### 배경

월 ₩100,000짜리 신규 트랙 — 학생이 프로젝트/코드를 제출하면 AI가 초안 피드백을 쓰고,
**반드시 admin이 검토·수정한 뒤에만** 학생/보호자에게 전달된다. AI가 사람인 척 전부
처리하면 표시광고법 허위광고 리스크이자 이 프로젝트의 정직성 원칙 위반이라는 게 대표님이
명시한 절대 전제. 규모가 커서 5단계로 나눠 각 단계마다 확인받으며 진행.

### 조사 중 확인한 요청 전제와의 차이 (구현 전 대표님께 먼저 보고, 승인 후 진행)

- **"스키마 변경 없이 사용 가능한지 확인" → 실제로는 마이그레이션 필요**했음.
  `subscriptions.plan`의 check 제약이 `('free','premium')`만 허용해서 `premium_vip`는
  insert 자체가 막혔음. 반대로 `checkout/verify`·`webhook/portone`은 이미 `planId`를
  하드코딩 분기 없이 완전히 제네릭하게 처리하고 있어서, 체크 제약만 풀면 결제 파이프라인
  자체는 코드 변경이 필요 없었음.
- **"role=premium_vip 구독자만" → `profiles.role`과 `subscriptions.plan`을 혼동한
  표현**이었음. `role`은 학생/보호자/관리자 구분이고 요금제 등급은 `plan`에 있음 — 실제
  체크는 "role이 학생이고 plan='premium_vip' 구독이 있는지"로 설계.
- **"checkout API에 premium_vip 케이스 추가" → 실제로는 필요 없었고(위와 같은 이유),
  대신 `app/checkout/page.tsx`의 `PLAN_COPY`에 항목이 빠지면 결제 금액(₩100,000)과
  화면 표시(₩9,900 폴백)가 어긋나는 실제 버그가 생길 뻔했음** — 요구사항에 없던
  항목이지만 발견해서 같이 고침.
- **"content_review_messages 패턴 재사용"은 워크플로우의 비유였을 뿐, 테이블 구조는
  `content_modules`(단일 행에 상태+본문)에 더 가까움** — `content_review_messages`는
  대화 로그(여러 행) 구조라 그대로 가져오면 안 맞았음.

### 이번 세션에서 확정된 설계 결정

| 항목 | 결정 |
|---|---|
| VIP 구독자의 일반 Premium 콘텐츠 접근권 | 포함 — `hasPremiumAccess()`를 `plan in ('premium','premium_vip')`로 확장 |
| VIP 제출 빈도 제한 | 월 4회, `flagged=false`인 것만 카운트(안전필터에 걸린 시도는 quota 안 깎임 — AI 튜터와 동일 원칙) |
| VIP 결제 진입점 | `app/mypage/billing`에 자녀별 "VIP 시작하기" 카드 |
| 학생 열람 화면 | `app/mypage/vip` — 학생 본인 + guardian(연결된 자녀 선택) |
| 관리자 승인→발송 흐름 | 한 번의 클릭으로 통합("승인 후 발송") — `approved` 상태는 체크 제약에 남기되 정상 플로우에서 실제로는 거치지 않음 |

### 핵심 설계 판단

- `subscriptions.plan` 체크 제약을 하드코딩된 이름이 아니라 `pg_constraint`에서 동적으로
  찾아 드롭(`0018_guardian_phone_and_sms.sql`에서 확립한 패턴 재사용) — 제약 이름 추측이
  틀려서 마이그레이션이 중간에 멈추는 사고를 다시 겪지 않기 위함.
- `vip_mentor_requests`는 `tutor_messages`/`learning_progress`처럼 실제 사용자 생성
  콘텐츠를 담는 테이블이라 RLS+GRANT를 세트로 걸었다(학생 본인 select, admin 전체
  select, 쓰기는 service_role만) — 단순 카운터인 `tutor_usage`/`waitlist_emails`와는
  다른 부류로 판단.
- guardian이 자녀 것을 보는 경로는 RLS로 안 됨(guardian ≠ 제출자) — `my-requests` API가
  `guardian_child_links`로 관계를 먼저 확인한 뒤 service_role로 조회. 반대로 "발송 시
  누구에게 알릴지"는 `guardian_child_links`가 아니라 **`subscriptions.guardian_id`에서
  직접 찾음** — VIP를 실제로 결제한 사람이라는 걸 보장하는 더 확실한 소스라고 판단.
- AI 초안 생성은 `content/generate`와 동일하게 요청 안에서 동기 호출 — 별도 큐 인프라
  없이 기존 패턴 재사용. 실패해도 제출 자체는 이미 저장돼 있어 학생에게는 에러로 안
  보이고, `status`가 `submitted`에 머물러 관리자가 검수 목록에서 확인 가능.
- 안전필터(`lib/learning/tutorSafety.ts`의 `checkInputSafety()`)를 AI 튜터와 동일한
  순서(quota 소비 전)로 적용 — 걸리면 Anthropic 호출 자체를 안 해서 비용 방어 + 월
  4회 한도 보존.

### 문서 동기화

- `DB_Schema_v1.0.md` §4(`learning` 도메인) — `vip_mentor_requests` 섹션 신설,
  `notifications.type`/`subscriptions.plan` 컬럼 설명에 신규 값 반영.
- `API_Spec_v1.0.md` — VIP 엔드포인트 4개 추가. **김에 `billing/checkout` 행의
  기존 문서-코드 불일치(실제로는 서버 세션 생성 라우트가 없고 브라우저가 직접 포트원을
  호출하는 구조)도 발견해서 주석으로 남김**(이번 범위 밖이라 수정은 안 함).
- `MVP_Scope_v1.2.md` v1.11 — "Premium VIP" 행 신설.

### 검증 방법 — 대표님이 `0035`를 SQL Editor에서 적용한 뒤 실DB로 전 구간 실증 완료

임시 계정(guardian 1 + student_teen 1 + student_child 1 + VIP 미구독 student_teen 1 +
admin 1)으로 총 22개 체크 전부 통과:
- 권한 방어: guardian/미구독 학생이 제출 시도하면 각각 `403`.
- **`hasPremiumAccess()` 확장 실증**: VIP 전용 구독만 있는 학생이 일반 Premium 콘텐츠
  (`rgb-led-color-control`)에 실제로 접근 가능한지 확인.
- 안전필터: PII 포함 제출 → 차단, `flagged:true`로 원문 아닌 치환문 저장, student_child는
  guardian에게 `vip_submission_flagged` 알림까지 감.
- 월 4회 한도: 미리 심어둔 3건 + 실제 API 4번째 제출(성공, 진짜 Anthropic 호출로 AI초안
  생성까지 확인) → 5번째는 `429`.
- 발송 전엔 학생 화면에 `ai_draft_feedback`이 아예 노출 안 되고 `finalFeedback`도 `null`인
  것 확인 → 관리자 목록/상세 조회 → "승인 후 발송"(관리자가 수정한 텍스트로) → 재발송
  시도하면 `409` → guardian에게 `vip_feedback_sent` 알림 감 → 학생/guardian 화면에
  **관리자가 수정한 정확한 텍스트**로 최종 피드백이 뜨는 것까지 확인.
- guardian이 연결 안 된 아이를 조회하면 `403`.
- 테스트 중 첫 시도에서 실패 3건 발견 — 원인은 스크립트 자체의 버그(안전필터 테스트용
  student_child 계정에 VIP 구독을 안 줘서 hasVipAccess 단계에서 먼저 막힘)였고, 실제
  기능 결함이 아니었음. 계정에 구독을 추가해 재실행하니 22개 전부 통과.
- 테스트 계정·구독·`vip_mentor_requests`·알림은 검증 직후 전부 삭제 확인(0건으로 복귀).

### 의도적으로 제외한 것

- `hasPremiumAccess()` VIP 포함은 처음엔 이번 범위에서 보류하기로 했다가, 대화 중
  대표님이 이번 범위에 바로 포함시키기로 번복 — 최종적으로 구현됨(위 결정 표 참고).
- 관리자-AI 대화 채팅 기능(`content_review_messages`류) — 요구사항에 없었고, 승인+발송
  한 번의 클릭 구조와도 안 맞아서 안 만듦.
- 승인만 하고 발송을 나중으로 미루는 UI(중간 `approved` 상태 활용) — 체크 제약엔
  남겨뒀지만 화면/API에서 실제로 쓰지 않음, 필요해지면 나중에.

(상세: [[project-vip-mentor-program]])

---

## 3. 해지 후 30일 데이터 보관 정책 (준비 단계)

**커밋**: (미커밋 — 이번 세션 진행 중) · **마이그레이션**: `0036`(작성만, 적용은 대표님이 SQL Editor에서)

### 배경

개인정보보호법 제21조상 "계약종료"(구독 해지) 시점엔 개인정보를 원칙적으로 지체없이
파기해야 하는데, 실수 해지 방지를 위해 30일 유예를 두려면 ①사전 고지 ②실제 파기 실행이
필요하다. cron 인프라가 없어 ②는 이번 범위 밖 — **지금은 아무것도 자동으로 삭제되지
않는다**(기존 코드에도 해지 후 학습 데이터를 지우는 로직 자체가 없었음을 확인).

### 조사 중 확인한 것

- **개인정보처리방침 문서/페이지가 이 저장소에 없었다** — `app/page.tsx`의
  "개인정보처리방침"은 링크조차 아닌 순수 텍스트, `Project_Design_v2.4.md` §13도
  "실제 문서 없음(원칙만 정의됨)"이라고 명시. 완전한 정책을 이번에 새로 지어내는 대신
  **이 조항 하나만 다루는 초안 addendum**(`docs/MakerStudio_Privacy_Policy_DRAFT_addendum_v0.1.md`)
  을 만들고 아직 공개 페이지엔 노출하지 않기로 함.
- **요구사항 6(해지 시 PDF 포트폴리오 다운로드)의 "§7.5 재사용" 전제가 실제와 다름** —
  이 저장소엔 PDF 생성 코드/라이브러리/폰트가 전혀 없음(§7.5는 설계 문서의 스펙일 뿐,
  실제 구현·샘플은 이 저장소 밖에서만 검증됨 — `makerstudio-prototype.html`이 없었던
  것과 같은 종류의 간극, `MVP_Scope_v1.2.md`에도 이미 "PDF 워크북/수료증 — 샘플만
  있음(§7.5), 화면 연동 안 함"으로 같은 사실이 기록돼 있었음). 대표님과 상의 후 이번
  범위에서 제외, 별도 작업으로 분리.
- **"canceled_at + 30일" 문자 그대로 쓰면 §4.3 원칙과 부딪힘** — 해지해도 결제기간
  종료일까지는 이용 가능한데 `canceled_at`부터 30일을 세면, 결제주기가 많이 남은
  상태에서 해지한 사람은 실제 접근을 잃는 시점부터 겨우 며칠 뒤에 데이터가 삭제
  대상이 될 수 있음 — "실수 해지 방지"라는 목적과 안 맞아서 **`current_period_end`
  (실제 접근이 끊기는 시점) + 30일**로 계산하도록 제안·반영.

### 핵심 설계 판단

- 컬럼 계산은 트리거가 아니라 애플리케이션 로직(`subscription/cancel`, `family/cancel`)
  으로 — 이 저장소는 DB 트리거를 최소한만 쓰는 컨벤션(0003 프로필 자동생성 정도)이라
  일관성 유지.
- 재구독하면(`activateSubscription()`/`activateFamilyGroup()`) `data_retention_until`을
  다시 `null`로 초기화 — 파기 스크립트가 이 값이 지난 것만 대상으로 삼으므로 자동으로
  대상에서 빠짐, 별도 "복원" 로직 불필요.
- "학습 데이터" 범위는 새로 정의하지 않고 Family 환불 정책(2026-08-20)에서 이미 확정한
  5개 테이블 + VIP 멘토링(`vip_mentor_requests`)을 그대로 재사용
  (`lib/billing/dataRetention.ts`의 `LEARNING_DATA_TABLES`) — 같은 개념을 두 번 다르게
  정의하지 않기 위함.
- `scripts/purge-expired-data.ts`는 기본이 dry-run(`--confirm` 있어야 실제 삭제) —
  실제 개인정보를 지우는 스크립트라 안전장치를 기본값으로 둠. 대상 판정 시
  `lib/content/gate.ts`의 `hasPremiumAccess()`(이번에 export로 전환)를 재사용해 "지금
  다른 경로로 활성 접근권이 있는지" 한 번 더 확인 — 있으면 제외.
- `hasPremiumAccess()`를 export한 것 외엔 기존 게이팅 로직 자체는 안 건드림(어제 §12에서
  이미 `premium_vip`까지 포함하도록 확장 완료된 상태 그대로 재사용).

### 문서 동기화

- `DB_Schema_v1.0.md` — `subscriptions`/`family_groups` 컬럼 설명에 `data_retention_until`
  추가 + §2에 정책 전용 하위 섹션 신설.
- `API_Spec_v1.0.md` — `subscription/cancel`/`family/cancel` 행에 이번 변경 반영.
- `MVP_Scope_v1.2.md` v1.12 — 신규 changelog 행 + Won't 표에 "해지 후 자동 파기(cron)"·
  "PDF 포트폴리오" 2건 추가(이미 있던 "PDF 워크북/수료증" 행과 같은 근본 원인이라는 것도
  명시).
- `docs/MakerStudio_Privacy_Policy_DRAFT_addendum_v0.1.md`(신규) — 조항 초안 + "법률 검토
  전 대외 공개 금지" 명시 + 법률 검토 시 확인이 필요한 지점 메모.
- project 메모리에도 "이 정책의 법적 문구·기준은 초안, 확정 아님" 기록(다음 세션이
  이미 확정된 것으로 오해하지 않도록).

### 검증 방법 — 대표님이 `0036`을 SQL Editor에서 적용한 뒤 실DB로 전 구간 실증 완료

- `calculateRetentionUntil()` 단위테스트 5개(월/연도 경계값, 순수 함수 여부 등) 신규
  추가 — `npm test` 58개 전부 통과(기존 53 + 신규 5), `tsc --noEmit` 신규 에러 없음.
- 실제 `POST /api/billing/subscription/cancel`/`family/cancel` 호출 → `data_retention_until`이
  `current_period_end + 30일`로 정확히 찍히는지 확인(개인/Family 둘 다) → `activateSubscription()`을
  실제로 호출해 재구독 시뮬레이션 → `canceled_at`/`data_retention_until` 둘 다 `null`로
  정확히 초기화되고 `status`가 `active`로 돌아오는 것까지 확인.
- `purge-expired-data.ts`를 3가지 케이스로 실제 검증: (1) 보관 기한이 지났고 다른
  접근권도 없는 아이 → 파기 대상으로 정확히 잡힘 (2) 보관 기한이 아직 안 지난 아이 →
  후보 쿼리에조차 안 잡힘 (3) **Family는 해지했지만 개인 Premium 구독이 별도로 살아있는
  아이** → `hasPremiumAccess()` 안전장치가 정확히 "제외됨" 목록으로 걸러냄. dry-run으로
  먼저 확인(아무것도 안 지워짐) → `--confirm`으로 실제 `learning_progress`에서만 1건
  삭제되는 것까지 확인 → 재실행해도 이미 지워진 건 다시 안 잡히는(idempotent) 것도 확인.
- **검증 중 발견한 것(전부 스크립트 버그, 앱 결함 아님)**: ① `subscriptions`에
  `(guardian_id, child_id)` unique 제약이 있어(`0005_subscriptions_unique.sql`) 한
  아이가 구독 행을 2개 동시에 가질 수 없다는 걸 처음엔 놓쳐서 "다른 접근권" 시나리오를
  잘못 설계했었음(개인 구독 2개로 시도 → unique violation) — Family 해지+개인 구독
  별도 유지 조합으로 다시 설계해서 실제 안전장치 코드 경로를 정확히 태움. ②
  `family_group_members`가 `(family_group_id, child_id)` 복합 PK라 별도 `id` 컬럼이
  없다는 걸 몰라서 `.select("id")`가 에러를 냄. ③ 재구독 테스트가 실제 `payments` 행을
  만드는데(`activateSubscription()`의 정상 동작) `payments`는 §4.5 보존 원칙상 cascade
  delete가 없어서, 검증 스크립트의 정리(cleanup) 순서가 꼬여 임시 계정 3쌍이 처음엔
  안 지워짐 — `payments`→`subscriptions`→`auth.users` 순으로 직접 지워서 해결.
- 임시 계정·구독·Family 그룹·학습 데이터는 검증 직후 전부 정리 확인(baseline과 정확히
  같은 카운트로 복귀 — `learning_progress`에 남아있던 1건은 2026-08-19 날짜의 무관한
  기존 데이터였음을 확인, 손대지 않음).

### 의도적으로 제외한 것

- 실제 자동 파기(cron) — 인프라 미결정, 대표님이 명시적으로 이번 범위 밖으로 지정.
- 해지 시 PDF 학습 포트폴리오 다운로드 — 위 참고, 별도 작업.
- 자녀 개별 제거(Family 멤버십에서만 빼는 것)에 대한 보관 정책 — 이번 요구사항은
  "구독/Family 전체 해지"만 대상으로 명시됐고, 개별 멤버 제거는 다른 시나리오라 범위 밖.
- 개인정보처리방침 전체 문서화 — 이 조항 하나만 초안으로 준비, 전체 정책은 별도 작업.

(상세: [[project-data-retention-policy]])

---

## 다음에 이어갈 것 (전부 대표님이 먼저 꺼낼 때 시작 — 2026-08-21 문서에서 이월)

- Solapi 프로덕션 키 설정
- 구독/Family 만료 임박 알림 (cron 인프라 선결정 필요)
- 콘텐츠 검수 승인/반려 알림 (비-admin 제출 플로우가 생기면)
- 관리자 대시보드의 `free` 티어 고객 수 (전체 학습자 계정 − 유료 커버 인원 계산 필요)
- Family → Premium/Free 요금제 티어 전환
- `progress`/`saved_codes` 미사용 판단 로직의 실데이터 검증 (`examples` 테이블에 데이터가 생기면)
- `already_member` 레이스 사용자 메시지 개선 (정확성 문제 아닌 UX nicety)
- 회사 귀책 사유(`refund_reason`)를 세팅하는 admin API/화면 (지금은 SQL Editor 수동)
- 개선판 콘텐츠를 실제로 편집하는 UI (지금은 복제 그대로만 검수 가능)
- `content_modules`가 승인 후 재수정 가능해지면 `published_at` 컬럼 분리 검토
- `/pricing` 출시 알림 신청 목록을 보는 관리자 화면
- IP 기준 rate limit 패턴 자체를 이 저장소에 처음 도입하는 것 (필요해지면)
- VIP "승인만 하고 발송 보류" UI (지금은 승인+발송이 한 클릭으로 묶여있음)
- `billing/checkout` 문서-코드 불일치 정리 (API_Spec의 경로명이 실제 구현과 다름)
