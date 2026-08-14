import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/api-error-handler";

/**
 * 중고등/성인 이메일 회원가입.
 * ⚠️ API_Spec_v1.0.md에는 원래 없던 엔드포인트 — 이메일/비밀번호 로그인(login/route.ts)은
 * 있는데 그 계정을 만드는 경로가 빠져있던 걸 실제 구현 중 발견해서 추가함.
 * 다음 API 명세서 개정 시 이 엔드포인트를 문서에도 반영할 것.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  const email: string | undefined = body?.email?.trim();
  const password: string | undefined = body?.password;
  const nickname: string | undefined = body?.nickname?.trim();

  if (!email || !password || !nickname) {
    return NextResponse.json(
      { error: "invalid_request", message: "이메일, 비밀번호, 닉네임을 모두 입력해주세요." },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "invalid_request", message: "비밀번호는 8자 이상이어야 해요.", field: "password" },
      { status: 400 }
    );
  }
  if (nickname.length > 10) {
    return NextResponse.json(
      { error: "invalid_request", message: "닉네임은 10자 이하로 입력해주세요.", field: "nickname" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // TODO(Phase 3): 실제 이메일 인증 링크 발송으로 전환, 지금은 즉시 확정
  });
  if (authError || !authData?.user) {
    return NextResponse.json(
      { error: "signup_failed", message: authError?.message ?? "가입에 실패했어요." },
      { status: 400 }
    );
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: authData.user.id,
    role: "student_teen", // §3.3: 소셜/이메일 가입은 만 14세 이상으로 간주
    nickname,
  });
  if (profileError) {
    return NextResponse.json(
      { error: "server_error", message: "프로필 생성 중 문제가 발생했어요." },
      { status: 500 }
    );
  }

  return NextResponse.json({ userId: authData.user.id });
});
