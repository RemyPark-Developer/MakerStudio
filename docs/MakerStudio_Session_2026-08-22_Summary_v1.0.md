# 2026-08-22 세션 요약 — 설계 판단과 구현 범위

**버전**: v1.0 · **최종 수정**: 2026-08-22 · **짝 파일**: `MakerStudio_DB_Schema_v1.0.md`, `MakerStudio_Session_2026-08-21_Summary_v1.11.md`

### 개정 이력
| 버전 | 날짜 | 주요 변경 |
|---|---|---|
| v1.0 | 2026-08-22 | 최초 작성 — 가격 정책 페이지(`/pricing`) 신설 |

날짜가 바뀌어 전날(2026-08-21) 문서에 이어붙이지 않고 새 파일로 만듦
(`Session_2026-08-20_Summary_v1.1.md` §개요 아래 안내된 컨벤션 그대로).

## 개요

| 순서 | 작업 | 커밋 | 마이그레이션 |
|---|---|---|---|
| 1 | 가격 정책 페이지 (`/pricing`) | `6c8864d` | `0034` |

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
