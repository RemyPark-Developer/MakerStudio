import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-error-handler";
import { PLAN_PRICES } from "@/lib/billing/plans";

export const GET = withErrorHandling(async () => {
  return NextResponse.json({
    plans: [
      { id: "free", name: "Free", price: PLAN_PRICES.free, interval: null },
      { id: "premium", name: "Premium 개인", price: PLAN_PRICES.premium, interval: "month" },
      { id: "family", name: "Family (최대 3명)", price: PLAN_PRICES.family, interval: "month" },
    ],
  });
});
