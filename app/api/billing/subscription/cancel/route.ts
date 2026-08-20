import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser, requireGuardian } from "@/lib/supabase/auth-context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/api-error-handler";
import { notifyGuardian } from "@/lib/notifications/notify";

/**
 * §4.3: 해지해도 즉시 끊지 않고 현재 결제주기 종료일까지는 그대로 이용 가능.
 */
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
  const { data, error } = await supabase
    .from("subscriptions")
    .update({ status: "canceled", canceled_at: new Date().toISOString() })
    .eq("guardian_id", user.id)
    .eq("child_id", childId)
    .eq("status", "active")
    .select("current_period_end")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "not_found", message: "활성 구독이 없어요." }, { status: 404 });
  }

  const notifyResult = await notifyGuardian({
    guardianId: user.id,
    type: "subscription_canceled",
    message: `구독이 해지됐어요. ${new Date(data.current_period_end).toLocaleDateString("ko-KR")}까지는 계속 이용할 수 있어요.`,
    actionUrl: "/mypage/billing",
  });
  if (!notifyResult.ok) {
    console.error("구독 해지 알림 실패:", notifyResult.reason);
  }

  return NextResponse.json({
    ok: true,
    accessUntil: data.current_period_end,
    message: `해지됐어요. ${new Date(data.current_period_end).toLocaleDateString("ko-KR")}까지는 계속 이용할 수 있어요.`,
  });
});
