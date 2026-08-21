import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser, requireGuardian } from "@/lib/supabase/auth-context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/api-error-handler";
import { notifyGuardian } from "@/lib/notifications/notify";
import { calculateRetentionUntil } from "@/lib/billing/dataRetention";

/**
 * §4.3: 해지해도 즉시 끊지 않고 현재 결제주기 종료일까지는 그대로 이용 가능
 * (subscription/cancel/route.ts와 동일한 원칙 — lib/content/gate.ts의
 * hasFamilyPlanAccess()가 status가 아니라 current_period_end만으로 판단하도록
 * 2026-08-20에 고쳐서 이 원칙이 실제로 지켜지게 됨).
 *
 * family_group_members는 지우지 않는다 — family_groups.owner_id가 unique라
 * 나중에 재결제하면 같은 row가 그대로 재활성화되므로, 자녀를 다시 추가할 필요가
 * 없게 멤버십을 그대로 남겨둔다.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await getAuthedUser(req);
  if (!requireGuardian(user)) {
    return NextResponse.json({ error: "forbidden", message: "보호자만 이용할 수 있어요." }, { status: 403 });
  }

  const supabase = getSupabaseServerClient();

  // 해지 후 30일 데이터 보관 정책(준비 단계, 2026-08-22 0036) — subscription/cancel과 동일 원칙.
  // ⚠️ 이 정책의 법적 고지 문구·기간은 초안이며 실제 법률 검토가 필요하다.
  const { data: currentGroup } = await supabase
    .from("family_groups")
    .select("current_period_end")
    .eq("owner_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  const dataRetentionUntil = currentGroup
    ? calculateRetentionUntil(new Date(currentGroup.current_period_end)).toISOString()
    : null;

  const { data, error } = await supabase
    .from("family_groups")
    .update({ status: "canceled", canceled_at: new Date().toISOString(), data_retention_until: dataRetentionUntil })
    .eq("owner_id", user.id)
    .eq("status", "active")
    .select("current_period_end")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "not_found", message: "활성 Family 구독이 없어요." }, { status: 404 });
  }

  const notifyResult = await notifyGuardian({
    guardianId: user.id,
    type: "subscription_canceled",
    message: `Family 구독이 해지됐어요. ${new Date(data.current_period_end).toLocaleDateString("ko-KR")}까지는 계속 이용할 수 있어요.`,
    actionUrl: "/mypage/billing",
  });
  if (!notifyResult.ok) {
    console.error("Family 해지 알림 실패:", notifyResult.reason);
  }

  return NextResponse.json({
    ok: true,
    accessUntil: data.current_period_end,
    message: `해지됐어요. ${new Date(data.current_period_end).toLocaleDateString("ko-KR")}까지는 계속 이용할 수 있어요.`,
  });
});
