import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase/auth-context";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("progress")
    .select("example_id, step, updated_at")
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: "server_error", message: "진도를 불러오지 못했어요." }, { status: 500 });
  }

  return NextResponse.json({ progress: data ?? [] });
}

export async function POST(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const exampleId: string | undefined = body?.exampleId;
  const step: number | undefined = body?.step;

  if (!exampleId || typeof step !== "number" || step < 0) {
    return NextResponse.json(
      { error: "invalid_request", message: "exampleId와 step(0 이상)이 필요해요." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  // upsert: (user_id, example_id) 조합이 이미 있으면 갱신, 없으면 새로 생성 (DB_Schema.md UNIQUE 제약과 일관)
  const { error } = await supabase.from("progress").upsert(
    { user_id: user.id, example_id: exampleId, step, updated_at: new Date().toISOString() },
    { onConflict: "user_id,example_id" }
  );

  if (error) {
    return NextResponse.json({ error: "server_error", message: "진도 저장에 실패했어요." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
