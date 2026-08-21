import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase/auth-context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/api-error-handler";

const STATUS_GROUPS: Record<string, string[]> = {
  // 'submitted'도 검수 대기에 포함 — AI 초안 생성이 실패했거나(재시도 필요) 안전필터에
  // 걸려 flagged된 건도 관리자가 여기서 확인할 수 있어야 한다.
  pending: ["submitted", "ai_drafted"],
  sent: ["sent"],
  all: ["submitted", "ai_drafted", "approved", "sent"],
};

export const GET = withErrorHandling(async (req: NextRequest) => {
  const user = await getAuthedUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status") ?? "pending";
  const statuses = STATUS_GROUPS[statusParam] ?? STATUS_GROUPS.pending;

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("vip_mentor_requests")
    .select("id, user_id, status, flagged, created_at, reviewed_at")
    .in("status", statuses)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "server_error", message: "목록을 불러오지 못했어요." }, { status: 500 });
  }

  const userIds = [...new Set((data ?? []).map((r) => r.user_id))];
  let nicknameMap: Record<string, string> = {};

  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, nickname").in("id", userIds);
    nicknameMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.nickname ?? "이름 없음"]));
  }

  const requests = (data ?? []).map((r) => ({
    ...r,
    student_nickname: nicknameMap[r.user_id] ?? "이름 없음",
  }));

  return NextResponse.json({ requests });
});
