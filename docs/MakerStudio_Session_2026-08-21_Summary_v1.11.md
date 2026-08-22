# 2026-08-21 세션 요약 — 설계 판단과 구현 범위

**버전**: v1.11 · **최종 수정**: 2026-08-21 · **짝 파일**: `MakerStudio_Auth_Flow_v1.2.md`, `MakerStudio_Session_2026-08-20_Summary_v1.1.md`

### 개정 이력
| 버전 | 날짜 | 주요 변경 |
|---|---|---|
| v1.11 | 2026-08-21 | 관리자 대시보드(매출·요금제별 고객수/이탈률) 신설 이어붙임 — 집계 뷰 3개(`0033`) + `app/admin/dashboard`, 실DB 수기 계산 대조 검증까지 완료 |
| v1.10 | 2026-08-21 | §6.3-a "이미 학습 중이던 사용자" 버전 고정 정책 확정·구현 이어붙임 — 인용만 되고 실체가 없던 설계 문서 섹션을 채우고, `content_modules`에 슬러그/버전 분리 + "개선판 만들기" 관리자 플로우 신설 |
| v1.9 | 2026-08-21 | 회사 귀책(중복결제·시스템오류) 전액환불 이어붙임 — 2026-08-20에 의도적으로 범위 제외했던 항목을 착수, `refund/calculate` 확장 |
| v1.8 | 2026-08-21 | ⚠️ Supabase 싱글턴 세션오염 버그 발견·수정 이어붙임 — RGB LED UI 확인 중 우연히 발견한, 이 세션의 RLS 작업과 무관한 심각한 기존 버그 |
| v1.7 | 2026-08-21 | `content_modules.is_premium` 추가 + 관리자 유료 설정 + RLS 동시 수정(0030) 이어붙임 — 2026-08-20에 보류했던 항목을 실제 요구사항이 생겨 완료 |
| v1.6 | 2026-08-21 | `/mypage/billing` 실브라우저 UI 확인 이어붙임 — API 레벨 검증을 넘어 실제 화면 렌더링까지 확인 |
| v1.5 | 2026-08-21 | 남은 4개 테이블(`examples`/`password_reset_tokens`/`tutor_usage`/`wishlist_items`) 확인으로 실DB 19개 테이블 전수 완료 — 새 마이그레이션 없음(전부 정상 상태였음) |
| v1.4 | 2026-08-21 | `content_modules` GRANT 보완(0029) 이어붙임 — content 도메인 테이블까지 전수 확인 마무리 |
| v1.3 | 2026-08-21 | `pg_policies` 진단 RPC(0026) + `profiles`/`progress`/`saved_codes` 정책 드리프트 백필(0027) + `guardian_child_links` 정책 누락 버그 수정(0028) 이어붙임 |
| v1.2 | 2026-08-21 | `learning_progress`/`quiz_attempts`/`tutor_messages`/`content_review_messages` GRANT 보완(0025) 이어붙임 — 남은 3곳 전부 한 번에 마무리, RLS GRANT 이슈 완전 종결 |
| v1.1 | 2026-08-21 | `family_groups`/`family_group_members` GRANT 보완(0024) 이어붙임 — 대표님이 "이번 기회에 마저 고치자"고 해서 같은 날 추가 진행 |
| v1.0 | 2026-08-21 | 최초 작성 — `payments`/`subscriptions`/`notifications` RLS 구현 1건 |

이 문서는 커밋으로만 남아있는 하루치 작업의 "왜"를 한 곳에 모은 기록이다. 전날(2026-08-20)
작업은 `MakerStudio_Session_2026-08-20_Summary_v1.1.md`에 있음 — 날짜가 바뀌어서 이어붙이지
않고 새 파일로 만듦(그 문서 §개요 아래 안내된 컨벤션 그대로).

## 개요

| 순서 | 작업 | 커밋 | 마이그레이션 |
|---|---|---|---|
| 1 | `payments`/`subscriptions`/`notifications` RLS 구현 | `8c9d32f` | `0022`, `0023` |
| 2 | `family_groups`/`family_group_members` GRANT 보완 | `247fb23` | `0024` |
| 3 | 남은 4개 테이블 GRANT 보완 | `81d495d` | `0025` |
| 4 | `pg_policies` 진단 RPC + 정책 드리프트 발견·수정 | `47636bc` | `0026`, `0027`, `0028` |
| 5 | `content_modules`/`content_generation_log` GRANT 확인 | `3cbd5cd` | `0029` |
| 6 | 남은 4개 테이블 확인 — 실DB 19개 테이블 전수 완료 | (문서만) | 없음 |
| 7 | `/mypage/billing` 실브라우저 UI 확인 | (문서만) | 없음 |
| 8 | `content_modules.is_premium` 추가 + 관리자 유료 설정 + RLS 동시 수정 | `5807660` | `0030` |
| 9 | ⚠️ Supabase 싱글턴 세션오염 버그 발견·수정 | `fdc4622` | 없음(코드만) |
| 10 | 회사 귀책 전액환불 (`payments.refund_reason`) | `f2c70f4` | `0031` |
| 11 | §6.3-a 콘텐츠 버전 고정 정책 (`content_modules.slug`) | `5390c3d` | `0032` |
| 12 | 관리자 대시보드 (매출·요금제별 고객수/이탈률) | `3ed549e` | `0033` |

---

## 1. `payments`/`subscriptions`/`notifications` RLS 구현

**커밋**: `8c9d32f`(0022, 0023)

### 배경

`docs/MakerStudio_Auth_Flow_v1.2.md` §3은 `billing/*`가 "API 미들웨어 + RLS(Row Level
Security) 이중 방어"로 막혀 있다고 명시하지만, 2026-08-20 점검(→
[[project-rls-gap-billing-tables]])에서 실제로는 `payments`/`subscriptions`/`notifications`/
`family_groups`/`family_group_members` 전부 RLS가 없고 API 레이어(`requireGuardian` 등)만
있다는 게 드러났었음. 대표님이 "RLS를 실제로 구현하는 방향이 맞다"고 결정했고, 오늘 실제
구현을 진행함.

### 핵심 설계 판단

- **범위를 3개로 좁힘**: 조사 중 `family_groups`/`family_group_members`는 `0014_family_groups.sql`에
  이미 RLS(owner-only select)가 있다는 걸 확인 — 대표님 지시로 이번 범위에서 제외하고
  `payments`/`subscriptions`/`notifications`만 진행.
- **정책 설계는 기존 컨벤션(`0008`, `0013`, `0014`)을 그대로 재사용**: guardian은 본인 것만
  select, admin은 `profiles.role='admin'` 서브쿼리로 전체 select, 쓰기(insert/update/delete)
  정책은 만들지 않음 — 모든 실제 쓰기가 이미 `service_role`(checkout/verify, webhook,
  `activateSubscription`, `notifyGuardian`)로만 이뤄지고 있어서(브라우저용 Supabase 클라이언트가
  이 저장소에 전혀 없음을 grep으로 재확인), 정책을 안 만들면 나중에 실수로 anon/authenticated
  키가 노출돼도 쓰기가 막힘. notifications의 "읽음 처리"만 예외로 본인 update 허용.
- **실DB 조사 중 예상 밖 발견 — `anon`/`authenticated`에 대한 기본 GRANT 자체가 프로젝트 전체에
  없음**: 임시 계정을 만들어 실제 JWT로 직접 쿼리해보니, RLS 정책이 이미 있는 기존 테이블
  (`learning_progress`, `tutor_messages`, `family_groups`)조차 `authenticated` 역할로 접근하면
  전부 `42501 permission denied`가 났음(정책이 아니라 그보다 앞선 GRANT 레벨에서 막힘). 이
  프로젝트가 "Automatically expose new tables"를 끈 채 SQL Editor로 테이블을 만들어와서
  (`0004_grant_service_role.sql`과 같은 근본 원인) 벌어진 일 — 지금까지는 서버가 항상
  `service_role`만 써서 무해했지만, RLS 정책만 추가하면 **guardian 본인조차** 막히는 상황이었음.
  그래서 `0022`에 정책과 함께 `grant select(, update) on ... to authenticated`를 명시적으로
  추가함(→ [[project-rls-missing-grants-other-tables]], 다른 테이블에도 같은 잠재 문제 기록).
- **연쇄 버그 하나 더 발견·수정(0023)**: `payments_guardian_select` 정책이 Family 결제 판단을
  위해 `family_groups`를 서브쿼리로 참조하는데, `family_groups`엔 (0014가 RLS+정책은 만들었지만)
  GRANT가 없어서 이 서브쿼리 평가 자체가 42501로 실패 — guardian 본인 payments 조회까지 통째로
  깨졌음. `family_groups`의 기존 정책(owner-only select)은 그대로 두고 GRANT만 추가하는 별도
  마이그레이션(`0023`)으로 해결 — family_groups의 정책 자체를 건드리지 않아 이번 범위(3개 테이블)
  를 벗어나지 않음.

### 검증 방법 — 전부 실제 임시 계정 + 실제 JWT로 실증(코드/문서 추론이 아니라 실제 DB 호출)

1. **적용 전**: anon key로 5개 테이블 미인증 접근 시도, 실제 `authenticated` JWT로도 접근 시도
   → 전부 `42501`(위 GRANT 부재 발견의 근거).
2. **정책 설계안을 대표님께 먼저 제시하고 승인받은 뒤에만 SQL을 실행** — 결제/보안 관련 변경이라
   대표님이 명시적으로 요구한 절차. 대표님이 Supabase SQL Editor에서 직접 실행(이 세션은 원격
   DDL 실행 수단이 없음을 확인 — psql/exec_sql RPC 모두 없고, PostgREST가 `pg_policies`를
   노출하지 않음).
3. **적용 후**: guardian/다른 guardian/student_child/admin 4개 임시 계정을 만들어 실제 로그인
   → JWT 획득 → 직접 쿼리:
   - guardian 본인 토큰 → 본인 subscriptions/payments/notifications만 보임(1건), 다른 guardian
     것은 0건
   - student_child 토큰 → subscriptions/payments SELECT는 항상 0건(쿼리 자체는 거부 안 되지만
     RLS가 모든 행을 필터링), INSERT는 42501로 하드 차단
   - admin 토큰 → 전체 SELECT 가능
   - guardian 본인 notification 읽음 처리(update) 정상
   - 테스트 계정·데이터는 검증 직후 전부 삭제
4. **회귀 테스트**: `npm test` 53개 전부 통과. 실제 dev server를 띄워 guardian JWT로
   `/api/billing/history`, `/api/notifications`, `/api/notifications/[id]/read`,
   `/api/identity/me`를 호출 — 전부 RLS 적용 전과 동일하게 200(서버가 `service_role`로만
   접근해 RLS 영향 없음, 회귀 없음 확인). `/api/billing/history`를 student_child JWT로 호출하면
   여전히 403(API 레이어, 이번 변경과 무관하게 원래 있던 방어) — 이중 방어의 두 레이어가 각자
   독립적으로 작동함을 확인.

### 의도적으로 제외한 것

- `family_groups`/`family_group_members`에 새 정책 추가 — 이미 0014에 있어 불필요(대표님 확인).
- 다른 테이블(`learning_progress`, `tutor_messages`, `content_review_messages`)의 GRANT 누락
  보완 — 지금 당장 무해하고 대표님이 요청 안 함, 발견 사실만 메모리에 기록(→
  [[project-rls-missing-grants-other-tables]]).

(상세: [[project-rls-gap-billing-tables]])

---

## 2. `family_groups`/`family_group_members` GRANT 보완

**커밋**: `247fb23`(0024)

### 배경

1번 항목 작업 중 `family_groups`도 같은 GRANT 부재 문제로 (0023에서) 고쳤던 걸 계기로,
대표님이 "이번 기회에 `family_groups`도 GRANT 보완할까"라고 먼저 제안. 확인해보니
`family_groups`는 이미 0023에서 해결돼 있었고, `family_group_members`만 아직 GRANT가
없는 상태였음(0014에 RLS+정책은 있지만).

### 핵심 설계 판단

- `family_group_members_owner_select` 정책(0014)은 그대로 두고 `grant select on
  public.family_group_members to authenticated;` 한 줄만 추가 — 새 정책을 만드는 게
  아니라 이미 있던 정책이 실제로 작동하게 만드는 것.

### 검증 방법

- owner/다른 guardian/student_child 3개 임시 계정 생성 → 실제 `family_group_members` row
  하나 만들고(guardian 소유 family_group + 자녀 1명) 각 토큰으로 조회:
  - owner 본인 토큰 → 1건 (본인 그룹 멤버)
  - 다른 guardian 토큰 → 0건
  - student_child 토큰 → 0건 (이 테이블엔 애초에 child용 정책이 없음)
  - `family_groups` 자체도 재확인 → 1건(0023 GRANT가 여전히 정상 동작)
- 테스트 계정·데이터는 검증 직후 전부 삭제.

### 의도적으로 제외한 것

- `learning_progress`/`tutor_messages`/`content_review_messages`의 같은 문제 — 대표님이
  이번엔 `family_groups` 계열만 지목함, 나머지는 여전히 무해한 채로 보류(→
  [[project-rls-missing-grants-other-tables]]).

(상세: [[project-rls-missing-grants-other-tables]])

---

## 3. 남은 4개 테이블 GRANT 보완 — RLS GRANT 이슈 완전 종결

**커밋**: `81d495d`(0025)

### 배경

2번 항목을 마치고 대표님이 "`learning_progress`도 GRANT 보완할까"라고 다시 제안. 확인
결과 `learning_progress`는 같은 마이그레이션(0008)의 `quiz_attempts`와 항상 같이
움직이는 게 맞다고 판단해 범위를 물었고, 대표님이 "남은 3곳(4개 테이블) 전부"를 선택 —
`learning_progress`, `quiz_attempts`(0008), `tutor_messages`(0012),
`content_review_messages`(0013).

### 핵심 설계 판단

- 전부 기존 정책은 그대로 두고 GRANT만 추가. `learning_progress`는 select/insert/update
  정책이 다 있어 그 셋을 GRANT, `quiz_attempts`는 select/insert만(append-only 설계),
  `tutor_messages`/`content_review_messages`는 select만(insert는 의도적으로 서버
  전용으로 남김).
- `content_review_messages`는 admin 전용 정책(`profiles.role='admin'` 체크)이지만,
  Postgres GRANT는 role 단위지 "행 단위 조건"을 못 건다 — GRANT는 `authenticated`
  전체에 주고, admin만 실제로 보이게 하는 건 기존 정책이 그대로 담당(0022의
  `subscriptions_admin_select`와 동일 구조).

### 검증 방법

- student_teen(본인)/다른 student_teen/admin 3개 임시 계정 생성, 4개 테이블에 각각
  row 하나씩 만들고 실제 JWT로 조회:
  - `learning_progress`: 본인 select/update/insert 전부 정상, 다른 사용자는 0건
  - `quiz_attempts`: 본인 select 정상, 다른 사용자는 0건
  - `tutor_messages`: 본인 select 정상, 다른 사용자는 0건, **본인 insert는 42501로
    차단**(insert GRANT를 의도적으로 안 줬으므로 정상 — 서버만 insert)
  - `content_review_messages`: admin select 정상, 일반 사용자(student_teen)는 0건
- 테스트 계정·데이터는 검증 직후 전부 삭제.

### 의도적으로 제외한 것

- 없음 — 이 메모리에 남아있던 GRANT 누락 항목을 전부 처리해서, 이 프로젝트에서 RLS가
  걸린 테이블 중 GRANT가 안 맞는 곳이 더 이상 없음.

(상세: [[project-rls-missing-grants-other-tables]])

---

## 4. `pg_policies` 진단 RPC + 정책 드리프트 발견·수정

**커밋**: `47636bc`(0026, 0027, 0028)

### 배경

대표님이 "`pg_policies`도 실DB에서 재확인해줘"라고 요청. PostgREST는 `pg_catalog`를
REST로 노출하지 않아 지금까지는 정책 존재 여부를 간접 실증(동작 테스트)으로만
확인해왔음 — 직접 조회할 수단이 없었음.

### 핵심 설계 판단

- **service_role 전용 진단 RPC 신설(0026)**: `public.debug_list_policies()`가
  `pg_policies`(schemaname='public')를 그대로 반환. `public`/`anon`/`authenticated`엔
  실행 권한을 안 줌. 처음엔 "확인 후 바로 DROP(일회성)"으로 정했다가, 대표님이 마이그레이션
  파일로 남겨달라고 요청 → 실DB에도 영구 보관하기로 재결정(다음 세션에서도 재사용
  가능하도록).
- **실행 결과로 예상 밖 드리프트 발견**: `profiles`/`progress`/`saved_codes`에 이
  저장소 마이그레이션 파일 어디에도 없는 RLS 정책이 이미 실DB에 있었음(정책명 스타일이
  영문·대문자 시작으로 이 프로젝트의 다른 정책들과 달라 Supabase 대시보드 "Enable RLS"
  마법사로 만들어진 것으로 추정). 이 3개 테이블만 유일하게 `authenticated` GRANT도
  이미 있었음 — 대시보드 마법사가 GRANT까지 자동 처리하기 때문으로 보임.
- **`0027`로 백필**: 이미 실DB에 있던 상태를 마이그레이션 이력에 반영(idempotent —
  실행해도 실DB엔 변화 없음). 목적은 새 Supabase 프로젝트에 0001부터 순서대로
  적용해도 지금과 같은 상태가 재현되도록 하는 것.
- **대표님이 "admin 서브쿼리 충돌 확인했는지" 되물어서 발견한 진짜 버그**: `profiles`의
  "Guardians can view linked children profiles" 정책이 서브쿼리로 참조하는
  `guardian_child_links`에 RLS는 켜져 있는데 정책이 하나도 없어서, 실제 연결 row를
  만들어놔도 guardian 토큰으론 항상 0건이 나왔음 — 이 정책이 대시보드에서 만들어진
  이후 **한 번도 정상 동작한 적이 없었던 것**. `payments`↔`family_groups`(0023)에서
  이미 봤던 "서브쿼리가 참조하는 테이블의 RLS도 그대로 적용된다" 메커니즘과 동일.
  `0028`로 `guardian_child_links`에 `guardian_id = auth.uid()` select 정책 추가해서 해결.

### 검증 방법

- `debug_list_policies()` RPC를 실제 호출해 전체 정책 목록 확보, 0022~0025에서 만든
  정책들이 그대로 있는지 재확인.
- `profiles`/`progress`/`saved_codes` 본인 토큰 select 정상, 다른 사람 것 0건, insert/update는
  여전히 42501 차단(정책이 select만 있으므로) — 실증 확인.
- `guardian_child_links` 수정 전/후 비교: 수정 전엔 실제 연결 row가 있어도 guardian
  토큰으로 자녀 profile 0건 → 수정 후 1건(정확한 자녀 데이터), 연결 안 된 사람은
  여전히 0건.
- admin 서브쿼리(`subscriptions_admin_select` 등)가 `profiles`의 기존 RLS와 충돌하지
  않는 이유도 확인: admin이 자기 자신의 role을 확인하는 서브쿼리라 `profiles`의
  "Users can view own profile"(`auth.uid() = id`) 정책이 정확히 허용하는 범위와
  일치 — 0022 검증 때 admin 토큰으로 subscriptions/payments가 정상 조회됐던 것 자체가
  이미 이 경로를 실증한 것이었음(당시엔 profiles에 RLS가 있는 줄 몰랐을 뿐).

### 의도적으로 제외한 것

- 없음.

(상세: [[project-rls-policy-drift-profiles-guardian-links]])

---

## 5. `content_modules`/`content_generation_log` GRANT 확인

**커밋**: `3cbd5cd`(0029)

### 배경

대표님이 content 도메인의 남은 두 테이블(`content_generation_log`, `content_modules`)도
마저 확인해달라고 요청 — RLS/GRANT 전수 확인의 마지막 두 곳.

### 핵심 설계 판단

- **`content_generation_log`는 손대지 않음** — RLS도 정책도 원래 없고(관리자 전용 내부
  진단 로그, 클라이언트 접근을 애초에 의도한 적이 없음), 지금까지 고쳐온 다른 테이블들과
  달리 "정책은 있는데 GRANT가 없어서 막힌" 케이스가 아니라 "애초에 의도된 접근 경로 자체가
  없는" 케이스 — 지금 상태(service_role 전용)가 정답.
- **`content_modules`는 GRANT 보완**: `content_modules_public_read_published`
  정책(0010)이 `status='published'`만 select 허용하는데 GRANT가 없어 막혀 있었음. 정책
  주석이 명시한 "나중에 클라이언트 직접 조회 대비"라는 원래 설계 의도대로 `anon`+
  `authenticated` 둘 다 GRANT.
- **⚠️ 절대 원칙 2번(Premium 콘텐츠 SSG 금지) 관련 위험을 사전에 짚고 진행**: 지금은
  `content_modules`에 `is_premium` 컬럼이 없어 안전하지만([[project-content-modules-premium-deferred]]),
  나중에 그 컬럼이 추가되면서 이 RLS 정책(published 여부만 확인, premium 여부는 확인
  안 함)을 같이 안 고치면 PostgREST 직접 접근으로 `code`/`explain`이 anon에게 그대로
  노출되는 우회경로가 생김 — 대표님께 먼저 이 위험을 설명하고 승인받은 뒤 진행.

### 검증 방법

- anon key로 `content_modules` published 행 조회 → 정상 반환.
- service_role로 `status: 'draft'` 테스트 행을 임시로 만들고 anon으로 조회 → **0건**(RLS가
  정확히 필터링). `status=neq.published` 필터로도 0건 확인. 테스트 행은 즉시 삭제.

### 의도적으로 제외한 것

- `content_generation_log` GRANT 추가 — 원래부터 클라이언트 접근이 의도되지 않은
  테이블이라 불필요.

(상세: [[project-rls-missing-grants-other-tables]] §추가 2, [[project-content-modules-premium-deferred]])

---

## 6. 남은 4개 테이블 확인 — 실DB 19개 테이블 전수 완료

**커밋**: 없음(코드/마이그레이션 변경 없음, 이 문서와 메모리만 갱신)

### 배경

대표님이 "나머지 테이블들도 다 확인한 거 맞지?"라고 재확인 요청. 그때까지 5번 항목까지
14개 테이블을 다뤘는데, 실DB 전체 19개 중 `examples`/`password_reset_tokens`/
`tutor_usage`/`wishlist_items` 4개를 아직 명시적으로 확인 안 한 상태였음.

### 검증 방법

- anon key + 실제 authenticated JWT 양쪽으로 4개 테이블 전부 직접 조회 시도 → **전부
  42501**(GRANT 없음).
- `debug_list_policies()`로 19개 테이블 전체를 한 번에 대조 → 이 4개(+`content_generation_log`)
  는 정책 0건, 나머지 14개는 정책 있음 — 정확히 예상한 대로.

### 핵심 판단

- **4개 다 손댈 필요 없음** — `0001_init.sql` 코멘트를 봐도 client 직접 접근을 의도한
  적이 없는 테이블들(`examples`는 API 레이어 게이팅 전제, `password_reset_tokens`는
  보안 토큰이라 애초에 노출되면 안 됨, `tutor_usage`/`wishlist_items`는 서버 전용
  집계·목록). `content_modules`처럼 "나중에 클라이언트 직접 조회 대비"라는 코멘트가
  없다는 게 결정적 차이.
- **`examples`가 특히 중요**: `is_premium` 필드를 이미 갖고 있어 절대 원칙 2번과 직결되는
  테이블인데, GRANT가 아예 없어 완전히 막혀 있는 것까지 확인 — 지금은 이 경로로 premium
  콘텐츠가 우회 노출될 위험이 없음.

### 결론

**이 프로젝트의 실DB 19개 테이블 전수 확인 완료** — 14개(정책+GRANT 정상화), 5개
(`content_generation_log` 포함, 정책 없음=정상). 더 이상 확인이 필요한 테이블 없음.

(상세: [[project-rls-missing-grants-other-tables]] 최종 결론)

---

## 7. `/mypage/billing` 실브라우저 UI 확인

**커밋**: 없음(코드/마이그레이션 변경 없음, 검증만)

### 배경

지금까지의 검증은 전부 API 레벨(`curl`/`supabase-js` 직접 호출)이었음 — 대표님이
"mypage/billing 같은 실제 UI에서도 한번 눌러서 확인해줘"라고 요청. 이 저장소엔 이걸
위한 프로젝트 전용 skill이 없어서 `run` skill의 범용 패턴(playwright)을 새로 적용함.

### 방법

- `chromium-cli`가 이 환경엔 없어서 `npx playwright install chromium`으로 직접 설치.
- 임시 guardian 계정 + 실제 `subscriptions`/`payments` row를 service_role로 생성(오늘
  써온 패턴과 동일).
- Playwright로 **실제 로그인 폼**(`/login`, `#email`/`#password` 필드, 이 프로젝트는
  세션을 쿠키가 아니라 `localStorage`에 저장 — `app/login/page.tsx` 확인)을 채우고
  제출 → `/mypage`로 정상 리다이렉트 → `/mypage/billing`으로 이동 → 스크린샷 +
  본문 텍스트 + 브라우저 콘솔 에러 수집.

### 결과

- 로그인 정상, `/mypage/billing` 완전히 렌더링: 요금제 목록, 방금 만든 결제 내역(9,900원,
  success) 정확히 표시, 구독 해지 버튼, Family 요금제 카드까지 전부 정상.
- 브라우저 콘솔 에러 없음.
- 이 화면은 여전히 `service_role` 경유 API 라우트를 쓰므로 RLS 영향을 안 받는 게
  맞고, 이번 확인은 "API 레벨 회귀 없음"을 "실제 화면 렌더링 레벨"까지 한 단계 더
  확실히 한 것.

### 의도적으로 제외한 것

- 프로젝트 전용 run skill(`/run-skill-generator`)로 이 절차를 캡처하는 것 — 대표님이
  요청 안 함, 일회성 확인이라 당장은 불필요.

---

## 8. `content_modules.is_premium` 추가 + 관리자 유료 설정 + RLS 동시 수정

**커밋**: `5807660`(0030)

### 배경

2026-08-20에 "지금은 전부 무료 취급, 필요해지면 컬럼 추가"로 보류했던 항목
(→ [[project-content-modules-premium-deferred]])을, RGB LED 색상 제어 강의를 실제로
유료 판매해야 하는 요구사항이 생겨 오늘 완료함. 대표님이 이틀 전 §7.2(Premium 콘텐츠
SSG 금지) 관련 위험을 미리 알고 있었고("RLS 정책 수정 부분은 SQL 먼저 보여주고 승인받은
후 진행"), 실제로 그 경고가 현실화되는 상황이라 승인 절차를 그대로 따름.

### 핵심 설계 판단

- `content_modules.is_premium boolean not null default false` 컬럼 추가.
- `lib/content/publishedModules.ts`의 `mapRowToExample()` — 하드코딩된 `isPremium: false`를
  `row.is_premium`으로 교체.
- `app/admin/content-review/[id]/page.tsx`에 "유료(Premium) 콘텐츠로 설정" 체크박스 추가
  — `app/api/content/[id]/review/route.ts`가 `action==='approve'`일 때만 `is_premium`을
  반영(반려는 무관, 이미 published된 콘텐츠의 유료 여부를 나중에 바꾸려면 다시
  pending_review로 되돌린 뒤 재승인해야 함 — 별도 "유료 여부만 수정" API는 이번 범위
  아님).
- **컬럼 추가와 RLS 정책 수정을 한 마이그레이션에 묶음** — `content_modules_public_read_published`
  정책(0010/0029)이 `status='published'`만 보고 premium 여부를 안 봤던 걸
  `using (status = 'published' and is_premium = false)`로 수정. 컬럼만 먼저 추가하고
  정책 수정을 나중으로 미뤘다면, 그 사이 시간 동안 PostgREST 직접 접근으로 유료
  `code`/`explain`이 anon에게 그대로 노출되는 창이 실제로 열렸을 것.
- `lib/content/gate.ts`는 재확인 결과 수정 불필요 — `example.isPremium` 필드만 보고
  게이팅하는 기존 로직이 `row.is_premium`을 그대로 반영한 `Example` 객체에도 아무
  변경 없이 동작함. 목록 API(`app/api/content/examples/route.ts`)도 애초에 응답
  필드를 화이트리스트로 골라 보내서(`code`/`explain`/`quiz` 자체가 없음) premium
  여부와 무관하게 항상 안전한 것도 확인.

### 검증 방법 — 실제 admin 승인 API로 RGB LED 콘텐츠를 진짜 유료 전환(테스트 후 되돌리지 않음)

- 실제 admin 임시 계정으로 `app/api/content/[id]/review`를 `{action:'approve', isPremium:true}`로
  호출 → `content_modules.is_premium = true`로 반영 확인.
- 무료회원(구독 없음)·비로그인 토큰으로 상세 조회 → `locked: true`, `code` 필드 응답에
  아예 없음.
- 유료회원(활성 premium 구독) 토큰으로 상세 조회 → `locked: false`, `code` 정상 반환
  (1764자, 실제 코드).
- 목록 API → `isPremium: true`는 보이지만 `code`는 애초에 응답에 없음.
- **anon key로 `content_modules` 직접 REST 접근** → 0건 — RLS가 `is_premium=true` 행을
  정확히 걸러냄, 이틀 전 경고했던 우회경로가 실제로 막히는 것 확인.
- `npm test` 53개 전부 통과, 타입체크는 기존에 있던(이번 변경과 무관한) `gate.test.ts`
  에러 1개 외엔 이상 없음.

### 트러블슈팅

- 첫 시도에서 dev server를 여러 번 껐다 켜는 과정에서 `.next` 빌드 캐시가 깨져
  (`Cannot find module './vendor-chunks/@supabase.js'`) review API가 500을 반환,
  RGB LED 콘텐츠가 `pending_review` 상태로 잠깐 멈춰 있었음(published가 아니게 됨) —
  `.next` 삭제 + 프로세스 확실히 종료 후 재시작으로 해결, 재검증까지 전부 통과.
  **교훈: `lsof -ti:PORT | xargs kill`이 이 환경에서 가끔 안 먹힐 수 있음(여러 개의
  next dev 프로세스가 겹쳐서 떠 있었음) — `ps aux | grep next`로 실제 PID를 직접
  확인하고 `kill -9`하는 게 더 확실함.**

### 의도적으로 제외한 것

- 이미 `published`인 콘텐츠의 유료 여부만 따로 바꾸는 API(재승인 절차 없이) — 이번
  범위 아님, 필요해지면 별도 PATCH 엔드포인트로.
- `content-review` 목록 화면(`app/admin/content-review/page.tsx`)에 유료 배지 표시 —
  요청받지 않음.

(상세: [[project-content-modules-premium-deferred]])

---

## 9. ⚠️ Supabase 싱글턴 세션오염 버그 발견·수정

**커밋**: `fdc4622`

### 배경

8번 항목(RGB LED)을 실브라우저로 클릭해서 확인해달라는 요청으로 시작했는데, 로그인
후에는 콘텐츠가 계속 "찾을 수 없음"으로 떴음. 원인을 추적하다 **content_modules나
이 세션의 RLS 작업과 전혀 무관한, 훨씬 오래되고 심각한 기존 버그**를 발견함.

### 핵심 발견

`lib/supabase/server.ts`의 `getSupabaseServerClient()`는 `service_role` 키로 한 번만
생성되는 **모듈 전역 싱글턴**이다. `login`/`refresh`/`password/reset` 3개 라우트가 이
공유 인스턴스에서 `signInWithPassword`/`refreshSession`/`updateUser`를 호출하고
있었는데, 이 메서드들은 `persistSession: false`여도 **클라이언트의 메모리상 현재
세션을 그대로 바꿔버린다.** 서버 프로세스 안에서 로그인이 한 번이라도 일어나면, 그
순간부터 이 싱글턴은 service_role이 아니라 **그 사용자 권한으로 서버가 살아있는 동안
영구 고정**돼서, 그 이후 모든 사용자·모든 요청에 영향을 준다.

**왜 오늘 처음 드러났는가**: 대부분 테이블에 RLS/GRANT가 없던 시절엔 "권한이 낮아진
서비스 클라이언트"가 뭘 하든 조용히 42501로 실패하거나 티가 안 났음. 오늘 실제로 RLS를
걸어놓으니 증상(로그인 후 콘텐츠 404)이 명확하게 드러난 것 — 오늘 만든 버그가 아니라
오늘에서야 눈에 보이게 된 버그. `npm run dev`(HMR)와 `npm run build && npm run start`
둘 다에서 동일하게 재현돼서, Next.js dev 모드 문제가 아니라는 것도 확인함.

**특히 심각했던 지점 — `password/reset/route.ts`**: `resetToken`을 검증 없이 그냥
무시하고 "그 순간 싱글턴에 남아있던 아무 세션"의 비밀번호를 바꾸고 있었음(코드 주석에
"실제 프로젝트 설정에 맞춰 연결"이라고 적혀 있었음 — 처음부터 미완성 스텁). 사용자 A가
로그인해서 싱글턴을 오염시킨 상태에서 사용자 B가 비밀번호 재설정을 시도하면 A의
비밀번호가 바뀔 수 있는 구조 — 계정 탈취로 이어질 수 있는 취약점. 다행히 프론트엔드에
이 라우트를 호출하는 화면 자체가 없어서(`app/reset-password` 페이지 없음,
`password_reset_tokens` 테이블도 죽은 테이블) 실사용자에게 노출된 적은 없었음.

### 핵심 설계 판단

- `lib/supabase/server.ts`에 `createSupabaseAuthClient()` 추가 — **매 호출마다 새
  인스턴스**(절대 캐싱 안 함), `anon` key 사용(로그인·토큰갱신·비밀번호변경은 원래
  브라우저가 anon key로 직접 하는 일이라 service_role이 애초에 불필요, 최소 권한 원칙).
- `login`/`refresh`/`password/reset` 3개 라우트를 이 함수로 교체. `password/forgot`의
  `resetPasswordForEmail`은 실제론 세션을 안 바꾸지만 4개 인증 라우트를 통일하기 위해
  같이 교체.
- `password/reset`에 빠져있던 `verifyOtp({token_hash: resetToken, type: 'recovery'})`
  검증 단계를 추가 — 실제로 그 토큰의 주인 세션에서만 `updateUser`가 실행되게 함.

### 검증 방법 — 전부 실제 프로덕션 빌드(`next build && next start`) + 실제 API 호출

- 두 사용자 동시 로그인(`Promise.all`) → 각자 `/api/identity/me`로 정확히 본인 정보
  반환, 안 섞임.
- 로그인이 여러 번 일어난 뒤에도 `/api/content/examples/rgb-led-color-control`이
  정상 200 — 더 이상 전체 콘텐츠가 안 보이는 일 없음.
- `admin.generateLink({type:'recovery'})`로 실제 recovery token 2개를 발급해 두
  사용자 동시 비밀번호 재설정(`Promise.all`) → 각자 본인의 새 비밀번호로만 로그인
  성공, 서로의 새 비밀번호로 로그인 시도하면 정상 차단(안 섞임).
- `npm test` 53개 전부 통과.
- 수정 후 RGB LED 화면을 다시 실브라우저로 확인 — 비로그인/무료회원은 잠김, 유료회원만
  코드 공개, 스크린샷 3장으로 확인.

### 트러블슈팅 (원인 특정 과정)

- 처음엔 dev 서버 빌드 캐시 문제로 의심(오늘 이미 몇 번 겪었던 유형)했으나, `.next`
  삭제+깨끗한 재시작 후에도 재현됨.
- 동시성(Promise.all로 auth.getUser+쿼리 경합) 재현도 시도했으나 실패 — 문제가 단순
  레이스 컨디션이 아님을 확인.
- `getPublishedModuleById`에 임시 디버그 로그를 추가해서 `count(*)` 쿼리 결과가 로그인
  **직후부터 0으로 영구 고정**되는 걸 직접 확인 — 이 시점에 싱글턴 오염을 확신하고
  원인을 특정함. 디버그 로그는 원인 파악 후 전부 원복(커밋 안 됨).
- fetch 캐싱(Next.js Data Cache) 가설도 잠깐 테스트했으나 무관한 것으로 판명, 원복.

### 의도적으로 제외한 것

- 없음 — 발견 즉시 수정 및 실증 검증까지 완료.

(상세: [[project-supabase-singleton-session-pollution-bug]])

---

## 10. 회사 귀책 전액환불 (`payments.refund_reason`)

**커밋**: `f2c70f4` · **마이그레이션**: `0031`(대표님이 SQL Editor에서 적용 완료, 실DB 검증까지 마침)

### 배경

2026-08-20 Family 환불 정책 확정(§9, 이전 문서) 당시 회사 귀책(중복결제·시스템오류)
전액환불은 `payments.status`에 사유를 나타낼 플래그가 없어 자동 판별이 불가능하다는
이유로 명시적으로 범위 제외됐었음(CS/관리자 수동 처리 유지). 대표님이 이번 세션에서
그 스키마 공백을 채워달라고 요청해 착수.

### 핵심 설계 판단

- `payments.refund_reason`(text, nullable, `duplicate_payment` | `system_error`) 컬럼
  추가(`0031`) — CS/관리자가 SQL Editor로 직접 세팅하는 걸 전제로 함(세팅용 admin
  API/화면은 이번 범위 밖).
- `lib/billing/companyFaultRefund.ts`의 `findCompanyFaultPayment()` — 해당 구독/family_group의
  가장 최근 `status='success'` 결제 중 `refund_reason`이 채워진 게 있으면 그 결제의 실제
  결제금액을 반환. `lib/billing/familyUsage.ts`와 같은 이유로(DB 조회가 핵심) 순수 함수가
  아님.
- `refund/calculate`에서 개인/Family 두 분기 모두, 기존 기간·사용여부 계산보다 **먼저**
  이 체크를 수행 — 있으면 즉시 `{ refundAmount: payment.amount, reason: "company_fault" }`
  반환하고 나머지 로직(7일 창, 일할계산)은 건너뜀. 회사 귀책은 요금제 구분과 무관한
  사유라 개인 구독 경로도 이번에 같이 확장함(2026-08-20 Family 확장 때는 개인 경로를
  안 건드렸던 것과 다른 점 — 이번 사유는 애초에 Family 전용이 아니었기 때문).
- `payments`는 이미 `0022`에서 RLS+테이블 단위(`grant select on public.payments`) GRANT가
  걸려 있어 컬럼 추가만으로 충분 — 컬럼을 명시한 GRANT가 아니었음을 직접 확인 후 진행.

### 문서 동기화

- `DB_Schema_v1.0.md` `payments` 표에 `refund_reason` 행 추가, 회사 귀책 환불 설명을
  "다루지 않는다"에서 실제 동작으로 교체.
- `MVP_Scope_v1.2.md` v1.8 — Won't 표에서 "회사 귀책 전액환불 자동화" 항목 제거, 요금제
  Should 행 설명 갱신.
- `Session_2026-08-20_Summary_v1.1.md` "다음에 이어갈 것"에서 완료 표시.

### 검증 방법 — 대표님이 `0031`을 SQL Editor에서 적용한 뒤 실DB로 전 구간 실증 완료

- 임시 guardian/child 계정(`auth.admin.createUser`) + 임시 `subscriptions`/`family_groups`/
  `payments` row를 service_role로 직접 생성(결제 후 10일 경과로 세팅해 7일 미사용 전액환불
  창을 의도적으로 벗어남 — 회사 귀책 오버라이드가 기간 조건과 무관하게 이긴다는 것까지
  같이 증명하기 위함).
- `refund_reason`에 허용 안 된 값(`not_a_real_reason`)을 넣는 insert 시도 → check 제약이
  정상 거부하는 것 확인.
- `findCompanyFaultPayment()`를 개인 구독(`subscriptionId`)·Family(`familyGroupId`) 양쪽에
  직접 호출 → 정확한 결제 건(id/amount/refund_reason) 반환 확인.
- **실제 `POST /api/billing/refund/calculate` HTTP 호출까지 실증**: `admin.generateLink()` +
  throwaway 클라이언트에서만 쓰고 버리는 `verifyOtp()`로 guardian 실제 세션을 발급받아
  (앱의 캐시된 service_role 싱글턴은 손대지 않음 — §9 세션오염 교훈 그대로 적용), dev
  서버에 실제 Bearer 토큰으로 요청:
  - 개인 구독 `{childId}` → `{ refundAmount: 9900, reason: "company_fault" }`
  - Family `{family:true}` → `{ refundAmount: 19900, reason: "company_fault" }`
  - 둘 다 7일 창을 벗어난 기간인데도 일할계산이 아니라 전액환불로 응답 — 회사 귀책
    오버라이드가 기존 기간·사용여부 로직보다 우선한다는 것을 실제 응답으로 확인.
- 임시 계정·구독·payments·family_groups는 검증 직후 전부 삭제, 검증에 쓴 스크립트도
  커밋하지 않고 삭제.

### 의도적으로 제외한 것

- 회사 귀책 사유를 세팅하는 admin API/화면 — 이번 범위는 스키마+계산 로직까지만,
  세팅은 여전히 SQL Editor 수동.
- `refund_reason` 세팅 시 자동으로 실제 PG 환불(포트원 API 호출)까지 트리거하는 것 —
  이 라우트는 원래부터 "계산"만 하고 실제 환불 처리(결제 취소)는 다루지 않음(라우트명
  그대로 `refund/calculate`), 이번 확장도 그 경계를 유지.

(상세: [[project-family-plan-followups]])

---

## 11. §6.3-a 콘텐츠 버전 고정 정책 (`content_modules.slug`)

**커밋**: `5390c3d` · **마이그레이션**: `0032`(대표님이 SQL Editor에서 적용 완료, 실DB 검증까지 마침)

### 배경

`Project_Design_v2.4.md` §6.3 본문(384행)이 "신규 학습자는 v2, 이미 학습 중이던 사용자는
§6.3-a 정책에 따름"이라고 인용하지만, §6.3-a 섹션 자체가 실제로는 존재하지 않았음(§6.3
바로 다음이 §6.3-b로 건너뜀 — `grep`으로 재확인). 대표님이 이 정책을 확정하고 실제
구현까지 요청.

### 핵심 설계 판단

- **§6.3 다이어그램(REVISION_DRAFT, 고객 제출 이벤트)을 그대로 구현하지 않고 단순화**함 —
  이 저장소엔 이벤트 버스도 비관리자 콘텐츠 제출 플로우도 없음(기존에 이미 알려진 사실).
  대신 관리자가 `app/admin/content-review`에서 직접 누르는 "개선판 만들기" 버튼으로
  트리거(대표님이 준 요구사항과 정확히 일치).
- **`content_modules.id`(PK)와 `slug`(버전 무관 식별자)를 분리**(`0032`) — `id`가 PK라
  한 콘텐츠=한 행이던 구조라 버전을 여러 개 동시에 못 가졌음. 기존 행은 `slug=id`로
  백필(URL·기존 진도 그대로 유효), 개선판은 새 `id`(`{slug}-v{version}`)를 받고 `slug`는
  유지 — 두 버전이 동시에 `published`일 수 있음. `UNIQUE(slug, version)` 제약.
- **"개선판 만들기"는 복제 직후 곧장 `pending_review`로 넣음**(`draft` 경유 안 함,
  `app/api/content/[id]/revise/route.ts`) — 이미 검증된 v1 코드의 복제라 자동 재검증이
  무의미하고, 이 저장소엔 "기존 draft를 재검증에 태우는" 트리거 자체가 없음(`generate`
  파이프라인은 새 topic 전용). `status` enum에 별도 `revision_draft` 값을 추가하지 않고
  `version > 1`을 개선판 표식으로 씀 — 기존 검수 목록·승인/반려 API(`app/api/content/[id]/review`)를
  전혀 안 건드리고 그대로 재사용.
- **버전 판정은 읽기 시점에 서버가 계산, 새 컬럼·RPC·프론트엔드 변경 없음** —
  `lib/content/publishedModules.ts`의 `getPublishedModuleForUser(slug, userId)`. 퀴즈 제출
  경로(`app/examples/[id]/QuizBlock.tsx` → `/api/learning/quiz` → `submit_quiz_attempt` RPC)는
  원래도 URL 파라미터(슬러그)를 `module_id`로 그대로 써왔다는 걸 확인해서, "이미 학습
  중"의 판정을 `learning_progress`에 그 슬러그 행이 있는지만 보면 되도록 설계 — 대표님이
  준 기준("progress 행 존재 여부")과 정확히 일치하면서 결제·인증만큼 안정적인 이 기존
  경로를 하나도 안 건드림. 어느 버전에 고정할지는 그 진도의 `started_at`과 각 버전의
  `content_modules.updated_at`(=언제 `published` 승인됐는지의 대리 지표)을 비교해서
  결정 — `started_at` 이전에 이미 published였던 버전 중 최고 버전.
  - **전제 하나 명시**: `updated_at`이 "언제 published됐는가"를 정확히 반영하는 건
    "게시 후 재수정 기능이 없다"는 현재 상태에 의존함 — 나중에 그 기능이 생기면
    `published_at` 별도 컬럼으로 전환 필요(문서에도 명시함).
- `lib/content/publishedModules.ts`의 `getPublishedModules()`(카탈로그)도 함께 수정 —
  슬러그당 최신 버전만 골라 반환하도록 해서 카탈로그는 항상 신규 학습자 기준(요구사항 4번).
- `mapRowToExample()`의 노출 `id`를 `row.id`(기술 PK) → `row.slug`로 변경 — URL·다운로드
  파일명이 버전 접미사(`-v2`)를 노출하지 않도록.

### 문서 동기화

- `Project_Design_v2.4.md` v2.5 — §6.3-b 앞에 §6.3-a 신설.
- `DB_Schema_v1.0.md` — `content_modules`가 이 문서에 **한 번도 기록된 적 없었던 걸 발견**
  (0010에서 추가된 뒤 누락, `examples` 섹션은 실제로는 안 쓰이는 설계 스펙이었다는 것도
  같이 명시) — 기존 컬럼 전체 + `slug`/버전 의미를 새로 문서화.
- `API_Spec_v1.0.md` — `GET /api/content/examples/:id`에 버전 고정 동작 추가, `POST
  /api/content/:id/revise` 신규 행 추가. admin content-review의 나머지 엔드포인트들도
  이 문서에 원래 없었던 걸 확인했지만 이번 범위 밖이라 손대지 않음.

### 검증 방법 — 대표님이 `0032`를 SQL Editor에서 적용한 뒤 실DB로 전 구간 실증 완료

- 임시 v1 콘텐츠(`content_modules`, service_role로 직접 insert) + 임시 학생 계정(student_teen)
  으로 실제 `POST /api/learning/quiz` 호출 → `learning_progress` 행 생성(기존 학습자 조건 충족).
- 임시 admin 계정으로 실제 `POST /api/content/{v1Id}/revise` 호출 → v2 draft(`pending_review`,
  `version:2`) 생성 확인. v1/v2를 구분하려고 v2의 `explain_ko`/`label_ko`를 service_role로
  직접 다르게 세팅(편집 UI가 없어 검증 목적의 임시 조치 — 버전 판정 로직 자체와는 무관).
- 실제 `POST /api/content/{v2Id}/review`(action:approve)로 v2를 `published` 전환.
- **실제 `GET /api/content/examples/{slug}` HTTP 호출로 버전 분기 확인**:
  - 기존 학습자(v1 진도 有) 토큰 → `explain: "이것은 v1 설명입니다"` (v1 고정)
  - 신규 학습자(진도 없음) 토큰 → `explain: "이것은 v2 설명입니다"` (최신)
  - 비로그인 → `explain: "이것은 v2 설명입니다"` (최신)
  - 응답 `id` 필드가 기술적 PK(`{slug}-v2`)가 아니라 `slug` 그대로인 것도 확인.
- `GET /api/content/examples`(카탈로그) → 이 슬러그가 정확히 1개, v2 라벨 기준으로만
  노출되는 것 확인(슬러그당 최신만 노출).
- 임시 계정 3개(기존 학습자·신규 학습자·admin)·`content_modules`(v1/v2)·`learning_progress`/
  `quiz_attempts` 행은 검증 직후 전부 삭제, 검증 스크립트도 커밋하지 않고 삭제.

### 의도적으로 제외한 것

- 고객이 직접 "개선 제안"을 제출하는 플로우 — §6.3 다이어그램의 원래 트리거였지만
  비관리자 제출 인프라 자체가 없어 범위 밖(기존에 이미 알려진 제외 항목).
- 개선판 콘텐츠를 실제로 다르게 편집하는 UI — 지금은 복제된 그대로 검수·승인하는
  흐름만 구현. 실제 내용을 바꾸려면 관리자가 review-chat으로 검토 후, 향후 편집 기능이
  생기면 그걸로 수정하거나 지금은 반려 후 `generate`로 다시 만드는 수밖에 없음.
- `published_at` 별도 컬럼 — 지금은 "게시 후 재수정 없음" 전제로 `updated_at`을 대신
  씀(위 참고), 그 전제가 깨지면 필요.

(상세: [[project-content-versioning-6-3-a]])

---

## 12. 관리자 대시보드 (매출·요금제별 고객수/이탈률)

**커밋**: `3ed549e` · **마이그레이션**: `0033`(대표님이 SQL Editor에서 적용 완료, 실증 검증까지 마침)

### 배경

매출/구독 데이터가 개별 API(`billing/history` 등)로만 조회 가능했고, 경영 지표를 한눈에
보는 화면이 없었음. 어제(0022) 만든 `payments_admin_select`/`subscriptions_admin_select`
RLS 정책이 이미 admin 조회를 지원하니, 그 위에 집계 뷰+화면을 만들어달라는 요청.
**대표님이 명시한 우선순위: 화면보다 숫자의 정확성.**

### 핵심 설계 판단

- **`subscriptions.plan='free'` 행이 실제로 생성된 적이 없다는 걸 조사 중 발견** —
  `activateSubscription()`은 실제 결제가 일어날 때만 upsert하고 어디에도 `plan:'free'`를
  insert하는 코드가 없음(grep으로 확인). 그대로 카운트하면 항상 0이 나와 오히려 부정확하므로,
  요금제별 표는 premium/family만 다루기로 대표님께 확인받고 진행 — free까지 정확히 세려면
  "전체 학습자 계정 − 유료 커버 인원" 같은 별도 계산이 필요해 이번 범위 밖으로 명시.
- **집계 뷰를 `authenticated`에 GRANT하지 않음** — 이 세션 내내 지켜온 "새 테이블엔
  정책+GRANT를 세트로" 패턴(§1~§5)을 그대로 따르면 오히려 취약점이 생기는 예외 케이스.
  Postgres 뷰는 기본적으로 뷰 소유자(마이그레이션 실행 권한, RLS 우회) 권한으로 실행되므로,
  GRANT를 주면 `payments`/`subscriptions`의 guardian-only RLS를 완전히 우회해서
  `student_child`를 포함한 모든 인증 사용자가 전체 매출·구독자 수를 볼 수 있게 됨.
  service_role 전용으로 두고(`tutor_usage`/`wishlist_items`와 같은 부류), 대시보드
  API가 `getAuthedUser()`로 admin 확인 후에만 조회하는 기존 `content-review` 패턴을 그대로 씀.
- **"고객 수"와 "이탈"에 서로 다른 컬럼 기준을 씀** — 고객 수(요약카드·요금제 표)는
  `current_period_end >= now()` 기준(§4.3 "해지해도 잔여기간까지는 이용 가능" 원칙,
  `lib/content/gate.ts`의 `hasPremiumAccess()`와 동일 정의 재사용). 이탈률은 대표님이 준
  정의 그대로 `status='canceled'` 건수 / `status='active'` 건수(취소 **결정**을 세는
  지표라 접근권과는 다른 컬럼 조합이 맞음). `past_due`는 어느 쪽에도 안 넣음(취소도
  활성도 아닌 애매한 상태, 지시에 없던 케이스).
- 비율(`sharePct`)·이탈률 계산은 뷰가 아니라 API 라우트(`app/api/billing/dashboard/route.ts`)
  한 곳에서만 함 — 뷰는 원시 카운트만 반환해서 검증하기 쉽게 함.
- **자체 리뷰 중 타임존 버그 하나 발견·수정** — "이번 달" 매출을 찾는 로직이 처음엔
  서버의 로컬 타임존으로 월 경계를 계산했는데, Postgres `date_trunc`는 UTC 기준이라
  서버 실행 위치에 따라 어긋날 수 있었음(월 경계 근처에서 실제로 틀린 달을 가리킬 수
  있는 버그) — UTC로 명시적으로 계산하도록 실행 전에 고침.

### 문서 동기화

- `DB_Schema_v1.0.md` — `payments` 섹션 아래 "관리자 대시보드 집계 뷰" 신설, 뷰 3개 정의·
  GRANT 위험·free 제외 이유·검증 결과까지 기록.
- `API_Spec_v1.0.md` — `GET /api/billing/dashboard` 행 추가. **김에 2026-08-21에 놓쳤던
  `refund/calculate` 행의 회사 귀책 관련 문구도 같이 정정**(0031 작업 때 이 문서를 안
  건드려서 "이 API가 안 다룸"이라고 그대로 낡아 있었음 — 발견 즉시 고침).
- `MVP_Scope_v1.2.md` v1.9 — "관리자 대시보드" 행 신설(이전엔 이 문서 어디에도 스코프된
  적 없던 항목).

### 검증 방법 — 실DB 수기 계산 대조 완료

- 임시 계정 9개 + `subscriptions`(active 2건, 이번달 취소지만 유예기간 남은 것 1건, 지난달
  취소돼 유예도 끝난 것 1건) + `family_groups`(active 1건, 이번달 취소+유예 끝난 것 1건) +
  `payments`(이번달 성공 2건, 지난달 성공 1건, 이번달 실패 1건) 직접 생성.
  각 행을 넣기 전(before)/후(after) 뷰 raw 값을 직접 비교해 델타가 손으로 계산한 값과
  정확히 일치하는지 확인, 그 raw 값으로 직접 계산한 이탈률·비율과 실제
  `GET /api/billing/dashboard` 응답을 대조 — 매출·결제건수·요금제별 고객수·이탈률·비율
  전부 일치.
- non-admin(guardian) 토큰으로 같은 API 호출 → `401` 확인(권한 방어 실증).
- **검증 중 발견 — 쓰기 직후 곧바로 읽으면 `admin_plan_churn`의 `canceled_this_period`가
  몇 초간 지연 반영됨**(반면 `active_count`는 즉시 반영). 3초 후 재조회하면 항상 정확한
  값으로 안정화되는 것까지 확인해서, 뷰의 SQL 로직 버그가 아니라 infra 레벨의 짧은
  propagation lag로 판단 — 해지 이벤트와 대시보드 조회가 실제로는 분·시간 단위로 떨어져
  일어나니 실사용에 영향 없음. `DB_Schema_v1.0.md`에도 이 특성을 기록해둠.
- 임시 계정·`subscriptions`/`family_groups`/`payments`는 검증 직후 전부 삭제 확인
  (baseline과 정확히 같은 카운트로 복귀).

### 의도적으로 제외한 것

- `free` 티어 고객 수 — 위 참고, "전체 학습자 − 유료 커버 인원" 계산이 필요해지면 별도 작업.
- 정교한 차트/필터링(기간 선택 등) — 대표님이 "지금은 정확한 숫자 자체가 목표"로 명시,
  요약 카드+표 위주로만 구현.
- 뷰의 propagation lag 자체를 없애는 인프라 조사 — 실사용에 영향 없다고 판단해 조사 안 함.

(상세: [[project-admin-dashboard]])

---

## 다음에 이어갈 것 (전부 대표님이 먼저 꺼낼 때 시작 — 2026-08-20 문서에서 이월)

- Solapi 프로덕션 키 설정
- 구독/Family 만료 임박 알림 (cron 인프라 선결정 필요)
- 콘텐츠 검수 승인/반려 알림 (비-admin 제출 플로우가 생기면)
- ~~회사 귀책 전액환불 자동 판별~~ — 2026-08-21 완료(위 §10, `0031`)
- 관리자 대시보드의 `free` 티어 고객 수 (전체 학습자 계정 − 유료 커버 인원 계산 필요)
- Family → Premium/Free 요금제 티어 전환
- `progress`/`saved_codes` 미사용 판단 로직의 실데이터 검증 (`examples` 테이블에 데이터가 생기면)
- `already_member` 레이스 사용자 메시지 개선 (정확성 문제 아닌 UX nicety)
- 회사 귀책 사유(`refund_reason`)를 세팅하는 admin API/화면 (지금은 SQL Editor 수동)
- ~~§6.3-a 콘텐츠 버전 고정 정책~~ — 2026-08-21 완료(위 §11, `0032`)
- 개선판 콘텐츠를 실제로 편집하는 UI (지금은 복제 그대로만 검수 가능)
- `content_modules`가 승인 후 재수정 가능해지면 `published_at` 컬럼 분리 검토
