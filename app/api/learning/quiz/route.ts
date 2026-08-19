import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase/auth-context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/api-error-handler";

export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const moduleId: string | undefined = body?.moduleId;
  const score: number | undefined = body?.score;
  const passed: boolean | undefined = body?.passed;
  const answers = body?.answers ?? null;

  if (!moduleId || typeof score !== "number" || typeof passed !== "boolean") {
    return NextResponse.json(
      { error: "invalid_request", message: "moduleId, score, passed가 필요해요." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("submit_quiz_attempt", {
    p_user_id: user.id,
    p_module_id: moduleId,
    p_score: score,
    p_passed: passed,
    p_answers: answers,
  });

  if (error) {
    return NextResponse.json({ error: "server_error", message: "퀴즈 제출에 실패했어요." }, { status: 500 });
  }

  return NextResponse.json({ result: data?.[0] ?? null });
});