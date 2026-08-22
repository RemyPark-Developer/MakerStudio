# MakerStudio 개발 순서표 (셀프/AI 도구 개발용)

**버전**: v1.1 · **작성일**: 2026-08-13 · **최종 수정**: 2026-08-22(1~7단계 완료 현황을 실제 코드와 대조해 정정, 8단계 배포/모니터링은 전부 미착수 확인)
**짝 파일**: `MakerStudio_MVP_Scope_v1.13.md` · `MakerStudio_DB_Schema_v1.0.md` · `MakerStudio_API_Spec_v1.0.md` · `MakerStudio_Auth_Flow_v1.2.md`

> **2026-08-22 갱신**: 1~7단계는 사실상 다 끝났다(1~4단계 완료, 5단계 결제도 핵심은 끝났고
> "재시도" 엔드포인트만 미구현으로 확인, 6단계 완료, 7단계는 위시리스트만 미구현). **8단계
> (배포/모니터링 — Vercel 프로덕션 연결, Sentry, Lighthouse CI)만 전부 미착수임을 이번에
> 실제로 확인**(이전 버전 문서엔 "6~7단계도 대부분 끝났다"고만 적혀 있어 8단계 상태가
> 불명확했음). 이 문서는 "처음에 뭐부터 짤지" 순서표라 이제 참고용에 가깝다 — **지금 뭘 해야
> 할지는 이 문서 대신 `docs/MakerStudio_Session_2026-08-22_Summary_v1.3.md`의 "다음에
> 이어갈 것"과 `~/.claude/projects/-workspaces-MakerStudio/memory/`의 project 메모리를
> 먼저 볼 것.** 순서 원칙(§3, "왜 이 순서로 해야 하는지")은 여전히 유효하니 새 기능을 짤 때
> 참고할 가치는 있음.

## 0. 이 문서의 성격

외주용 문서(API 명세서·DB 스키마 등)는 "정확한 계약 기준"이 목적이라 상세합니다. 이 문서는 반대로 **"지금 스캐폴드에 뭐부터 이어붙일지"** 를 실행 순서로만 정리한, 셀프/AI 코딩 도구용 실용 문서입니다. 순서를 건너뛰면 나중에 되돌리는 비용이 큰 지점 위주로 순서를 정했습니다.

## 1. 지금 상태 (이미 끝난 것)

- ✅ Next.js 스캐폴드, 콘텐츠 3개 실제 컴파일 검증 통과
- ✅ AI 튜터 서버 프록시 + 사용량 제한(IP 기준)
- ✅ 단위 테스트 + GitHub Actions CI
- ✅ 랜딩페이지 등 17개 화면 프로토타입(디자인 검증 완료, 실제 코드 아님)

## 2. 순서 (Must → Should → Could, MVP_Scope 기준)

### 1단계 — Supabase 연결 (모든 것의 전제조건) ✅ 완료
- Supabase 프로젝트 생성
- `DB_Schema_v1.0.md`의 테이블을 실제 마이그레이션 SQL로 작성 (`supabase/migrations/`) — 36개(`0001`~`0036`)
- RLS 정책 작성 — **특히 `subscriptions`/`payments`에 `student_child` 역할 접근 차단** (Auth_Flow §3, 이걸 나중으로 미루면 결제 붙인 뒤 되돌리기 훨씬 어려움) — **2026-08-21에 실제로 완성됨(`0022`~`0029`), 실 JWT로 실증 검증까지 완료(DB_Schema.md §7 참고)**
- 로컬 `.env.local`에 Supabase 키 연결, 연결 확인용 헬스체크 API 하나

### 2단계 — 인증 (Must) — 카카오만 남고 거의 완료
- Supabase Auth 소셜 로그인 — **구글 완료(2026-08-22)**, 카카오는 대표님이 Supabase
  대시보드에 프로바이더(Client ID/Secret) 등록 대기 중(코드는 버튼 추가만 하면 되는 상태)
- 소셜 최초가입 온보딩(닉네임) — `app/auth/callback/page.tsx`로 완료(2026-08-22)
- 초등학생 보호자 SMS 인증 흐름 (`Auth_Flow.md` §2.3 그대로 구현 — 서버 재검증 로직 반드시 포함)
- 이메일/비밀번호 로그인, 비밀번호 재설정
- 로그아웃

### 3단계 — 콘텐츠 게이팅 (Must, §7.2) ✅ 완료
- `content/examples/:id` API를 SSG에서 서버 렌더링/API 라우트로 전환
- 구독 상태 확인 후 `code`/`explain` 필드 포함 여부 결정하는 로직 추가 — `lib/content/gate.ts`
- **이 단계를 미루고 먼저 화면부터 만들면, 나중에 "이미 다 보이던 콘텐츠를 잠그는" 작업이 되어 더 위험합니다 — 반드시 결제 붙이기 전에 먼저 완성**

### 4단계 — 마이페이지 실데이터 연동 (Should) ✅ 완료
- `progress`, `saved_codes` 테이블 연동 — 프로토타입의 정적 마이페이지를 실제 DB 조회로 전환
- AI 튜터 rate-limit을 IP 기준 → `tutor_usage` 테이블 기반 user_id 기준으로 전환 — `lib/rate-limit-db.ts`

### 5단계 — 결제 (Must) ✅ 대부분 완료 — "재시도" 엔드포인트만 미구현
- 포트원 연동. **경로 정정(2026-08-22)**: 서버가 결제 세션을 만드는 `POST /api/billing/checkout`는
  없음 — 브라우저가 `@portone/browser-sdk`로 직접 결제창을 열고, 서버는
  `POST /api/billing/checkout/verify`로 검증만 한다(API_Spec.md §3 참고)
- 웹훅 수신(`webhook/portone`) → 구독 상태 갱신
- **`billing/*` 전체에 `role !== guardian` 차단 미들웨어부터 넣고 나서** 나머지 로직 작성 (순서 중요 — Auth_Flow §3) — `requireGuardian()`으로 구현됨
- 구독 해지 — 완료. **결제 실패/재시도의 "재시도"는 미구현(2026-08-22 확인)** — `app/api/billing/subscription/retry`가 이 문서에만 있고 실제 라우트는 없음. 결제 실패는 지금 웹훅의 `Transaction.Failed` 처리 → guardian 알림(`payment_failed`)까지만 되고, 사용자가 재시도를 누르는 버튼/API는 따로 없음(체크아웃 화면을 처음부터 다시 여는 것으로 대체 가능한 상태)
- 계정 삭제 + 환불 계산(`refund/calculate`) — 완료. Family 환불·회사 귀책 전액환불까지 확장됨(DB_Schema.md §2)

### 6단계 — 랜딩페이지/카탈로그 실이식 (Should) ✅ 완료
- 프로토타입의 랜딩페이지·카탈로그를 실제 Next.js 페이지로 이식 (SEO를 위해 이 부분만은 SSG 사용 — §13.2, 3단계의 "SSG 금지"는 잠긴 콘텐츠에만 해당)
- 카탈로그 검색/정렬 그대로 이식 (클라이언트 로직이라 이식 비용 낮음)

### 7단계 — Could 항목 (예산·시간 남으면) — 위시리스트만 미구현
- 위시리스트 (기기 간 영구 저장 — `wishlist_items` 테이블) — **미구현(2026-08-22 확인)**, API_Spec에만 정의돼 있고 테이블·라우트 둘 다 없음
- 알림함 전체 유형 — ✅ 완료. `notifications` 도메인이 결제 성공/실패, 구독·Family 해지, Family 멤버/좌석 변경, AI튜터 안전장치 발동, VIP 피드백 발송까지 10종 커버, 인앱 알림함(`/mypage/notifications`)도 있음

### 8단계 — 배포/모니터링 — **전부 미착수(2026-08-22 확인)**
- Vercel 프로덕션 연결 — 안 함(`NEXT_PUBLIC_APP_URL`이 GitHub Codespaces 개발 URL로 설정돼 있음, `.env.local` 참고)
- Sentry 연동 (§9.2) — 저장소에 관련 설정·패키지 없음
- Lighthouse CI 추가 (`NonFunctional_Requirements.md` §1) — `.github/workflows/ci.yml`엔 콘텐츠 검증만 있고 Lighthouse 관련 스텝 없음

## 3. 이 순서를 지켜야 하는 이유 (건너뛰면 안 되는 지점)

| 지점 | 먼저 안 하면 생기는 문제 |
|---|---|
| RLS를 1단계에서 | 나중에 결제 붙인 뒤 추가하면, 이미 열려있던 구멍으로 실제 사고가 날 수 있음 |
| 콘텐츠 게이팅을 결제보다 먼저(3단계) | 결제 기능부터 만들면 "이미 공개된 콘텐츠를 나중에 잠그는" 순서가 되어 실수 위험 큼 |
| billing 권한 차단을 로직보다 먼저(5단계) | 미들웨어 없이 결제 로직부터 짜면, 나중에 "다 만든 다음 권한 체크 끼워넣기"가 되어 빠뜨리기 쉬움 |
