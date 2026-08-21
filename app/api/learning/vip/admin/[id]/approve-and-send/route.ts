import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase/auth-context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/api-error-handler";
import { notifyGuardian } from "@/lib/notifications/notify";

/**
 * 관리자가 AI 초안을 검토·수정한 뒤 한 번의 클릭으로 확정+발송한다(대표님 지시,
 * 2026-08-22 — status enum엔 approved도 있지만 정상 플로우에서는 거치지 않고 곧장 sent로
 * 간다). AI가 사람인 척 전부 처리하지 않는다는 0035의 핵심 원칙을 실제로 강제하는 지점 —
 * 이 라우트를 통하지 않고는 final_feedback이 절대 채워지지 않는다.
 */
export const POST = withErrorHandling(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await getAuthedUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const finalFeedback: string | undefined = body?.finalFeedback;

  if (!finalFeedback || typeof finalFeedback !== "string" || !finalFeedback.trim()) {
    return NextResponse.json(
      { error: "invalid_request", message: "finalFeedback이 필요해요." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();

  const { data: current } = await supabase
    .from("vip_mentor_requests")
    .select("id, user_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!current) {
    return NextResponse.json({ error: "not_found", message: "제출물을 찾을 수 없어요." }, { status: 404 });
  }
  if (current.status === "sent") {
    return NextResponse.json(
      { error: "invalid_state", message: "이미 발송된 건이에요." },
      { status: 409 }
    );
  }

  const { error: updateError } = await supabase
    .from("vip_mentor_requests")
    .update({
      final_feedback: finalFeedback,
      status: "sent",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: "server_error", message: "처리에 실패했어요." }, { status: 500 });
  }

  // 이 학생의 VIP 결제 주체(guardian)를 찾는다 — guardian_child_links가 아니라
  // subscriptions에서 직접 찾는다. VIP 구독의 guardian_id가 "누가 이 서비스를 결제했는가"의
  // 가장 확실한 소스이고(구독이 곧 결제 관계), guardian_child_links는 별도의 법적 동의
  // 테이블이라 이론상 어긋날 수 있다.
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("guardian_id")
    .eq("child_id", current.user_id)
    .eq("plan", "premium_vip")
    .maybeSingle();

  if (subscription?.guardian_id) {
    const notifyResult = await notifyGuardian({
      guardianId: subscription.guardian_id,
      type: "vip_feedback_sent",
      message: "VIP 멘토 피드백이 도착했어요. 마이페이지에서 확인해보세요.",
      actionUrl: "/mypage/vip",
    });
    if (!notifyResult.ok) {
      console.error("vip_feedback_sent 알림 실패:", notifyResult.reason);
    }
  } else {
    console.error("VIP 발송: guardian을 찾지 못해 알림을 못 보냄", { requestId: id, studentId: current.user_id });
  }

  return NextResponse.json({ ok: true, status: "sent" });
});
