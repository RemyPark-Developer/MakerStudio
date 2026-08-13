import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const resetToken: string | undefined = body?.resetToken;
  const newPassword: string | undefined = body?.newPassword;

  if (!resetToken || !newPassword) {
    return NextResponse.json(
      { error: "invalid_request", message: "resetToken과 newPassword가 필요해요." },
      { status: 400 }
    );
  }
  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "invalid_request", message: "비밀번호는 8자 이상이어야 해요.", field: "newPassword" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  // Supabase의 재설정 토큰 검증 방식(verifyOtp 등)은 실제 프로젝트 설정에 맞춰 연결.
  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    return NextResponse.json(
      { error: "invalid_or_expired_token", message: "재설정 링크가 만료됐어요. 다시 시도해주세요." },
      { status: 401 }
    );
  }

  return NextResponse.json({ ok: true });
}
