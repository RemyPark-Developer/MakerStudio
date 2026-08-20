import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/api-error-handler";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const token = authHeader.slice("Bearer ".length);
  const supabase = getSupabaseServerClient();

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, nickname, avatar, phone")
    .eq("id", authData.user.id)
    .maybeSingle();

  // 2026-08-14 변경: 이제 DB 트리거(0003)가 auth.users 생성 즉시 profiles 행을 항상 만들기
  // 때문에, "행이 있는지"가 아니라 "닉네임이 채워졌는지"로 온보딩 필요 여부를 판단해야 한다.
  // (트리거 도입 전엔 "행 없음 = 최초 소셜 가입"이었지만, 이제 행은 항상 있고 닉네임만 비어있음)
  if (!profile || !profile.nickname) {
    return NextResponse.json({ needsNickname: true });
  }

  // guardian이면 내 자녀의 id도 같이 내려준다 (현재 스코프: guardian 1명 = 자녀 1명, 설계서 §10 참고)
  let childId: string | null = null;
  if (profile.role === "guardian") {
    const { data: child } = await supabase
      .from("guardian_child_links")
      .select("child_id")
      .eq("guardian_id", authData.user.id)
      .maybeSingle();
      childId = child?.child_id ?? null;
  }

  return NextResponse.json({
    needsNickname: false,
    id: authData.user.id,
    email: authData.user.email ?? null,
    ...profile,
    childId,
  });
});

export const PATCH = withErrorHandling(async (req: NextRequest) => {
  const user = await getAuthedUserOrNewSocialUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const nickname: string | undefined = body?.nickname?.trim();
  const avatar: string | undefined = body?.avatar;
  const role: string | undefined = body?.role;
  const phone: string | undefined = body?.phone?.trim();

  if (nickname && nickname.length > 10) {
    return NextResponse.json(
      { error: "invalid_request", message: "닉네임은 10자 이하로 입력해주세요.", field: "nickname" },
      { status: 400 }
    );
  }
  if (phone && !/^01[0-9]-?\d{3,4}-?\d{4}$/.test(phone)) {
    return NextResponse.json(
      { error: "invalid_request", message: "휴대폰번호 형식을 확인해주세요.", field: "phone" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();

  // profiles 행이 아직 없으면(최초 온보딩) upsert, 있으면 업데이트만.
  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      ...(nickname ? { nickname } : {}),
      ...(avatar ? { avatar } : {}),
      ...(phone ? { phone } : {}),
      // 최초 온보딩에서만 role을 정한다 — 이미 있는 사용자의 role은 이 라우트로 못 바꾸게(§3.3 원칙과 일관)
      ...(role && user.isNew ? { role } : {}),
    },
    { onConflict: "id" }
  );

  if (error) {
    return NextResponse.json({ error: "server_error", message: "프로필 저장에 실패했어요." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
});

async function getAuthedUserOrNewSocialUser(
  req: NextRequest
): Promise<{ id: string; isNew: boolean } | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length);

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", data.user.id)
    .maybeSingle();

  // 2026-08-14 변경: 트리거가 행을 항상 만들어두므로, "행 없음"이 아니라 "닉네임 없음"으로
  // 최초 온보딩 여부를 판단한다 (GET 핸들러와 동일한 기준으로 통일).
  return { id: data.user.id, isNew: !profile?.nickname };
}
