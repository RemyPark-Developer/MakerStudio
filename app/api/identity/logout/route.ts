import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "unauthorized", message: "로그인이 필요해요." }, { status: 401 });
  }
  const token = authHeader.slice("Bearer ".length);

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.auth.admin.signOut(token);

  if (error) {
    return NextResponse.json({ error: "server_error", message: "로그아웃 처리 중 문제가 발생했어요." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
