# 2026-08-21 세션 요약 — 설계 판단과 구현 범위

**버전**: v1.3 · **최종 수정**: 2026-08-21 · **짝 파일**: `MakerStudio_Auth_Flow_v1.0.md`, `MakerStudio_Session_2026-08-20_Summary_v1.1.md`

### 개정 이력
| 버전 | 날짜 | 주요 변경 |
|---|---|---|
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

## 다음에 이어갈 것 (전부 대표님이 먼저 꺼낼 때 시작 — 2026-08-20 문서에서 이월)

- Solapi 프로덕션 키 설정
- 구독/Family 만료 임박 알림 (cron 인프라 선결정 필요)
- 콘텐츠 검수 승인/반려 알림 (비-admin 제출 플로우가 생기면)
- `content_modules.is_premium` 컬럼 (DB 생성 콘텐츠도 프리미엄으로 팔아야 하는 요구사항이 생기면)
- 회사 귀책 전액환불 자동 판별 (`payments.status`에 사유 플래그 추가하는 스키마 작업부터 필요)
- Family → Premium/Free 요금제 티어 전환
- `progress`/`saved_codes` 미사용 판단 로직의 실데이터 검증 (`examples` 테이블에 데이터가 생기면)
- `already_member` 레이스 사용자 메시지 개선 (정확성 문제 아닌 UX nicety)
