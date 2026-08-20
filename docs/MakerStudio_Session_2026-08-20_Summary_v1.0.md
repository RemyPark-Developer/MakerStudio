# 2026-08-20 세션 요약 — 설계 판단과 구현 범위

**버전**: v1.0 · **최종 수정**: 2026-08-20 · **짝 파일**: `MakerStudio_DB_Schema_v1.0.md`, `MakerStudio_MVP_Scope_v1.2.md`

### 개정 이력
| 버전 | 날짜 | 주요 변경 |
|---|---|---|
| v1.0 | 2026-08-20 | 최초 작성 — 관리자 콘텐츠 검수 파이프라인부터 notifications SMS 채널까지 하루치 작업 6단계 정리 |

이 문서는 커밋으로만 남아있는 하루치 작업의 "왜"를 한 곳에 모은 기록이다. 각 항목의 상세 근거는
`~/.claude/projects/-workspaces-MakerStudio/memory/`의 관련 project 메모리(있는 경우 링크)와
`docs/` 산출물 문서(`DB_Schema`, `MVP_Scope` 등)에도 흩어져 있는데, 이 문서는 그걸 작업 순서대로
훑어볼 수 있게 정리한 것 — 세부 스펙이 필요하면 각 문서를 그대로 참고할 것.

**이 문서를 업데이트할 때**: 다른 `docs/*.md`와 같은 원칙 — 새 항목을 추가하거나 기존 판단이
바뀌면 개정 이력에 새 행을 먼저 추가하고, 버전 번호를 올린 뒤 본문을 고칠 것. 지나간 세션 요약을
지우지 말고 이어서 쌓을 것(예: `2026-08-21` 작업분은 "## 7. ..."부터 이어 붙이거나, 날짜가 완전히
바뀌면 별도 파일 `MakerStudio_Session_2026-08-21_Summary_v1.0.md`로 새로 만들지는 다음 세션이 판단).

**파일명도 버전을 따라간다** — 이 문서는 다른 `docs/*.md`와 달리 버전이 올라갈 때마다
`MakerStudio_Session_2026-08-20_Summary_v1.1.md`처럼 **파일명도 같이 바꾼다**(git mv로).
헤더의 버전 번호만 올리고 파일명을 그대로 두지 말 것 — 파일명과 내용의 버전이 어긋나지
않게 하기 위한 명시적 결정(2026-08-20).

## 개요

| 순서 | 작업 | 커밋 | 마이그레이션 |
|---|---|---|---|
| 1 | 관리자 콘텐츠 검수 파이프라인 | `cd6a2a1`~`8eb43d9` | `0010`~`0012` |
| 2 | 관리자 승인 콘텐츠를 사용자 화면에 노출 | `469a5d4` | — |
| 3 | Family 요금제 | `d7e783e`, `01af218` | `0014`, `0015` |
| 4 | notifications 도메인 (+ 결제 재시도 링크 버그 수정) | `d0980ba`, `47ebd93`, `9a139a9` | `0016` |
| 5 | AI 튜터 아동 안전장치 | `d97a641` | `0017` |
| 6 | notifications SMS 채널 | `e517ae8` | `0018` |

---

## 1. 관리자 콘텐츠 검수 파이프라인

**커밋**: `cd6a2a1`(AI 튜터 대화기록 API+마이페이지 탭), `2dca5d3`(관리자 검수 화면 목록/상세/AI채팅/승인·반려), `f7a9691`(상태별 탭+처리 이력), `ed52a9e`(검수 AI 채팅 관리자당 일일 사용량 제한), `13e0182`(AI튜터/검수채팅 질문 500자 제한), `f5a018a`(검수 목록 빈 상태 메시지 버그 수정), `df20d08`(예제/검수 코드 블록 shiki 문법 강조), `8eb43d9`(체크아웃 결제자 이름 input 추가 — 이니시스 "구매자 이름 필수" 에러 대응, 이 파이프라인과는 무관한 별개 버그 수정이지만 같은 시간대에 처리됨)

### 핵심 설계 판단

- `content_modules`(`0010_content_modules.sql`) 테이블에 `status`(`draft → pending_review → published → withdrawn | automation_stuck`) 상태 머신을 두고, 관리자가 `app/admin/content-review`에서 검수·승인/반려하는 구조. AI 자동 생성 콘텐츠가 이 파이프라인을 거쳐 `pending_review`로 들어옴.
- **검수용 AI 채팅(`review-chat`)은 관리자 전용, 아동 튜터 채팅(`tutor`)과 테이블·라우트·권한 전부 별개**로 설계됨 — 나중에(5번 항목) AI 튜터 안전장치를 설계할 때 이 구분이 "moderation 도메인과 헷갈리지 말 것"의 근거가 됨.
- `checkReviewChatUsage`(관리자 일일 사용량 제한)는 `tutor_usage`처럼 원자적 RPC를 쓰지 않고 기존 로그(`content_review_messages`) 카운트로 단순 구현 — 관리자 전용 내부 도구라 동시 요청 경쟁조건 위험이 낮다고 판단해 정밀도를 낮춤(→ [[project-review-chat-rate-limit-deferred]]).

### 의도적으로 제외한 것

- `content_review_messages` 카운트 방식을 `tutor_usage`식 원자적 RPC로 바꾸는 것 — 관리자 수가 실제로 늘어 경쟁조건이 문제될 때까지 보류.

---

## 2. 관리자 승인 콘텐츠를 사용자 화면에 노출

**커밋**: `469a5d4`

### 핵심 설계 판단

- 관리자가 `published` 상태로 승인한 `content_modules` row를 `lib/content/publishedModules.ts`가 `/examples` 카탈로그용 포맷으로 매핑해서 노출.
- **`content_modules`에는 `is_premium` 같은 프리미엄 구분 컬럼이 아예 없다는 걸 이 작업 중 확인** — 스코프에 없던 결정을 즉석에서 만들기보다, `mapRowToExample()`에서 DB 콘텐츠는 전부 `isPremium: false`(무료)로 명시적으로 하드코딩하는 쪽을 택함. "있는 척"하지 않고 "지금은 전부 무료"라고 정직하게 처리.

### 의도적으로 제외한 것

- `is_premium` 컬럼 추가 — DB 생성 콘텐츠도 프리미엄으로 팔아야 하는 요구사항이 실제로 생기기 전까진 보류 (→ [[project-content-modules-premium-deferred]]). 필요해지면: ① `content_modules.is_premium boolean default false` 마이그레이션 ② `mapRowToExample()`의 하드코딩을 `row.is_premium`으로 교체 ③ `lib/content/gate.ts`는 `isPremium` 필드만 보고 게이팅하므로 수정 불필요.

---

## 3. Family 요금제

**커밋**: `d7e783e`(구독 그룹 구조, 0014), `01af218`(결제내역 payments 통합, 0015)

### 핵심 설계 판단

- `family_groups`/`family_group_members`를 개인 `subscriptions`와 별개 테이블로 신설(₩19,900/월, 최대 3명 고정). `guardian_child_links`(법적 보호자-자녀 관계)와는 다른 개념 — 아이를 family_group에 추가하기 전 서버가 반드시 `guardian_child_links`로 법적 관계를 먼저 확인(`checkCanAddFamilyMember`).
- 1차 구현 시 `payments`/`subscriptions`와 분리해뒀던 걸(그래서 결제내역·환불 화면에 Family 결제가 안 보이던 문제), 같은 날 **0015에서 통합** — `payments.subscription_id`를 nullable로 바꾸고 `family_group_id` 컬럼 추가, 둘 중 정확히 하나만 채워지는 배타적 체크 제약. `activateFamilyGroup()`이 `activateSubscription()`과 동일한 멱등성 패턴(`pg_transaction_id` 선확인)으로 `payments` row도 남기도록 확장. `billing/history` 라우트가 `.or()` 쿼리로 개인+Family 결제를 union.
- 웹훅 `customData`에 `guardianId`가 빠져있던 버그를 이 작업 중 같이 고침 — 그 전까진 개인 Premium 구독에 대해서도 웹훅이 조용히 스킵되고 있었음(fail-closed 원칙 위반).

### 의도적으로 제외한 것

- 좌석 추가(4번째 자녀부터), 정원초과 동시성 방어, 다운그레이드 시 좌석 축소 — 전부 이번 범위에서 의도적 제외, `seat_limit`은 DB 제약으로 3 고정.
- **환불 계산(`refund/calculate`)의 Family 확장** — 환불 정책이 아직 논의 안 됨. 대표님이 명시적으로 "정책 정해지면 진행하자"고 결정, 계산 로직(`calculateProratedRefund()`) 자체는 이미 재사용 가능한 상태.

(상세: [[project-family-plan-followups]])

---

## 4. notifications 도메인

**커밋**: `d0980ba`(도메인 신설, 0016), `47ebd93`(알림함 UI), `9a139a9`(결제 실패 재시도 링크 버그 수정)

### 핵심 설계 판단

- `notifications` 테이블 자체는 최초 마이그레이션부터 있었지만 실제로 insert하는 코드가 없어 계속 비어있던 dormant 테이블 — `lib/notifications/notify.ts`의 `notifyGuardian()`을 만들어 처음으로 실제 채우기 시작.
- **이 저장소엔 이벤트 버스가 없음** — `activateSubscription`/`activateFamilyGroup`도 순수 함수 호출로 연결돼 있는 컨벤션 그대로, `notifyGuardian()`도 billing/family 라우트가 직접 import해서 호출하는 방식으로 설계.
- 7개 트리거 연결: 결제 성공(개인/Family), 결제 활성화 실패, 결제 실패(웹훅이 그동안 버리던 `Transaction.Failed` 이벤트를 새로 처리하도록 확장해서 연결), 구독 해지, Family 멤버 추가/제거. 전부 guardian에게만 감(아동 계정은 수신자 후보에서 아예 빠짐).
- 이메일(Resend) 발송 실패해도 함수는 `{ok:true}`를 반환 — 알림 실패가 결제 활성화 같은 도메인 로직의 성공을 되돌리면 안 된다는 원칙.
- **인앱 알림함 UI**(`app/mypage/notifications`)는 API만 있고 화면이 없던 걸 나중에 별도로 채움 — 기존 마이페이지 탭 패턴 재사용, 안읽음은 점 표시+굵게, 클릭 시 읽음 처리.
- **버그 발견·수정**: "Family 결제 실패 재시도 흐름을 확인해달라"는 요청으로 조사하다, `payment_failed` 알림의 `actionUrl`이 파라미터 없는 `/checkout` 고정값이라 `checkout` 페이지가 `plan` 파라미터 없으면 Premium으로 디폴트되는 걸 발견 — **Family 결제 실패자가 이메일 링크를 눌러도 조용히 Premium 화면을 보게 되는 버그**였음. `customData.planId`/`childId`로 `retryUrl`을 동적 생성하도록 고침. 부수적으로 `examples/[id]/page.tsx`의 파라미터 이름 오타(`planId`→`plan`)도 같이 고침.

### 의도적으로 제외한 것

- SMS 채널(당시) — 이후 6번 항목에서 별도로 진행.
- 구독/Family 만료 임박 알림 — cron/스케줄러 인프라가 이 저장소에 전혀 없음, 배포 플랫폼 결정과 얽혀서 별도 논의 필요.
- 콘텐츠 검수 승인/반려 알림 — `content_modules.created_by`가 지금은 항상 admin 자신이라(비-admin 제출 플로우 없음) 알려줄 실제 최종사용자 수신자가 없음.
- 알림 on/off 설정 페이지 — `payment_failed`류는 MVP_Scope가 Must로 못박은 항목이라 끌 수 있게 하는 게 오히려 이상함, 타입 수도 적어 세분화 UI 가치가 낮음.

(상세: [[project-notifications-domain]])

---

## 5. AI 튜터 아동 안전장치

**커밋**: `d97a641`(0017)

### 핵심 설계 판단

- 조사 결과 `student_child`가 AI 튜터와 직접 대화하는데 입력·출력 어느 쪽에도 코드 레벨 필터가 전혀 없었음 — 유일한 안전망은 시스템 프롬프트의 "범위 밖 질문 거절" 지시뿐(모델에게 내리는 지시일 뿐 코드로 강제되지 않음).
- **이름 충돌 발견 및 해결**: 설계 문서에 "`moderation` 도메인"이 이미 **관리자 콘텐츠 검수**(1번 항목)로 정의돼 있어서, 같은 이름을 이 기능에 쓰면 혼동됨 — `moderation`의 기존 정의는 그대로 두고, `learning` 도메인 하위(`lib/learning/tutorSafety.ts`, AI 튜터가 이미 속한 도메인)로 배치.
- 욕설 소규모 목록 + 휴대폰번호·주민등록번호 정규식 2종으로 입력 필터링. 주소는 정규식 신뢰도가 낮아 제외.
- **안전 필터를 rate limit 소비 전에 실행** — 필터에 걸린 시도가 아이의 하루 10회 quota를 깎지 않도록. 걸리면 Anthropic 호출 자체를 안 하니 비용 문제도 없음.
- Claude 응답에도 동일 PII 정규식을 재스캔(모델이 개인정보를 되풀이할 가능성 방어).
- 4번 항목에서 만든 `notifyGuardian()`을 그대로 재사용해 보호자에게 알림 — 원문/치환문은 메일 본문에 안 넣고 "무슨 일이 있었다"만 전달, 세부는 `/mypage/history`의 flag 배지로 확인.

### 의도적으로 제외한 것

- 주소 PII 감지, 주제 이탈 코드 레벨 하드 차단(시스템 프롬프트 지시로만 대응), 욕설 우회 방어 고도화(초성분리 등), 보호자가 직접 누르는 "신고" 버튼 UI, 알림 디바운스/합산, admin이 flag 목록을 모아보는 대시보드.

(상세: [[project-tutor-safety-domain]])

---

## 6. notifications SMS 채널

**커밋**: `e517ae8`(0018)

### 핵심 설계 판단

- **전제 확인 결과 뒤집힘**: "guardian 전화번호는 이미 SMS 인증에서 쓰인 phone 필드가 있을 것"이라는 요청 배경으로 시작했지만, 조사 결과 `profiles` 테이블에 phone 컬럼 자체가 없었음 — 초등학생 가입 때 쓰는 `guardianPhone`은 SMS 인증번호 발송에만 쓰고 인메모리에서 바로 버려지는 값이라 재사용 불가. **이번 작업의 진짜 선행 조건**이 됨.
- `profiles.phone` 신규 추가, `app/mypage/settings`에서 닉네임과 같은 방식(폼→PATCH→저장확인)으로 guardian이 직접 입력.
- 채널 판단: `payment_failed`·`child_chat_flagged` 2종만 email+sms — 자가 해결 가능(재시도, 대화 확인)하고 시급한 이벤트라서. 나머지 5종은 guardian 본인이 방금 한 행동의 확인이거나 안 급한 완료 알림이라 email만.
- 전화번호 미등록 시 `delivery_status: 'skipped'`로 구분 기록 — 발송 시도조차 안 한 걸 진짜 실패(`'failed'`)라고 거짓 보고하지 않기 위함.
- dual-channel 이벤트는 `notifications` row를 채널마다 하나씩 만드는 방식 — 정규화된 별도 "발송 시도" 테이블 대신 기존 스키마를 재사용한 의도적 단순화(2종뿐이라 감수할 만하다고 판단).
- **마이그레이션 트러블슈팅**: 최초 버전이 `notifications.delivery_status`의 기존 체크 제약 이름을 추측해서 하드코딩했다가 실제 이름과 달라, `phone` 컬럼만 추가되고 제약 변경은 실패한 채 중단됨(재실행 시 "column already exists"로 발견). `add column if not exists` + `pg_constraint`에서 제약 이름을 동적으로 찾아 드롭하는 `DO $$ ... $$` 블록으로 재작성 — **앞으로 기존 컬럼의 check 제약을 바꾸는 마이그레이션엔 이 패턴을 기본으로 쓸 것.**

### 의도적으로 제외한 것

- Solapi 프로덕션 키 설정 — 서비스 오픈 준비 시점으로 연기, 로직은 dev bypass(콘솔 로그)로 실DB까지 전부 검증 완료.
- SMS 발송 디바운스/합산, 전화번호 소유 재인증(닉네임과 동일한 신뢰 수준으로 취급), 발송 시도 정규화 테이블.

(상세: [[project-notifications-domain]] §7)

---

## 다음에 이어갈 것 (전부 대표님이 먼저 꺼낼 때 시작)

- Solapi 프로덕션 키 설정
- 환불 정책 확정 후 `refund/calculate`의 Family 확장
- Family 좌석초과 동시성 방어
- 구독/Family 만료 임박 알림 (cron 인프라 선결정 필요)
- 콘텐츠 검수 승인/반려 알림 (비-admin 제출 플로우가 생기면)
- `content_modules.is_premium` 컬럼 (DB 생성 콘텐츠도 프리미엄으로 팔아야 하는 요구사항이 생기면)
