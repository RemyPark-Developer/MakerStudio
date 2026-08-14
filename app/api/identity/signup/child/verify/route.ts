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

    // TODO(Phase 3): guardianPhone으로 기존 보호자 계정을 찾거나 새로 만들어
    // guardian_child_links에 consent_verified_at = now()로 연결하는 로직 추가.
    // (지금은 보호자 로그인 체계가 아직 없어 이 부분만 미완성 — Dev_Sequence.md 2단계 범위)

    return NextResponse.json({ userId: authUser.user.id, nickname: result.nickname });
  } catch (err) {
    console.error("child signup finalize error:", err);
    return NextResponse.json(
      { error: "server_error", message: "계정 생성 중 문제가 발생했어요. 잠시 후 다시 시도해주세요." },
      { status: 500 }
    );
  }
}
