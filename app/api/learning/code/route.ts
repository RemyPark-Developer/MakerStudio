import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase/auth-context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/api-error-handler";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("saved_codes")
    .select("id, example_id, code, saved_at")
    .eq("user_id", user.id)
    .order("saved_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "server_error", message: "저장한 코드를 불러오지 못했어요." },
      { status: 500 }
    );
  }

  return NextResponse.json({ codes: data ?? [] });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const exampleId: string | undefined = body?.exampleId;
  const code: string | undefined = body?.code;

  if (!exampleId || !code || !code.trim()) {
    return NextResponse.json(
      { error: "invalid_request", message: "exampleId와 code가 필요해요." },
      { status: 400 }
    );
  }
  // 아주 관대한 상한선 — 실수로 거대한 텍스트가 저장되는 것만 방지 (실제 컴파일 검증은 Phase 2/Wokwi 몫)
  if (code.length > 20000) {
    return NextResponse.json(
      { error: "invalid_request", message: "코드가 너무 길어요." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("saved_codes")
    .insert({ user_id: user.id, example_id: exampleId, code });

  if (error) {
    return NextResponse.json({ error: "server_error", message: "코드 저장에 실패했어요." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
});
