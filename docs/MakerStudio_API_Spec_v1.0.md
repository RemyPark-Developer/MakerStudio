# MakerStudio API 명세서 (MVP 범위)

**버전**: v1.0 · **작성일**: 2026-08-13
**짝 파일**: `MakerStudio_Project_Design_v2.4.md` · `MakerStudio_MVP_Scope_v1.2.md`

## 0. 이 문서의 목적과 범위

`MakerStudio_MVP_Scope_v1.2.md`에서 확정된 **Must·Should·Could 항목만** 엔드포인트로 정의합니다. Won't 항목(교사 대시보드, 학급코드, 코스 다중모듈, 평점·리뷰 등)의 API는 이 문서에 포함하지 않습니다 — Phase 4 이후 별도 문서로 추가합니다.

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
| POST | `/api/identity/signup/social` | ✕ | 소셜 OAuth 콜백 처리. `{provider, oauthToken}` → 신규면 계정 생성 후 `{needsNickname: true}` 반환 (온보딩 화면 분기용, 프로토타입 §랜딩→가입 참고) |
| POST | `/api/identity/signup/child` | ✕ | 초등학생 개인가입 1단계. `{nickname, guardianPhone}` → 인증 SMS 발송, `verifyToken` 반환 |
| POST | `/api/identity/signup/child/verify` | ✕ | 2단계. `{verifyToken, smsCode, agreeChildPrivacy: true}` → 계정 생성. `agreeChildPrivacy`가 `false`면 `403`(§3.2 준수, 서버가 반드시 재검증 — 클라이언트 체크박스만 믿지 않음) |
| POST | `/api/identity/login` | ✕ | `{email, password}` → JWT 발급 |
| POST | `/api/identity/login/social` | ✕ | `{provider, oauthToken}` → JWT 발급 |
| POST | `/api/identity/password/forgot` | ✕ | `{email}` → 재설정 메일 발송 (항상 200 반환 — 가입 여부를 노출하지 않기 위함) |
| POST | `/api/identity/password/reset` | ✕ | `{resetToken, newPassword}` → 변경 완료 |
| GET | `/api/identity/me` | ✓ | 내 프로필 조회 |
| PATCH | `/api/identity/me` | ✓ | `{nickname?, avatar?}` — 닉네임·아바타만 수정 가능(§10 프로필수정) |
| POST | `/api/identity/logout` | ✓ | 세션 무효화 |
| DELETE | `/api/identity/me` | ✓ (guardian만, 자녀 계정 삭제 시) | §4.5 흐름 시작 — 아래 `billing/refund/calculate` 먼저 호출 후 이 엔드포인트로 최종 확정 |

**⚠️ 구현 시 반드시 지킬 것 (§7.2·§3.2 원칙)**: `signup/child/verify`는 클라이언트가 보낸 동의 여부를 그대로 믿지 말고, SMS 인증 성공 여부를 서버에서 재확인한 뒤에만 계정을 생성합니다.

---

## 3. `billing` 도메인

| Method | Path | 인증 | 설명 |
|---|---|---|---|
| GET | `/api/billing/plans` | ✕ | 요금제 목록 (Free, Premium 개인, Family 최대 3명 — B2B는 Won't) |
| GET | `/api/billing/family/members` | ✓ (guardian) | 내 family_group 상태 + 현재 멤버 + `guardian_child_links` 기준 추가 가능한 자녀 목록 |
| POST | `/api/billing/family/members` | ✓ (guardian) | `{childId}` → family_group에 추가. 서버가 `guardian_child_links`로 법적 관계를 먼저 검증(`lib/billing/familyMembership.ts`) |
| DELETE | `/api/billing/family/members/:childId` | ✓ (guardian) | family_group 멤버십만 제거 (`guardian_child_links`는 유지) |
| POST | `/api/billing/checkout` | ✓ (guardian) | `{planId, paymentMethod}` → 포트원 결제창 세션 생성. **학생(role=student_child) 토큰으로 호출 시 무조건 `403`** (§3.2 "학생 화면엔 결제 버튼 없음" 원칙을 서버에서도 강제) |
| POST | `/api/billing/webhook/portone` | ✕ (포트원 서명 검증으로 대체) | PG사 웹훅 수신. 결제 성공/실패에 따라 구독 상태 갱신 + `notifications` 도메인에 이벤트 발행 |
| POST | `/api/billing/subscription/cancel` | ✓ (guardian) | 즉시 해지 예약, 현재 결제주기 종료일까지는 유지(§4.3) |
| POST | `/api/billing/subscription/retry` | ✓ (guardian) | 결제 실패 후 재시도 |
| GET | `/api/billing/history` | ✓ (guardian) | 결제 내역/영수증 목록 |
| POST | `/api/billing/refund/calculate` | ✓ (guardian) | `{}` → 일할계산 환불 예정액 반환 (§4.5, 데모에서 검증한 계산식과 동일: `월구독료 × 잔여일수/전체주기일수`) |

---

## 4. `content` 도메인

| Method | Path | 인증 | 설명 |
|---|---|---|---|
| GET | `/api/content/examples` | ✕ | 콘텐츠 목록 (PUBLISHED만, 카탈로그 화면용). 쿼리파라미터 `?q=검색어&sort=name\|difficulty` |
| GET | `/api/content/examples/:id` | ✓ (선택적) | 단일 콘텐츠 조회. **§7.2 핵심 원칙**: Free 콘텐츠는 비로그인도 전체 반환, Premium 콘텐츠는 서버가 구독 상태 확인 후에만 `code`·`explain` 필드를 포함. 미구독 시 `intro`만 포함한 축약 응답(미리보기용) |

**⚠️ 이 도메인이 §7.2 위반이 가장 쉽게 발생하는 지점입니다.** `getStaticProps`/SSG로 이 엔드포인트를 대체하지 말 것 — 반드시 요청마다 서버에서 권한을 확인하는 동적 응답이어야 합니다.

---

## 5. `learning` 도메인

| Method | Path | 인증 | 설명 |
|---|---|---|---|
| GET | `/api/learning/progress` | ✓ | 내 진도 목록 (마이페이지) |
| POST | `/api/learning/progress` | ✓ | `{exampleId, step}` → 진도 갱신 |
| POST | `/api/learning/tutor` | ✓ | `{question, exampleId, stepName}` — 기존 `app/api/tutor/route.ts` 그대로 재사용(이미 구현·검증됨, §5.2). rate-limit도 기존 `lib/rate-limit.ts` 재사용, user_id 기반으로 전환만 하면 됨 |
| GET | `/api/learning/code` | ✓ | 저장한 코드 목록 (마이페이지) |
| POST | `/api/learning/code` | ✓ | `{exampleId, code}` → 저장 (컴파일 검증 통과 후에만 허용 — 클라이언트 검증과 별개로 서버도 최소 문법 체크 권장) |
| GET | `/api/learning/wishlist` | ✓ | **Could 항목** — 찜한 키트 목록. 협상 결과 제외되면 이 엔드포인트 전체 제거하고 클라이언트 로컬 상태로 대체 |
| POST/DELETE | `/api/learning/wishlist/:kitId` | ✓ | 찜 추가/제거 (Could) |
| POST | `/api/learning/quiz/submit` | ✓ | `{exampleId, answer}` → 정답 여부 반환 |

---

## 6. `moderation` 도메인

MVP 범위(§ MVP문서 3항목표: "관리자 검수 — Should, 비-UI 가능")에 따라 **전용 API를 만들지 않고 Supabase 대시보드 등에서 DB를 직접 조작**하는 것으로 충분합니다. 콘텐츠 개수가 늘어나 Phase 6 이후 전용 관리자 화면이 필요해지면 이 섹션에 엔드포인트를 추가합니다.

---

## 7. `notifications` 도메인 (2026-08-20 구현)

| Method | Path | 인증 | 설명 |
|---|---|---|---|
| GET | `/api/notifications` | ✓ | 내 알림 목록 |
| PATCH | `/api/notifications/:id/read` | ✓ | 읽음 처리 (본인 알림만) |

내부적으로 다른 도메인(billing/family)이 `lib/notifications/notify.ts`의 `notifyGuardian()`을 직접
호출하면 이 도메인이 `notifications` row를 만들고 이메일(Resend)로도 발송을 시도합니다. 이 저장소엔
실제 이벤트 버스가 없어서(§5.5가 허용하는 대로) 지금은 순수 함수 호출로 연결돼 있습니다 — 나중에
큐/이벤트 인프라가 생기면 `notifyGuardian()` 내부만 바꾸면 되도록 설계함.

**실제 연결된 트리거**: 결제 성공(`payment_success`), 결제 활성화 실패(`payment_activation_failed`),
결제 실패(`payment_failed`, `webhook/portone`의 `Transaction.Failed` 처리), 구독 해지
(`subscription_canceled`), Family 멤버 추가/제거(`family_member_added`/`family_member_removed`).
전부 guardian에게만 간다(아동 계정은 수신자가 되지 않음). 채널은 지금 전부 email — guardian
연락처(휴대폰)가 DB에 없어서 SMS는 보류(DB_Schema.md §5 참고).

**아직 없음**: 구독 만료 임박 알림(cron 인프라 필요), 콘텐츠 검수 알림(실질적 수신자 없음), 알림
on/off 설정 API, 인앱 알림함 UI 페이지.

---

## 8. `commerce-integration` 도메인

| Method | Path | 인증 | 설명 |
|---|---|---|---|
| POST | `/api/commerce/cart/add` | ✓ | §4-B 딥링크 스펙 그대로 구현. `{sku, qty, ref}` → 쇼핑몰 장바구니 URL 반환. 실패 시 `{fallbackUrl}`만 반환(§4-A 방식 B 폴백) |

---

## 9. 이 문서에서 아직 정의하지 않은 것

- 실제 요청/응답의 정확한 필드 타입(TypeScript interface 수준) — DB 스키마 문서와 함께 다음 단계에서 작성
- 에러 코드 전체 목록
- Rate limit 세부 수치(현재 AI튜터만 하루 10회로 확정, 나머지 엔드포인트는 미정)
