import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase/auth-context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/api-error-handler";

export const POST = withErrorHandling(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await getAuthedUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const action: "approve" | "reject" | undefined = body?.action;
  const note: string | undefined = body?.note;

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      { error: "invalid_request", message: "action은 approve 또는 reject여야 해요." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();

  // 승인/반려 둘 다 지금 상태가 pending_review 또는 automation_stuck일 때만 허용
  // (이미 published된 걸 실수로 다시 승인 누르는 것 방지)
  const { data: current } = await supabase
    .from("content_modules")
    .select("status")
    .eq("id", id)
    .maybeSingle();

  if (!current) {
    return NextResponse.json({ error: "not_found", message: "콘텐츠를 찾을 수 없어요." }, { status: 404 });
  }
  if (current.status !== "pending_review" && current.status !== "automation_stuck") {
    return NextResponse.json(
      { error: "invalid_state", message: `현재 상태(${current.status})에서는 처리할 수 없어요.` },
      { status: 409 }
    );
  }

  const newStatus = action === "approve" ? "published" : "withdrawn";

  const { error } = await supabase
    .from("content_modules")
    .update({
      status: newStatus,
      reviewed_by: user.id,
      review_note: note ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "server_error", message: "처리에 실패했어요." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: newStatus });
});