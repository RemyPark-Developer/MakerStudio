import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase/auth-context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/api-error-handler";
import { hasVipAccess } from "@/lib/content/gate";
import { checkInputSafety } from "@/lib/learning/tutorSafety";
import { generateVipDraftFeedback } from "@/lib/learning/vipMentorDraft";
import { countVipSubmissionsThisMonth, MONTHLY_VIP_SUBMISSION_LIMIT } from "@/lib/learning/vipQuota";
import { notifyGuardian } from "@/lib/notifications/notify";

const MAX_SUBMISSION_LENGTH = 8000; // vip_mentor_requests.submission_content의 DB 제약과 동일

/**
 * Premium VIP 학생이 프로젝트/코드를 제출한다. AI 초안은 이 요청 안에서 동기 생성하되
 * (app/api/content/generate/route.ts와 동일 패턴), 학생에게는 절대 노출하지 않는다 —
 * 관리자가 검토·수정해서 "승인 후 발송"해야만 학생/보호자가 볼 수 있다(0035 설계 원칙).
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await getAuthedUser(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (user.role !== "student_child" && user.role !== "student_teen") {
    return NextResponse.json(
      { error: "forbidden", message: "학생 계정만 VIP 멘토링을 제출할 수 있어요." },
      { status: 403 }
    );
  }
  if (!(await hasVipAccess(user))) {
    return NextResponse.json(
      { error: "forbidden", message: "Premium VIP 구독자만 이용할 수 있어요." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const submissionContent: string | undefined = body?.submissionContent;

  if (!submissionContent || typeof submissionContent !== "string" || !submissionContent.trim()) {
    return NextResponse.json(
      { error: "invalid_request", message: "submissionContent가 필요해요." },
      { status: 400 }
    );
  }
  if (submissionContent.length > MAX_SUBMISSION_LENGTH) {
    return NextResponse.json(
      { error: "invalid_request", message: `제출 내용은 ${MAX_SUBMISSION_LENGTH}자 이내로 작성해주세요.` },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();

  // ⚠️ 안전 필터는 월 한도 소비 전에 실행한다 — AI 튜터와 동일 원칙(걸린 시도는 Anthropic을
  // 호출하지 않으니 quota도 안 깎는다).
  const safety = checkInputSafety(submissionContent);
  if (!safety.ok) {
    await supabase.from("vip_mentor_requests").insert({
      user_id: user.id,
      submission_content: safety.redactedText,
      status: "submitted",
      flagged: true,
      flag_reason: safety.reason,
    });

    if (user.role === "student_child") {
      const { data: link } = await supabase
        .from("guardian_child_links")
        .select("guardian_id")
        .eq("child_id", user.id)
        .maybeSingle();

      if (link?.guardian_id) {
        const notifyResult = await notifyGuardian({
          guardianId: link.guardian_id,
          type: "vip_submission_flagged",
          message:
            safety.reason === "pii"
              ? "자녀가 VIP 멘토링에 개인정보로 보이는 내용을 제출해서, 그 제출은 처리하지 않았어요."
              : "자녀가 VIP 멘토링에 부적절한 표현을 제출해서, 그 제출은 처리하지 않았어요.",
          actionUrl: "/mypage/vip",
        });
        if (!notifyResult.ok) {
          console.error("vip_submission_flagged 알림 실패:", notifyResult.reason);
        }
      }
    }

    return NextResponse.json({
      blocked: true,
      message:
        safety.reason === "pii"
          ? "개인정보(전화번호, 주민등록번호 등)는 제출 내용에 포함하지 않아도 괜찮아요. 수정 후 다시 제출해주세요."
          : "부적절한 표현은 제출할 수 없어요. 수정 후 다시 제출해주세요.",
    });
  }

  const submittedThisMonth = await countVipSubmissionsThisMonth(supabase, user.id);
  if (submittedThisMonth >= MONTHLY_VIP_SUBMISSION_LIMIT) {
    return NextResponse.json(
      {
        error: "quota_exceeded",
        message: `이번 달 VIP 멘토링 제출 횟수(${MONTHLY_VIP_SUBMISSION_LIMIT}회)를 다 썼어요. 다음 달에 다시 제출해주세요.`,
      },
      { status: 429 }
    );
  }

  const { data: row, error: insertError } = await supabase
    .from("vip_mentor_requests")
    .insert({ user_id: user.id, submission_content: submissionContent, status: "submitted" })
    .select("id")
    .single();

  if (insertError || !row) {
    return NextResponse.json(
      { error: "server_error", message: "제출 저장에 실패했어요." },
      { status: 500 }
    );
  }

  // AI 초안 생성 실패해도 제출 자체는 이미 성공했으니 학생에게는 에러로 보이지 않게 한다 —
  // status가 'submitted'로 남아 관리자가 검수 목록에서 수동으로 확인/재시도할 수 있다.
  try {
    const draft = await generateVipDraftFeedback(submissionContent);
    await supabase
      .from("vip_mentor_requests")
      .update({ ai_draft_feedback: draft, status: "ai_drafted" })
      .eq("id", row.id);
  } catch (err) {
    console.error("VIP AI 초안 생성 실패:", err);
  }

  return NextResponse.json({
    ok: true,
    message: "제출이 접수됐어요. 관리자 검토 후 결과를 알려드릴게요.",
  });
});
