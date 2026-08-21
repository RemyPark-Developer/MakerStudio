import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAuthClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email: string | undefined = body?.email?.trim();

  if (!email) {
    return NextResponse.json(
      { error: "invalid_request", message: "이메일을 입력해주세요." },
      { status: 400 }
    );
  }

  // ⚠️ Auth_Flow.md §2.5-2: 가입 여부와 무관하게 항상 200을 반환한다.
  // (계정 탐색 공격 방지 — "이 이메일로 가입한 계정이 있다/없다"를 노출하지 않음)
  try {
    // resetPasswordForEmail 자체는 세션을 안 바꾸지만, 이 4개 인증 라우트는 통일해서
    // service_role 싱글턴을 절대 안 쓰는 걸 원칙으로 한다(createSupabaseAuthClient 주석 참고).
    const supabase = createSupabaseAuthClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/reset-password`,
    });
  } catch (err) {
    // Supabase 설정 문제든, 존재하지 않는 이메일이든 — 응답은 절대 달라지지 않는다.
    console.error("password/forgot internal error (응답에는 노출 안 함):", err);
  }

  return NextResponse.json({ ok: true });
}
