/**
 * 가격을 한 곳에서만 관리 — plans/route.ts와 checkout/verify/route.ts가 다른 값을
 * 갖게 되는 실수를 방지한다.
 * family: 최대 3명(seat_limit) 공유, 개인 구독(subscriptions)과는 별개로
 * family_groups/family_group_members에서 관리된다 (2026-08-20, MVP_Scope.md v1.3).
 */
export const PLAN_PRICES: Record<string, number> = {
  free: 0,
  premium: 9900,
  // Premium VIP — 비동기 AI초안+관리자승인 멘토링(2026-08-22, 0035). 일반 Premium 콘텐츠
  // 접근권도 포함(lib/content/gate.ts의 hasPremiumAccess()가 premium_vip도 인정).
  premium_vip: 100000,
  family: 19900,
  // Family 좌석 추가(4번째부터) 1좌석당 가격 — 2026-08-18 확정. 그 결제 주기 동안만
  // 유효(activateFamilyGroup이 재결제마다 seat_limit을 3으로 리셋, 0021 참고).
  family_extra_seat: 4900,
};

export function getPlanPrice(planId: string): number | null {
  return planId in PLAN_PRICES ? PLAN_PRICES[planId] : null;
}
