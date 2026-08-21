# 2026-08-21 세션 요약 — 설계 판단과 구현 범위

**버전**: v1.0 · **최종 수정**: 2026-08-21 · **짝 파일**: `MakerStudio_Auth_Flow_v1.0.md`, `MakerStudio_Session_2026-08-20_Summary_v1.1.md`

### 개정 이력
| 버전 | 날짜 | 주요 변경 |
|---|---|---|
| v1.0 | 2026-08-21 | 최초 작성 — `payments`/`subscriptions`/`notifications` RLS 구현 1건 |

이 문서는 커밋으로만 남아있는 하루치 작업의 "왜"를 한 곳에 모은 기록이다. 전날(2026-08-20)
작업은 `MakerStudio_Session_2026-08-20_Summary_v1.1.md`에 있음 — 날짜가 바뀌어서 이어붙이지
않고 새 파일로 만듦(그 문서 §개요 아래 안내된 컨벤션 그대로).

## 개요

| 순서 | 작업 | 커밋 | 마이그레이션 |
|---|---|---|---|
| 1 | `payments`/`subscriptions`/`notifications` RLS 구현 | `8c9d32f` | `0022`, `0023` |

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

## 다음에 이어갈 것 (전부 대표님이 먼저 꺼낼 때 시작 — 2026-08-20 문서에서 이월)

- Solapi 프로덕션 키 설정
- 구독/Family 만료 임박 알림 (cron 인프라 선결정 필요)
- 콘텐츠 검수 승인/반려 알림 (비-admin 제출 플로우가 생기면)
- `content_modules.is_premium` 컬럼 (DB 생성 콘텐츠도 프리미엄으로 팔아야 하는 요구사항이 생기면)
- 회사 귀책 전액환불 자동 판별 (`payments.status`에 사유 플래그 추가하는 스키마 작업부터 필요)
- Family → Premium/Free 요금제 티어 전환
- `progress`/`saved_codes` 미사용 판단 로직의 실데이터 검증 (`examples` 테이블에 데이터가 생기면)
- `already_member` 레이스 사용자 메시지 개선 (정확성 문제 아닌 UX nicety)
- (신규) `learning_progress`/`tutor_messages`/`content_review_messages`의 `authenticated` GRANT
  보완 — 이 테이블들에 실제 클라이언트 직접 접근(Realtime 등)이 필요해지면 그때 진행
