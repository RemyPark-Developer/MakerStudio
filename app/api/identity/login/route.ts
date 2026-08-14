import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/api-error-handler";

export const POST = withErrorHandling(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  const email: string | undefined = body?.email?.trim();
  const password: string | undefined = body?.password;

  if (!email || !password) {
    return NextResponse.json(
      { error: "invalid_request", message: "이메일과 비밀번호를 입력해주세요." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    // 이메일 미확인 상태는 별도로 안내한다 — "정확히 이 이메일로 가입된 계정이 있다"를
    // 어느 정도 드러내는 트레이드오프가 있지만(§2.4의 "이메일 존재 노출 방지" 원칙과 약간 배치),
    // "왜 로그인이 안 되는지" 알려주는 실질적 UX 이득이 더 크다고 판단해 이번엔 예외로 둔다.
    if (error?.code === "email_not_confirmed" || error?.message?.toLowerCase().includes("not confirmed")) {
      return NextResponse.json(
        {
          error: "email_not_confirmed",
          message: "이메일 인증이 아직 안 됐어요. 가입하실 때 받은 메일의 링크를 눌러주세요.",
        },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: "invalid_credentials", message: "이메일 또는 비밀번호가 올바르지 않아요." },
      { status: 401 }
    );
  }

  return NextResponse.json({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
  });
});
