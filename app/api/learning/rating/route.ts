import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase/auth-context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/api-error-handler";

/**
 * 콘텐츠 평점(1~5 정수, 자유 텍스트 없음). 사용자당 콘텐츠 하나에 평점 1개 —
 * POST가 upsert라 재제출하면 수정된다. 개별 평점 조회/기록은 본인 것만
 * (supabase/migrations/0037_content_stats.sql의 RLS), 집계는 content_rating_summary 뷰로
 * 별도 공개.
 */

export const GET = withErrorHandling(async (req: NextRequest) => {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const moduleId = searchParams.get("moduleId");
  if (!moduleId) {
    return NextResponse.json({ error: "invalid_request", message: "moduleId가 필요해요." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("content_ratings")
    .select("rating")
    .eq("user_id", user.id)
    .eq("module_id", moduleId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "server_error", message: "평점을 불러오지 못했어요." }, { status: 500 });
  }

  return NextResponse.json({ rating: data?.rating ?? null });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const moduleId: string | undefined = body?.moduleId;
  const rating: number | undefined = body?.rating;

  if (!moduleId) {
    return NextResponse.json({ error: "invalid_request", message: "moduleId가 필요해요." }, { status: 400 });
  }
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: "invalid_request", message: "평점은 1~5 사이의 정수여야 해요.", field: "rating" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("content_ratings").upsert(
    { user_id: user.id, module_id: moduleId, rating, updated_at: new Date().toISOString() },
    { onConflict: "user_id,module_id" }
  );

  if (error) {
    return NextResponse.json({ error: "server_error", message: "평점 저장에 실패했어요." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
});
