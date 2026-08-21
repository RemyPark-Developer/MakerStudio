import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase/auth-context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/api-error-handler";
import { countVipSubmissionsThisMonth, MONTHLY_VIP_SUBMISSION_LIMIT } from "@/lib/learning/vipQuota";

/**
 * 학생 본인의 VIP 제출 이력, 또는 guardian이 연결된 자녀의 이력을 본다.
 * ai_draft_feedback/flag_reason은 절대 응답에 포함하지 않는다 — AI 초안은 관리자
 * 승인 전까지 학생/보호자에게 노출되면 안 된다(0035 설계 원칙).
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const user = await getAuthedUser(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  const { searchParams } = new URL(req.url);
  const requestedChildId = searchParams.get("childId");

  let targetUserId: string;

  if (user.role === "student_child" || user.role === "student_teen") {
    targetUserId = user.id;
  } else if (user.role === "guardian") {
    if (!requestedChildId) {
      return NextResponse.json(
        { error: "invalid_request", message: "childId가 필요해요." },
        { status: 400 }
      );
    }
    const { data: link } = await supabase
      .from("guardian_child_links")
      .select("child_id")
      .eq("guardian_id", user.id)
      .eq("child_id", requestedChildId)
      .maybeSingle();

    if (!link) {
      return NextResponse.json(
        { error: "forbidden", message: "연결된 자녀가 아니에요." },
        { status: 403 }
      );
    }
    targetUserId = requestedChildId;
  } else {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("vip_mentor_requests")
    .select("id, submission_content, final_feedback, status, created_at, reviewed_at")
    .eq("user_id", targetUserId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "server_error", message: "이력을 불러오지 못했어요." }, { status: 500 });
  }

  const requests = (data ?? []).map((r) => ({
    id: r.id,
    submissionContent: r.submission_content,
    // final_feedback은 실제로 발송(status:'sent')된 것만 노출 — approved 단계까지도
    // AI/관리자 작업물이 확정 전이라 보여주지 않는다.
    finalFeedback: r.status === "sent" ? r.final_feedback : null,
    status: r.status,
    createdAt: r.created_at,
    reviewedAt: r.reviewed_at,
  }));

  const remainingSubmissions =
    user.role === "guardian" ? null : MONTHLY_VIP_SUBMISSION_LIMIT - (await countVipSubmissionsThisMonth(supabase, targetUserId));

  return NextResponse.json({ requests, remainingSubmissions });
});
