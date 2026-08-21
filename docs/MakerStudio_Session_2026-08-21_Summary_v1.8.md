# 2026-08-21 세션 요약 — 설계 판단과 구현 범위

**버전**: v1.7 · **최종 수정**: 2026-08-21 · **짝 파일**: `MakerStudio_Auth_Flow_v1.0.md`, `MakerStudio_Session_2026-08-20_Summary_v1.1.md`

### 개정 이력
| 버전 | 날짜 | 주요 변경 |
|---|---|---|
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

---

## 1. `payments`/`subscriptions`/`notifications` RLS 구현

**커밋**: `8c9d32f`(0022, 0023)

### 배경

`docs/MakerStudio_Auth_Flow_v1.0.md` §3은 `billing/*`가 "API 미들웨어 + RLS(Row Level
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

## 다음에 이어갈 것 (전부 대표님이 먼저 꺼낼 때 시작 — 2026-08-20 문서에서 이월)

- Solapi 프로덕션 키 설정
- 구독/Family 만료 임박 알림 (cron 인프라 선결정 필요)
- 콘텐츠 검수 승인/반려 알림 (비-admin 제출 플로우가 생기면)
- 회사 귀책 전액환불 자동 판별 (`payments.status`에 사유 플래그 추가하는 스키마 작업부터 필요)
- Family → Premium/Free 요금제 티어 전환
- `progress`/`saved_codes` 미사용 판단 로직의 실데이터 검증 (`examples` 테이블에 데이터가 생기면)
- `already_member` 레이스 사용자 메시지 개선 (정확성 문제 아닌 UX nicety)
