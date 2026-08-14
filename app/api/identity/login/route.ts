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
    // 이메일 존재 여부를 노출하지 않기 위해 항상 같은 메시지 (Auth_Flow.md §2.4)
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
