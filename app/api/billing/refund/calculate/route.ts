import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser, requireGuardian } from "@/lib/supabase/auth-context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { calculateProratedRefund } from "@/lib/billing/refund";
import { PLAN_PRICES } from "@/lib/billing/plans";
import { withErrorHandling } from "@/lib/api-error-handler";

export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await getAuthedUser(req);
  if (!requireGuardian(user)) {
    return NextResponse.json({ error: "forbidden", message: "보호자만 이용할 수 있어요." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const childId: string | undefined = body?.childId;
  if (!childId) {
    return NextResponse.json({ error: "invalid_request", message: "childId가 필요해요." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { data: sub, error } = await supabase
    .from("subscriptions")
    .select("plan, current_period_start, current_period_end")
    .eq("guardian_id", user.id)
    .eq("child_id", childId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !sub) {
    return NextResponse.json({ error: "not_found", message: "활성 구독이 없어요." }, { status: 404 });
  }
  if (sub.plan === "free") {
    return NextResponse.json({ refundAmount: 0, message: "Free 플랜은 환불 대상이 아니에요." });
  }

  const monthlyAmount = sub.plan === "premium" ? PLAN_PRICES.premium : 0;
  const result = calculateProratedRefund({
    monthlyAmount,
    periodStart: new Date(sub.current_period_start),
    periodEnd: new Date(sub.current_period_end),
    now: new Date(),
  });

  return NextResponse.json(result);
});
