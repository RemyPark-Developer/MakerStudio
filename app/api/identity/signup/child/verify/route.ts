import { getAuthedUser } from "@/lib/supabase/auth-context";
import { NextRequest, NextResponse } from "next/server";
import { verifyChildSignup } from "@/lib/identity/childSignup";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { verifyToken, smsCode, agreeChildPrivacy } = body ?? {};

  if (!verifyToken || !smsCode) {
    return NextResponse.json(
      { error: "invalid_request", message: "verifyToken과 smsCode가 필요해요." },
      { status: 400 }
    );
  }

  // ⚠️ CLAUDE.md 절대 원칙 4번 — 여기서 반드시 서버가 재검증한다.
  // 클라이언트가 agreeChildPrivacy:true를 보냈다고 그대로 믿지 않는다.
  const result = verifyChildSignup({ verifyToken, smsCode, agreeChildPrivacy });

  if (!result.ok) {
    const messages: Record<string, string> = {
      consent_required: "법정대리인 동의가 확인되지 않았어요.",
      invalid_or_expired_token: "인증이 만료됐어요. 처음부터 다시 시도해주세요.",
      code_mismatch: "인증코드가 일치하지 않아요.",
    };
    return NextResponse.json(
      { error: result.reason, message: messages[result.reason] },
      { status: result.status }
    );
  }

  // 여기까지 왔다는 건 서버가 동의+SMS 코드를 둘 다 재확인했다는 뜻.
  try {
    const supabase = getSupabaseServerClient();

    // auth.users에 계정 생성 (초등학생은 이메일 없이 임시 식별자 사용).
    // 2026-08-14 변경: user_metadata를 넘기면 DB 트리거(0003_auto_create_profile.sql)가
    // profiles를 원자적으로 함께 생성한다 — 별도 insert를 더 이상 하지 않는다.
    // (예전엔 이 둘이 별개 호출이라 "계정은 생겼는데 프로필이 없는" 반쪽 계정이 실제로 발생했음)
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: `child-${crypto.randomUUID()}@placeholder.makerstudio.internal`,
      email_confirm: true,
      user_metadata: { nickname: result.nickname, role: "student_child" },
    });
    if (authError || !authUser?.user) throw authError ?? new Error("auth user creation failed");

    // guardian_child_links 연결: 이 요청을 보낸 브라우저에 로그인된 guardian이 있으면 연결한다.
    // (guardianPhone은 §3.2 법적 요건에 따른 SMS 동의 확인용이고, 실제 연결 주체 식별은
    //  로그인 세션의 guardian id로 하는 게 더 안전하다 - 전화번호 매칭보다 오탐 위험이 없음)
    const guardian = await getAuthedUser(req);
    if (guardian && guardian.role === "guardian") {
      const { error: linkError } = await supabase.from("guardian_child_links").insert({
        guardian_id: guardian.id,
        child_id: authUser.user.id,
        consent_verified_at: new Date().toISOString(),
        consent_method: "sms",
      });
      if (linkError) {
        // 자녀 계정 자체는 생성됐으니 흐름은 계속 진행하고, 연결 실패만 로깅한다.
        console.error("guardian_child_links insert 실패:", JSON.stringify(linkError));
      }
    }
    // guardian이 로그인 안 된 상태(아동 단독 자가가입)라면 연결은 Phase 3 범위로 남는다.
    
    return NextResponse.json({ userId: authUser.user.id, nickname: result.nickname });
  } catch (err) {
    console.error("child signup finalize error:", err);
    return NextResponse.json(
      { error: "server_error", message: "계정 생성 중 문제가 발생했어요. 잠시 후 다시 시도해주세요." },
      { status: 500 }
    );
  }
}
