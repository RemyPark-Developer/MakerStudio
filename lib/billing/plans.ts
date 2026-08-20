/**
 * 가격을 한 곳에서만 관리 — plans/route.ts와 checkout/verify/route.ts가 다른 값을
 * 갖게 되는 실수를 방지한다.
 * family: 최대 3명(seat_limit) 공유, 개인 구독(subscriptions)과는 별개로
 * family_groups/family_group_members에서 관리된다 (2026-08-20, MVP_Scope.md v1.3).
 */
export const PLAN_PRICES: Record<string, number> = {
  free: 0,
  premium: 9900,
  family: 19900,
};

export function getPlanPrice(planId: string): number | null {
  return planId in PLAN_PRICES ? PLAN_PRICES[planId] : null;
}
