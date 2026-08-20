import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase/auth-context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/api-error-handler";

const STATUS_GROUPS: Record<string, string[]> = {
  pending: ["pending_review", "automation_stuck"],
  published: ["published"],
  withdrawn: ["withdrawn"],
  all: ["draft", "pending_review", "published", "withdrawn", "automation_stuck"],
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
    .from("content_modules")
    .select("id, label_ko, board, difficulty, estimated_minutes, status, retry_count, created_at, last_verified_at, reviewed_by, review_note, updated_at")
    .in("status", statuses)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "server_error", message: "목록을 불러오지 못했어요." }, { status: 500 });
  }

  // reviewed_by(UUID)를 닉네임으로 변환
  const reviewerIds = [...new Set((data ?? []).map((m) => m.reviewed_by).filter(Boolean))];
  let reviewerMap: Record<string, string> = {};

  if (reviewerIds.length > 0) {
    const { data: reviewers } = await supabase
      .from("profiles")
      .select("id, nickname")
      .in("id", reviewerIds);
    reviewerMap = Object.fromEntries((reviewers ?? []).map((r) => [r.id, r.nickname ?? "관리자"]));
  }

  const modules = (data ?? []).map((m) => ({
    ...m,
    reviewer_nickname: m.reviewed_by ? reviewerMap[m.reviewed_by] ?? "관리자" : null,
  }));

  return NextResponse.json({ modules });
});