import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAuthClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/api-error-handler";

export const POST = withErrorHandling(async (req: NextRequest) => {
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

  // ⚠️ 이전엔 resetToken을 검증 없이 무시하고 service_role 싱글턴에 남아있던(다른
  // 요청이 로그인해서 오염시켰을 수 있는) 세션의 비밀번호를 그대로 바꾸고 있었다 —
  // 다른 사용자의 비밀번호가 바뀔 수 있는 심각한 버그였음(2026-08-21 발견·수정).
  // 매 요청 새로 만드는 클라이언트에서, resetToken으로 실제로 그 사용자 세션을
  // 검증(verifyOtp)한 뒤에만 같은 클라이언트로 updateUser를 호출한다 — 이 클라이언트는
  // 이 요청 하나가 끝나면 버려지므로 다른 요청과 세션이 섞일 수 없다.
  const supabase = createSupabaseAuthClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: resetToken,
    type: "recovery",
  });

  if (verifyError) {
    return NextResponse.json(
      { error: "invalid_or_expired_token", message: "재설정 링크가 만료됐어요. 다시 시도해주세요." },
      { status: 401 }
    );
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    return NextResponse.json(
      { error: "invalid_or_expired_token", message: "재설정 링크가 만료됐어요. 다시 시도해주세요." },
      { status: 401 }
    );
  }

  return NextResponse.json({ ok: true });
});
