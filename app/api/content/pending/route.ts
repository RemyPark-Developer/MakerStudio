import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase/auth-context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/api-error-handler";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const user = await getAuthedUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("content_modules")
    .select("id, label_ko, board, difficulty, estimated_minutes, status, retry_count, created_at, last_verified_at")
    .in("status", ["pending_review", "automation_stuck"])
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "server_error", message: "목록을 불러오지 못했어요." }, { status: 500 });
  }

  return NextResponse.json({ modules: data ?? [] });
});