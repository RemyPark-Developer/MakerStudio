import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser, requireGuardian } from "@/lib/supabase/auth-context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { calculateProratedRefund, isWithinFullRefundWindow } from "@/lib/billing/refund";
import { checkFamilyGroupUsedInPeriod } from "@/lib/billing/familyUsage";
import { PLAN_PRICES } from "@/lib/billing/plans";
import { withErrorHandling } from "@/lib/api-error-handler";

/**
 * ⚠️ 이 라우트는 "일할계산" 또는 "미사용 전액환불"만 계산한다. 회사 귀책(중복결제,
 * 시스템 오류 등)으로 인한 전액환불은 이 API가 다루지 않는다 — 지금처럼 CS/관리자가
 * 수동으로 처리한다(2026-08-20 Family 환불 정책 확정 시 명시적으로 범위에서 제외한
 * 결정). 이 응답만 보고 "회사귀책도 자동 처리되는 줄" 착각하지 말 것.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await getAuthedUser(req);
  if (!requireGuardian(user)) {
    return NextResponse.json({ error: "forbidden", message: "보호자만 이용할 수 있어요." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const childId: string | undefined = body?.childId;
  const family: boolean = body?.family === true;

  if (!childId && !family) {
    return NextResponse.json(
      { error: "invalid_request", message: "childId 또는 family:true가 필요해요." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();

  if (family) {
    const { data: familyGroup } = await supabase
      .from("family_groups")
      .select("id, current_period_start, current_period_end")
      .eq("owner_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!familyGroup) {
      return NextResponse.json({ error: "not_found", message: "활성 구독이 없어요." }, { status: 404 });
    }

    const { data: members } = await supabase
      .from("family_group_members")
      .select("child_id")
      .eq("family_group_id", familyGroup.id);

    const userIds = [user.id, ...(members ?? []).map((m) => m.child_id as string)];
    const periodStart = new Date(familyGroup.current_period_start);
    const periodEnd = new Date(familyGroup.current_period_end);
    const now = new Date();

    if (isWithinFullRefundWindow(periodStart, now)) {
      const used = await checkFamilyGroupUsedInPeriod(supabase, { userIds, periodStart, periodEnd });
      if (!used) {
        const totalDays = Math.round((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
        return NextResponse.json({
          refundAmount: PLAN_PRICES.family,
          usedDays: 0,
          totalDays,
          remainingDays: totalDays,
          reason: "unused_full_refund",
        });
      }
    }

    const result = calculateProratedRefund({
      monthlyAmount: PLAN_PRICES.family,
      periodStart,
      periodEnd,
      now,
    });
    return NextResponse.json({ ...result, reason: "prorated" });
  }

  // family:true가 아니면 위 !childId && !family 가드를 통과했으므로 childId는 항상 있다.
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
