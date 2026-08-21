# MakerStudio DB 스키마 (MVP 범위)

**버전**: v1.0 · **작성일**: 2026-08-13
**짝 파일**: `MakerStudio_Project_Design_v2.4.md` · `MakerStudio_MVP_Scope_v1.2.md` · `MakerStudio_API_Spec_v1.0.md`

## 0. 이 문서의 목적과 범위

`MakerStudio_API_Spec_v1.0.md`의 엔드포인트가 실제로 읽고 쓰는 테이블을 정의합니다. **MVP 범위(Must·Should·Could)에 필요한 테이블만** 포함합니다. PostgreSQL(Supabase) 기준입니다.

## 0.1 Supabase 사용 시 주의 — `auth.users`를 직접 만들지 않는다

Supabase는 이메일·비밀번호·소셜 로그인을 처리하는 `auth.users` 테이블을 **이미 자체적으로 제공**합니다 (§5.2에서 Supabase를 선택한 이유 중 하나). 아래 `profiles` 테이블은 `auth.users`를 **대체하는 게 아니라 확장**하는 테이블입니다 — Supabase 표준 패턴입니다.

```sql
-- auth.users는 Supabase가 자동 생성/관리 (직접 만들지 않음)
-- public.profiles가 우리 서비스 고유 필드를 담당
```

---

## 1. `identity` 도메인

### `profiles`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid, PK | `auth.users.id`와 동일값 (FK) |
| role | text | `student_teen` \| `student_child` \| `guardian` \| `admin` |
| nickname | text | 최대 10자 (§10 프로필수정 제약과 동일) |
| avatar | text | 이모지 코드 또는 아바타 ID |
| created_at | timestamptz | |
| deleted_at | timestamptz, nullable | 소프트 삭제 — §4.5 환불 처리와 시점을 맞추기 위해 즉시 하드 삭제하지 않음(법적 보존 의무 데이터와 분리 원칙, §4.5 참고). 실제 익명화/하드삭제 배치는 별도 운영 정책 필요 |
| phone | text, nullable (`0018_guardian_phone_and_sms.sql`, 2026-08-20) | guardian이 `app/mypage/settings`에서 직접 입력하는 SMS 알림 수신 번호. 닉네임과 같은 신뢰 수준(자가입력, 소유 재인증 없음). 초등학생 가입 때 쓰는 `guardianPhone`(SMS 인증용, 인메모리, 저장 안 됨)과는 무관한 별개 값 — 재사용 불가라 새로 만듦 |

### `guardian_child_links`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid, PK | |
| guardian_id | uuid, FK → profiles.id | |
| child_id | uuid, FK → profiles.id | |
| consent_verified_at | timestamptz | SMS 인증 완료 시각 (§3.2 법적 요건 — 반드시 저장) |
| consent_method | text | `sms` (MVP는 이 방식만) |

### `password_reset_tokens`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid, FK → profiles.id | |
| token | text, unique | |
| expires_at | timestamptz | 발급 후 30분(프로토타입과 동일) |
| used_at | timestamptz, nullable | |

---

## 2. `billing` 도메인

### `subscriptions`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid, PK | |
| guardian_id | uuid, FK → profiles.id | 결제 주체 — 반드시 role=guardian만 (§3.2 서버 검증 필수) |
| child_id | uuid, FK → profiles.id | 혜택을 받는 자녀 계정 |
| plan | text | `free` \| `premium` (개인 요금제만. Family는 아래 `family_groups` 별도 테이블) |
| status | text | `active` \| `canceled` \| `past_due` |
| current_period_start | timestamptz | |
| current_period_end | timestamptz | 해지해도 이 시점까지 유지(§4.3) |
| canceled_at | timestamptz, nullable | |

### `family_groups` / `family_group_members` (2026-08-20 추가, MVP_Scope v1.3)
Family 요금제(₩19,900/월, 최대 3명) 구독 그룹. **`guardian_child_links`(§1)와는 별개의 개념**이다 —
`guardian_child_links`는 법적 보호자 관계, 이 두 테이블은 "요금제를 같이 쓰는 그룹" 멤버십이다.
아이를 `family_group_members`에 넣으려면 서버가 먼저 `guardian_child_links`로 법적 관계를 확인해야
한다(`app/api/billing/family/members/route.ts`, `lib/billing/familyMembership.ts`의 `checkCanAddFamilyMember`).

**좌석초과 동시성 방어(0020, 2026-08-20)**: `checkCanAddFamilyMember()`의 사전 체크만으로는
서로 다른 자녀 2명이 동시에 추가 요청을 보내면 둘 다 통과해서 정원(3명)을 넘길 수 있었다.
`add_family_member(p_family_group_id, p_child_id)` RPC가 `family_groups` row를 `for update`로
잠가서 같은 그룹에 대한 동시 요청을 직렬화하고, 최종 판단(플랜 활성 여부·중복·정원)을 원자적으로
다시 한다 — `increment_tutor_usage`(0002), `submit_quiz_attempt`(0008/0009)와 같은 패턴. 같은
아이를 두 번 동시에 추가하는 레이스는 `family_group_members.child_id`의 `unique` 제약이 이미
막고 있어서 이 함수가 따로 신경 쓰지 않는다.

| 테이블 | 컬럼 | 설명 |
|---|---|---|
| `family_groups` | id, owner_id(FK→profiles.id, unique), plan_tier, seat_limit(기본 3, 좌석 추가로 최대 6 — 0021), status(`active`\|`canceled`), current_period_start/end, canceled_at, created_at, updated_at | 보호자당 1개. `owner_id` unique라서 결제 검증(verify)과 웹훅이 같은 결제를 중복 처리해도 자연히 멱등적 |
| `family_group_members` | family_group_id(FK), child_id(FK→profiles.id, unique), added_at | 한 아이는 동시에 하나의 family_group에만 속함 |

**`subscriptions`와는 분리되어 있다** — Family 요금제는 `subscriptions` row를 만들지 않는다.
`payments`는 0015 마이그레이션(2026-08-20)부터 `family_group_id`로 Family 결제도 기록하고,
결제내역(`/api/billing/history` → `/mypage/billing`)도 이 컬럼까지 조회하도록 2026-08-20에
확장됨.

**해지, 좌석 추가/축소(0021, 2026-08-20)**:
- `POST /api/billing/family/cancel` 신규 — `subscription/cancel`과 동일한 패턴으로 `status`를
  `canceled`로, `family_group_members`는 안 지움(같은 `owner_id`로 재결제하면 그대로 재활성화).
- **접근 판단 버그 수정**: `lib/content/gate.ts`의 `hasPremiumAccess()`/`hasFamilyPlanAccess()`가
  원래 `status === 'active'`까지 요구해서, 해지 즉시 접근이 끊기는(§4.3 "잔여기간 보장" 원칙
  위반) 버그가 있었다. 이번에 `current_period_end`만으로 판단하도록 고쳐서 개인/Family 둘 다
  올바르게 동작함.
- **좌석 추가**: 신규 planId `family_extra_seat`(₩4,900/좌석, 2026-08-18 확정, 최대 6석까지)로
  일회성 결제 → `lib/billing/activateFamilySeatAddon.ts`가 `seat_limit`만 올림
  (`current_period_start/end`는 안 건드림). **이 프로젝트는 정기결제가 아니라 매번 브라우저가
  여는 일회성 결제 구조라 "이번 결제 주기 동안만 유효"**하고, 다음 Family 재결제 때
  `activateFamilyGroup()`이 `seat_limit`을 항상 3으로 upsert하면서 자동 리셋됨.
- **좌석 축소(다운그레이드)**: 그 리셋 순간 멤버가 3명을 넘으면(좌석 추가로 4명이었던 경우)
  `lib/billing/familySeatReconciliation.ts`의 `selectMembersToRemove()`(순수 함수, 가장 최근
  추가된 아이부터 제거)로 대상을 정해 `activateFamilyGroup()`이 자동으로 정리하고 보호자에게
  누가 제거됐는지 알림. Family→Premium/Free 같은 요금제 티어 전환은 범위 밖(개인 쪽에도 없는
  별도 기능).

**환불 계산(2026-08-20 Family 정책 확정, `/api/billing/refund/calculate`)**: 요청 바디에
`family:true`를 보내면 개별 자녀가 아니라 family_group 전체 단위로 계산한다(부분환불 없음).
정책: 결제 후 7일 이내 + guardian 본인과 family_group 소속 자녀 **전원**이 그 결제 주기 동안
`learning_progress`/`quiz_attempts`/`tutor_messages`/`progress`/`saved_codes` **5개 테이블
전부**에 활동이 없으면 전액환불(`lib/billing/familyUsage.ts`의 `checkFamilyGroupUsedInPeriod()`),
그 외엔 `calculateProratedRefund()`로 일할계산 — 개인 구독과 같은 함수를 그대로 재사용함.
**회사 귀책(중복결제·시스템 오류) 전액환불(2026-08-21, 0031)**: `payments.refund_reason`에
CS/관리자가 사유를 수동으로 세팅(`duplicate_payment` | `system_error`)하면, `refund/calculate`가
기간·사용여부 계산을 건너뛰고 그 결제 건의 실제 결제금액을 그대로 전액환불한다
(`lib/billing/companyFaultRefund.ts`의 `findCompanyFaultPayment()`). 개인 구독·Family 둘 다
적용 — 회사 귀책은 요금제 구분과 무관한 사유이기 때문. 세팅용 admin API/화면은 이번 범위 밖
(SQL Editor로 직접 UPDATE).

### `payments`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid, PK | |
| subscription_id | uuid, FK → subscriptions.id, nullable(0015) | 개인 구독 결제일 때만 채워짐 |
| family_group_id | uuid, FK → family_groups.id, nullable(0015) | Family 결제일 때만 채워짐 |
| amount | integer | 원화, 소수점 없음 |
| status | text | `success` \| `failed` \| `refunded` |
| pg_transaction_id | text | 포트원 거래 ID |
| paid_at | timestamptz | |
| refund_reason | text, nullable(0031) | `duplicate_payment` \| `system_error` \| null. 채워지면 회사 귀책 전액환불 대상 |

**제약(0015)**: `subscription_id`와 `family_group_id`는 배타적 — 정확히 하나만 채워져야 한다
(`payments_subscription_or_family_group` check 제약). `activateFamilyGroup()`이 이제
`activateSubscription()`과 동일하게 `pg_transaction_id`로 멱등성을 확인한 뒤 payments row를
남긴다.

**보존 원칙(§4.5)**: `deleted_at`이 찍힌 사용자의 `payments` 레코드는 삭제하지 않고 그대로 둡니다 — 전자상거래법상 거래 기록 보존 의무(예: 5년) 때문입니다. `profiles`가 소프트 삭제되어도 `payments`는 `subscription_id`를 통해 계속 조회 가능해야 합니다.

---

## 3. `content` 도메인

### `examples`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid, PK | |
| slug | text, unique | `blink`, `fade` 등 (기존 콘텐츠 JSON의 `id`와 동일) |
| label | jsonb | `{"ko": "...", "en": "..."}` (§6.2 다국어 대비 스키마 그대로) |
| board | text | `Arduino UNO` 등 |
| difficulty | smallint | |
| estimated_minutes | smallint | |
| pin | text | |
| intro | jsonb | 다국어 객체 |
| parts | jsonb | 문자열 배열 |
| code | text | **Premium 콘텐츠면 §7.2에 따라 미구독자에게 절대 반환하지 않음 — API 레이어에서 필터링** |
| explain | jsonb | 다국어 객체, code와 동일하게 게이팅 |
| mission | jsonb | |
| quiz | jsonb | `{question, options, answer, explain}` |
| status | text | `draft` \| `pending_review` \| `published` \| `withdrawn` (§6.3) |
| version | integer | 기본 1, 개정 시 증가(§6.3 "기존 버전은 유지") |
| source_example | text | 소싱 출처(§6.5) |
| last_verified_at | timestamptz | §8.2 신뢰 지표 공개용 |
| is_premium | boolean | Free 콘텐츠 여부 (MVP는 3개 다 Free일 수 있음 — Premium 콘텐츠 추가 시 이 플래그로 게이팅) |

### `content_modules` (`0010_content_modules.sql`, 2026-08-21까지 이 문서에 기록된 적 없었음)

위 `examples`는 이 문서가 원래 설계한 테이블이지만, 실제로는 `content/examples/*.json`(정적
파일)이 카탈로그를 서빙하고 있어 dev DB의 `examples`는 비어 있다(2026-08-20 스키마 감사에서
확인). **관리자 AI 콘텐츠 검수 파이프라인이 실제로 쓰는 테이블은 별도로 신설된 `content_modules`다**
— 관리자 승인(`published`) 시 `lib/content/publishedModules.ts`가 `examples/*.json`과 같은
`Example` 모양으로 매핑해 카탈로그에 합쳐 노출한다(`lib/content/listExamples.ts`).

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | text, PK | 버전별 기술 키. v1은 보통 `slug`와 같고(예: `ultrasonic`), 개선판은 `{slug}-v{version}`(예: `ultrasonic-v2`) |
| slug | text, not null(0032) | **버전과 무관하게 콘텐츠를 식별하는 안정적인 키** — URL(`/examples/{slug}`)과 `learning_progress.module_id`가 참조. 기존 행은 `slug=id`로 백필됨 |
| board / icon / label_ko / label_en | | |
| difficulty / estimated_minutes / pin | | |
| intro_ko / intro_en / parts / circuit | | |
| code | text | |
| explain_ko / explain_en / mission_ko / mission_en | | |
| quiz | jsonb | `{question, options, answer, explain}` |
| source_example | text | §6.5 소싱 출처 |
| is_premium | boolean(0030) | 관리자가 승인 시점에 결정 |
| version | integer, 기본 1 | §6.3-a — `UNIQUE(slug, version)`(0032). 개선판이 승인되면 이전 버전 행도 `published` 그대로 유지(둘 다 동시에 published 가능) |
| status | text | `draft` \| `pending_review` \| `published` \| `withdrawn` \| `automation_stuck`(§6.3, §6.3-b) |
| retry_count / last_error / last_verified_at | | 자동 재검증 이력 |
| created_by / reviewed_by / review_note | uuid → auth.users.id | |
| created_at / updated_at | timestamptz | **§6.3-a가 `updated_at`을 "언제 published로 승인됐는가"의 대리 지표로 씀** — 승인 시(`app/api/content/[id]/review/route.ts`) 항상 같이 갱신되고, 승인 후 재수정 기능이 없어 지금은 항상 성립하는 전제 |

**RLS**: `content_modules_public_read_published`(0010, `status='published'`만 anon+authenticated
select 허용, 0030에서 `is_premium=false` 조건 추가) + 테이블 단위 GRANT(0029). `slug`/`version`
컬럼은 이 정책·GRANT에 포함되는 컬럼 제한이 없어 별도 변경 불필요(0032).

**§6.3-a 버전 판정 로직**: `lib/content/publishedModules.ts`의 `getPublishedModuleForUser(slug, userId)`
— 로그인 사용자가 `learning_progress`에 이 `slug`로 된 행을 이미 갖고 있으면(퀴즈 제출 이력),
그 진도의 `started_at` 시점에 이미 `published`였던 버전 중 가장 높은 버전으로 고정. 진도가
없거나 비로그인이면 최신 버전. 카탈로그(`getPublishedModules()`)는 항상 슬러그당 최신 버전만
노출.

---

## 4. `learning` 도메인

### `progress`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid, FK → profiles.id | |
| example_id | uuid, FK → examples.id | |
| step | smallint | |
| updated_at | timestamptz | |
| UNIQUE(user_id, example_id) | | 한 사용자-예제 조합은 진도 1개만 |

### `saved_codes`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid, FK → profiles.id | |
| example_id | uuid, FK → examples.id | |
| code | text | |
| saved_at | timestamptz | |

### `wishlist_items` (Could — 협상 결과에 따라 테이블 자체를 안 만들 수 있음)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid, FK → profiles.id | |
| kit_id | text | 카탈로그 키트 식별자 |
| created_at | timestamptz | |
| UNIQUE(user_id, kit_id) | | |

### `tutor_usage`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| user_id | uuid, FK → profiles.id | |
| usage_date | date | |
| count | smallint | |
| PRIMARY KEY(user_id, usage_date) | | `lib/rate-limit.ts`를 메모리 대신 이 테이블로 전환(§5.2 명시된 전환 지점) |

### `tutor_messages` (`0012_tutor_messages.sql`, 안전장치 컬럼은 `0017_tutor_safety.sql` 2026-08-20 추가)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid, FK → auth.users | |
| example_id | text | |
| role | text, `'user'`\|`'assistant'` | |
| content | text | `flagged=true`면 원문이 아니라 치환(redact)된 텍스트 — 욕설/개인정보를 DB에 새로 쌓지 않기 위함 |
| created_at | timestamptz | |
| flagged | boolean, default false (0017) | `lib/learning/tutorSafety.ts`의 `checkInputSafety()`/`redactPii()`가 감지 |
| flag_reason | text, nullable (0017) | 지금 쓰는 값: `'profanity'`, `'pii'`. check 제약 없음 — 나중에 관찰용 값 추가 시 마이그레이션 불필요하게 하기 위함 |

**AI 튜터 아동 안전장치(2026-08-20)**: `student_child`가 AI 튜터에게 욕설/개인정보(휴대폰번호·주민등록번호)를
입력하면 Anthropic 호출 전에 차단하고(`app/api/tutor/route.ts`), `guardian_child_links`로 연결된
보호자에게 `notifyGuardian()`(§5 notifications 도메인)로 이메일+SMS를 보낸다(SMS는 0018부터,
전화번호 등록 안 했으면 이메일만). **`moderation` 도메인
(관리자 콘텐츠 검수, 아래 참고)과는 별개** — 이름이 비슷해 보이지만 완전히 다른 기능이라 `learning`
도메인 하위(`lib/learning/tutorSafety.ts`)에 뒀다. 제외한 것: 주소 PII 감지(정규식 신뢰도 낮음),
주제 이탈 하드 차단(시스템 프롬프트 지시로만 대응), 보호자 신고 UI(로그+자동알림까지만).

---

## 5. `notifications` 도메인 (2026-08-20 실제 구현, 0016_notification_delivery.sql)

`notifications` 테이블 자체는 `0001_init.sql`부터 있었지만 실제로 insert하는 코드가 없어 계속
비어있었다. 2026-08-20에 `lib/notifications/notify.ts`의 `notifyGuardian()`을 billing/family
도메인이 직접 호출하는 방식(이벤트 버스 없음, 함수 호출로 결합 — §5.5)으로 실제 연결함.

### `notifications`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid, FK → profiles.id | 항상 guardian — 아동 계정에는 직접 알림을 보내지 않는다(§3.2와 같은 맥락) |
| type | text | `payment_success` \| `payment_activation_failed` \| `payment_failed` \| `subscription_canceled` \| `family_member_added` \| `family_member_removed` \| `child_chat_flagged` (check 제약 없음, 자유 텍스트) |
| message | text | |
| action_url | text, nullable | |
| read_at | timestamptz, nullable | |
| created_at | timestamptz | |
| channel | text, `'email'`\|`'sms'`, default `'email'` (0016) | 이벤트 타입이 채널을 여러 개 요구하면(`payment_failed`, `child_chat_flagged`) 채널마다 row를 하나씩 만든다(0018, 2026-08-20) — 별도 정규화 테이블 대신 기존 구조를 재사용한 의도적 단순화 |
| delivery_status | text, `'pending'`\|`'sent'`\|`'failed'`\|`'skipped'`, default `'pending'` (0016, `'skipped'`는 0018 추가) | 발송 실패해도 이 row(인앱 알림)와 그걸 유발한 도메인 액션(예: 결제 활성화)은 그대로 유지됨. `'skipped'`는 `channel='sms'`인데 guardian이 전화번호를 안 넣어서 발송 시도조차 안 한 경우(진짜 실패와 구분) |
| delivered_at | timestamptz, nullable (0016) | |

**트리거 지점**: `activateSubscription()`/`activateFamilyGroup()`(결제 성공, `alreadyProcessed`
아닐 때만), `webhook/portone/route.ts`(결제 활성화 실패, `Transaction.Failed` 웹훅), `subscription/cancel`,
`family/members` POST/DELETE, `app/api/tutor/route.ts`(`child_chat_flagged`). 결제 실패(`payment_failed`)는
웹훅이 `Transaction.Paid` 외 타입을 전부 버리던 걸 이번에 `Transaction.Failed`도 처리하도록 확장해서 연결함.

**API**: `GET /api/notifications`, `PATCH /api/notifications/:id/read` — §7 참고.

**SMS 채널(2026-08-20, 0018)**: `payment_failed`/`child_chat_flagged` 2종만 email+sms, 나머지는
email만(`lib/notifications/notify.ts`의 `CHANNELS_BY_TYPE`). guardian 전화번호는 `profiles.phone`
(§1)에 저장 — Solapi(`lib/sms/solapi.ts`)는 프로덕션 키 미설정 상태라 dev bypass(콘솔 로그)로
로직만 완성함, 실제 발송 확인은 키 설정 후 별도 진행.

**제외한 것**: 구독 만료 임박 알림(cron 인프라 없음), 콘텐츠 검수 승인/반려 알림(현재
submitter가 항상 admin이라 실질적 수신자 없음), 알림 on/off 설정 화면, SMS 발송 디바운스/합산,
전화번호 소유 재인증, 발송 시도 정규화 테이블(`notification_deliveries`류).

---

## 6. ERD 요약 (관계만)

```
auth.users (Supabase 관리) ──1:1── profiles
profiles ──1:N(guardian)── guardian_child_links ──N:1(child)── profiles
profiles(guardian) ──1:N── subscriptions ──1:N── payments
profiles ──1:N── progress ──N:1── examples
profiles ──1:N── saved_codes ──N:1── examples
profiles ──1:N── wishlist_items (Could)
profiles ──1:N── tutor_usage
profiles ──1:N── notifications
```

## 7. 이 문서에서 아직 정의하지 않은 것

- 인덱스 설계 (쿼리 패턴이 확정된 후 결정 — 예: `examples.status`, `progress.user_id` 등에 필요할 가능성 높음)
- Row Level Security(RLS) 정책 — Supabase 사용 시 필수. `profiles.role`별로 어떤 행을 읽고 쓸 수 있는지 규칙 필요(특히 `student_child`가 `billing` 테이블에 접근 못 하도록 하는 규칙이 §3.2 원칙의 DB 레벨 강제)
- `moderation` 도메인 테이블 — MVP는 비-UI라 Supabase 대시보드에서 `examples.status`를 직접 수정하는 것으로 충분, 별도 테이블 불필요
