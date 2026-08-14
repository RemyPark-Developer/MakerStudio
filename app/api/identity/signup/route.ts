import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/api-error-handler";
import { sendVerificationEmail } from "@/lib/email/resend";

/**
 * 중고등/성인 이메일 회원가입.
 * ⚠️ API_Spec_v1.0.md에는 원래 없던 엔드포인트 — 이메일/비밀번호 로그인(login/route.ts)은
 * 있는데 그 계정을 만드는 경로가 빠져있던 걸 실제 구현 중 발견해서 추가함.
 * 다음 API 명세서 개정 시 이 엔드포인트를 문서에도 반영할 것.
 *
 * 2026-08-14 변경: 이메일 소유를 실제로 확인하지 않고 즉시 로그인 가능한 계정을 만들던 문제를
 * 발견해서(email_confirm: true로 항상 즉시 확정) 고침 — 존재하지 않는 이메일로도 가입이 됐었음.
 * 이제 email_confirm: false로 만들고, 실제 확인 메일을 보낸 뒤 클릭해야 로그인 가능해진다.
 * (구글/네이버 벤치마킹 결과 — CI 기반 완전 중복차단은 아동 대상 서비스에 과한 개인정보 수집이라
 * 채택 안 함, 이메일 실소유 확인이 지금 규모에 맞는 선)
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

  // profiles를 별도로 insert하지 않는다 — user_metadata를 넘기면 DB 트리거(0003)가 원자적으로 처리한다.
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: false, // ⚠️ 실제 이메일 확인 전까지는 미확정 상태로 만든다
    user_metadata: { role: "student_teen", nickname }, // §3.3: 소셜/이메일 가입은 만 14세 이상으로 간주
  });
  if (authError || !authData?.user) {
    return NextResponse.json(
      { error: "signup_failed", message: authError?.message ?? "가입에 실패했어요." },
      { status: 400 }
    );
  }

  // 실제 확인 링크 생성 + 발송. 여기서 실패하면 계정은 만들어졌지만 미확정 상태로 남는다 —
  // "메일을 보냈다"고 거짓으로 성공 처리하지 않고, 사용자에게 정직하게 실패를 알린다.
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "signup",
      email,
      password,
      options: { redirectTo: `${appUrl}/login?verified=1` },
    });
    if (linkError || !linkData?.properties?.action_link) {
      throw linkError ?? new Error("확인 링크 생성 실패");
    }
    await sendVerificationEmail(email, linkData.properties.action_link);
  } catch (err) {
    console.error("이메일 인증 발송 실패:", err);
    return NextResponse.json(
      {
        error: "email_send_failed",
        message: "계정은 만들어졌지만 확인 메일 발송에 실패했어요. 잠시 후 다시 시도하거나 문의해주세요.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ userId: authData.user.id, needsEmailVerification: true });
});
