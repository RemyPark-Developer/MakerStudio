import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase/auth-context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/api-error-handler";

export const GET = withErrorHandling(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await getAuthedUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("content_modules")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "server_error", message: "조회에 실패했어요." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not_found", message: "해당 콘텐츠를 찾을 수 없어요." }, { status: 404 });
  }

  return NextResponse.json({ module: data });
});