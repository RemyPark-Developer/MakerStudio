/**
 * MVP 범위(MVP_Scope.md): Free/Premium 개인만. 가족 요금제·B2B는 Won't.
 * 가격을 한 곳에서만 관리 — plans/route.ts와 checkout/verify/route.ts가 다른 값을
 * 갖게 되는 실수를 방지한다.
 */
export const PLAN_PRICES: Record<string, number> = {
  free: 0,
  premium: 9900,
};

export function getPlanPrice(planId: string): number | null {
  return planId in PLAN_PRICES ? PLAN_PRICES[planId] : null;
}
