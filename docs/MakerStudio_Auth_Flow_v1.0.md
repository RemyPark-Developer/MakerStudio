# MakerStudio 인증/인가 상세 플로우 (MVP 범위)

**버전**: v1.2 · **작성일**: 2026-08-13 · **최종 수정**: 2026-08-22(§2.1/2.2 소셜 로그인 실제 구현 반영 — 구글, `signInWithOAuth` 리다이렉트 방식)
**짝 파일**: `MakerStudio_API_Spec_v1.0.md` · `MakerStudio_DB_Schema_v1.0.md`

## 0. 이 문서의 목적

API 명세서의 `identity` 엔드포인트들이 **정확히 어떤 순서로, 누가 무엇을 확인하며** 호출되는지 정의합니다. 특히 §3.2(만 14세 미만 법정대리인 동의)와 §3.2(미성년자 결제 금지) 같은 **법적으로 반드시 서버가 재확인해야 하는 지점**을 명시합니다.

---

## 1. 인증 방식 개요

| 방식 | 대상 | MVP 포함 여부 |
|---|---|---|
| 소셜 로그인 (카카오·구글) | 중고등/성인 | Should |
| 이메일/비밀번호 | 전체 | Should |
| 초등학생 개인가입 (보호자 SMS 인증) | 초등학생 | **Must** |
| 학급코드 로그인 | 초등학생(교사 경유) | **Won't** (Phase 4) |

세션은 Supabase Auth의 JWT(액세스 토큰 1시간 + 리프레시 토큰)를 그대로 사용합니다 — 별도 세션 저장소를 직접 구현하지 않습니다(§5.2 스택 선택 이유와 일관).

---

## 2. 시나리오별 상세 흐름

### 2.1 소셜 로그인 — 최초 가입 (닉네임 온보딩 포함)

**실제 구현(2026-08-22, 구글 우선)**: 브라우저가 우리 서버를 거치지 않고 Supabase와 직접
통신한다 — 커스텀 `POST /api/identity/signup/social` 엔드포인트는 만들지 않았다(카카오는
Supabase가 토큰 방식을 지원하지 않아 리다이렉트 방식으로 카카오·구글을 통일해야 했음,
`API_Spec_v1.0.md` §2 참고).

1. 클라이언트: "Google로 시작하기" 클릭 (`app/SocialLoginButtons.tsx`)
2. 브라우저 → `lib/supabase/browser.ts`의 `supabase.auth.signInWithOAuth({provider:'google',
   options:{redirectTo:'/auth/callback'}})` 호출 → 구글 OAuth 동의 화면으로 리다이렉트
3. 사용자가 구글에서 동의 → 구글이 인가 코드와 함께 `/auth/callback`(우리 앱)으로 리다이렉트
4. `/auth/callback`(`app/auth/callback/page.tsx`) 마운트 → Supabase JS SDK가 URL의 인가
   코드를 자동으로 Supabase와 교환(PKCE) → `auth.users`에 신규 행 생성, 세션 발급
5. 콜백 페이지: 그 세션의 `access_token`/`refresh_token`을 우리 자체 인증 체계
   (`ms_access_token`/`ms_refresh_token`, `lib/client-auth.ts`가 읽는 localStorage 키)로
   그대로 옮겨 저장 — 이후 화면은 전부 기존 `authedFetch` 그대로 재사용
6. 콜백 페이지 → `GET /api/identity/me` 호출 → 서버가 `profiles.nickname` 존재 여부로 신규
   여부 판단(`needsNickname`)
7. `needsNickname: true` → 콜백 페이지가 인라인 닉네임 입력 폼을 보여줌
8. 사용자가 닉네임 입력 후 제출 → 콜백 페이지 → `PATCH /api/identity/me {nickname, role:
   'student_teen'}`
9. 서버: `profiles` 갱신, `role`을 `student_teen`으로 확정(§3.3 — 소셜 로그인은 만 14세
   이상으로 간주, 신규 사용자일 때만 role 반영 — 기존 사용자의 role은 이 경로로 못 바꿈)
10. 클라이언트 → `/mypage`로 이동

**범위**: 카카오는 대표님이 Supabase 대시보드에 Kakao 프로바이더(Client ID/Secret)를
등록하면 `SocialLoginButtons`에 버튼 한 줄만 추가하면 됨 — 코드 구조는 이미 provider를
받는 형태로 준비돼 있음.

### 2.2 소셜 로그인 — 재방문 (기존 사용자)

1~6. 위와 동일
7. `needsNickname: false` → 콜백 페이지가 온보딩 없이 바로 `/mypage`로 이동

### 2.3 초등학생 개인가입 (보호자 SMS 인증) — §3.2 핵심 흐름

1. 클라이언트: 회원가입 → "초등학생" 선택 → 닉네임 + 보호자 휴대폰번호 입력
2. 클라이언트 → `POST /api/identity/signup/child {nickname, guardianPhone}`
3. 서버: 임시 `verifyToken` 발급(TTL 10분), SMS 발송 서비스(예: 알리고·NHN 등)로 6자리 코드 전송
4. 서버 → 클라이언트: `{verifyToken}` 반환 (SMS 코드 자체는 절대 응답에 포함하지 않음)
5. 클라이언트: 6자리 코드 입력 화면
6. 클라이언트 → `POST /api/identity/signup/child/verify {verifyToken, smsCode, agreeChildPrivacy: true}`
7. **서버(필수 검증 지점)**:
   - `smsCode`가 실제 발송한 코드와 일치하는지 확인 (일치 안 하면 `401`)
   - `agreeChildPrivacy`가 `true`인지 확인 (클라이언트가 보낸 값을 그냥 믿지 않고, 이 값이 없거나 `false`면 **무조건 `403`** — §3.2 법적 요건)
   - 위 두 조건을 모두 통과해야만 다음 단계 진행
8. 서버: `auth.users` 생성(비밀번호 없이, 또는 임시 비밀번호), `profiles` 생성(`role: 'student_child'`), `guardian_child_links` 생성 — `consent_verified_at`에 현재 시각 기록, `consent_method: 'sms'`
9. 서버 → 클라이언트: JWT 발급, 가입 완료

**감사 로그**: 7번 단계의 성공/실패를 반드시 로그로 남깁니다 — 나중에 아동 개인정보 처리에 대한 법적 소명이 필요할 때 "언제, 어떻게 동의를 확인했는지" 증빙 자료가 됩니다.

### 2.4 이메일/비밀번호 로그인

1. 클라이언트 → `POST /api/identity/login {email, password}`
2. Supabase Auth가 비밀번호 검증 (해시 비교는 Supabase가 처리, 직접 구현하지 않음)
3. 성공 시 JWT 발급, 실패 시 `401` (이메일 존재 여부는 노출하지 않는 동일한 에러 메시지 사용 — 계정 탐색 공격 방지)

### 2.5 비밀번호 재설정

1. 클라이언트 → `POST /api/identity/password/forgot {email}`
2. 서버: 가입된 이메일이면 재설정 토큰 발급 + 메일 발송, **가입 안 된 이메일이어도 동일하게 200 응답** (이메일 존재 여부 노출 방지 — 프로토타입 화면과 별개로 API 레벨에서 지켜야 할 보안 규칙)
3. 사용자가 메일의 링크 클릭 → 새 비밀번호 입력 화면
4. 클라이언트 → `POST /api/identity/password/reset {resetToken, newPassword}`
5. 서버: 토큰 유효성(만료 30분, 미사용) 확인 후 비밀번호 변경, 토큰 즉시 폐기

### 2.6 로그아웃

1. 클라이언트 → `POST /api/identity/logout`
2. 서버: Supabase Auth 세션 무효화 (리프레시 토큰 폐기)
3. 클라이언트: 로컬에 저장된 토큰 삭제, 랜딩 페이지로 이동

### 2.7 계정 삭제 — §4.5 원칙의 실제 흐름

1. 클라이언트(보호자 대시보드) → `POST /api/billing/refund/calculate` → 환불 예정액 확인 화면 표시
2. 사용자가 "삭제" 입력 후 확정
3. 클라이언트 → `DELETE /api/identity/me {childId}`
4. **서버**:
   - 호출자가 `role: guardian`이고 해당 `childId`와 `guardian_child_links`로 연결되어 있는지 확인
   - `subscriptions` 상태를 `canceled`로 변경
   - `payments` 테이블은 **삭제하지 않음** (§4.5 법적 보존)
   - `profiles.deleted_at`에 현재 시각 기록 (소프트 삭제)
   - 환불 프로세스는 **별도 비동기 작업**으로 큐에 등록 (결제 삭제와 동기적으로 묶지 않음 — PG사 API 실패가 계정 삭제 자체를 막지 않도록)
5. 서버 → 클라이언트: 삭제 접수 완료 + 환불 처리 예정 안내

---

## 3. 인가(권한) — 이중 방어 구조

§3.2("학생 화면엔 결제 버튼 자체가 없음")는 **UI에서만 지키면 안 됩니다.** 실제로는 두 층에서 동시에 강제합니다.

| 계층 | 강제 방법 | 예시 |
|---|---|---|
| **API 미들웨어** | 각 라우트 핸들러 진입 시 `role` 체크 | `POST /api/billing/checkout`은 `role !== 'guardian'`이면 `403` |
| **DB — Row Level Security(RLS)** | Supabase RLS 정책으로 테이블 단위 강제 | `student_child` 역할의 JWT로는 `subscriptions`, `payments` 테이블 `SELECT`/`INSERT` 자체가 불가능하도록 정책 설정 |

**두 층을 다 두는 이유**: API 미들웨어만 있으면 개발자의 실수(체크 로직 누락)로 뚫릴 수 있습니다. RLS까지 있으면 API 코드에 버그가 있어도 DB 자체가 막아줍니다 — 아동 결제 방지처럼 절대 뚫리면 안 되는 규칙은 반드시 이중으로 겁니다.

**2026-08-21 실제 구현 완료 및 구현 중 발견한 사실**: 이 문서가 설명하는 이중 방어 중 RLS 레이어는 작성 시점(2026-08-13)엔 설계만 있고 실제 DB엔 없었습니다 — `payments`/`subscriptions`/`notifications`/`family_groups`/`family_group_members`/`learning_progress`/`quiz_attempts`/`tutor_messages`/`content_review_messages` 전 테이블에 실제로 RLS를 붙이고 실증 검증까지 마쳤습니다(`supabase/migrations/0022`~`0025`). 구현 중, **RLS 정책만으로는 충분하지 않다는 것**도 실DB 테스트로 드러났습니다 — 이 Supabase 프로젝트는 `anon`/`authenticated` 롤에 대한 기본 테이블 GRANT 자체가 없어서(SQL Editor로 테이블을 직접 만들어온 것이 원인), RLS 정책만 있으면 `student_child`뿐 아니라 **guardian 본인조차** `42501 permission denied`로 막힙니다. 그래서 실제 구현은 "정책 + `grant select(...) on ... to authenticated`"를 항상 세트로 둡니다 — 새 테이블에 이중 방어를 적용할 때 이 패턴을 그대로 따르세요(상세: `CLAUDE.md`, `docs/MakerStudio_Session_2026-08-21_Summary_v1.2.md` §1~3).

### 역할별 접근 매트릭스 (요약)

| 리소스 | student_teen | student_child | guardian | admin |
|---|---|---|---|---|
| 자기 진도/코드/위시리스트 | R/W | R/W | - | - |
| `billing/*` | ✕ | **✕ (절대 불가)** | R/W | R |
| `identity/me` (본인) | R/W | R/W | R/W | R |
| 자녀 진도 열람 (보호자 대시보드) | - | - | R (연결된 자녀만) | - |
| `examples` (Premium 필드) | 구독 상태에 따라 | 구독 상태에 따라 | - | R/W |

---

## 4. 보안 체크리스트 (구현 시 반드시 확인)

- [ ] `signup/child/verify`에서 클라이언트가 보낸 동의값을 서버가 재검증하는가 (§2.3-7)
- [ ] `billing/checkout`이 `role=student_child` 토큰으로 호출되면 `403`을 반환하는가
- [x] RLS 정책이 `subscriptions`/`payments` 테이블에 적용되어 있는가 (2026-08-21 구현·실증 완료, `0022`~`0023`) — **정책만으로는 안 됨, `authenticated`에 대한 GRANT도 같이 확인할 것**(위 §3 2026-08-21 항목 참고)
- [ ] 비밀번호 재설정/로그인 실패 응답이 "이메일 존재 여부"를 노출하지 않는가
- [ ] 계정 삭제 시 `payments` 레코드가 삭제되지 않고 보존되는가 (§4.5)
- [ ] 아동 동의 확인 로그가 감사 가능한 형태로 남는가
