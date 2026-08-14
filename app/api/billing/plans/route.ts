import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-error-handler";
import { PLAN_PRICES } from "@/lib/billing/plans";

/**
 * MVP 범위(MVP_Scope.md): Free/Premium 개인만. 가족 요금제·B2B는 Won't.
 */
export const GET = withErrorHandling(async () => {
  return NextResponse.json({
    plans: [
      { id: "free", name: "Free", price: PLAN_PRICES.free, interval: null },
      { id: "premium", name: "Premium 개인", price: PLAN_PRICES.premium, interval: "month" },
    ],
  });
});
