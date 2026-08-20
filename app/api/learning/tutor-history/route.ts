import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase/auth-context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/api-error-handler";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const requestedChildId = searchParams.get("childId");

  const supabase = getSupabaseServerClient();

  // 조회 대상 user_id 결정: 기본은 본인, childId가 있으면 guardian 권한 검증 후 자녀로 전환
  let targetUserId = user.id;

  if (requestedChildId) {
    if (user.role !== "guardian") {
      return NextResponse.json({ error: "forbidden", message: "보호자만 자녀 기록을 볼 수 있어요." }, { status: 403 });
    }
    const { data: link } = await supabase
      .from("guardian_child_links")
      .select("child_id")
      .eq("guardian_id", user.id)
      .eq("child_id", requestedChildId)
      .maybeSingle();

    if (!link) {
      return NextResponse.json({ error: "forbidden", message: "연결되지 않은 자녀 계정이에요." }, { status: 403 });
    }
    targetUserId = requestedChildId;
  }

  const { data: messages, error } = await supabase
    .from("tutor_messages")
    .select("id, example_id, role, content, created_at, flagged, flag_reason")
    .eq("user_id", targetUserId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "server_error", message: "대화 기록을 불러오지 못했어요." }, { status: 500 });
  }

  // example_id 별로 그룹핑해서 강의별 대화로 묶어 반환
  const grouped: Record<string, typeof messages> = {};
  for (const m of messages ?? []) {
    if (!grouped[m.example_id]) grouped[m.example_id] = [];
    grouped[m.example_id].push(m);
  }

  return NextResponse.json({ conversations: grouped });
});
