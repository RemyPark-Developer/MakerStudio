import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
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
    .select("role, nickname, avatar")
    .eq("id", authData.user.id)
    .maybeSingle();

  // Auth_Flow.md §2.1 — auth.users엔 있지만 profiles가 없으면 "최초 소셜 가입, 온보딩 필요"
  if (!profile) {
    return NextResponse.json({ needsNickname: true });
  }

  return NextResponse.json({ needsNickname: false, ...profile });
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthedUserOrNewSocialUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const nickname: string | undefined = body?.nickname?.trim();
  const avatar: string | undefined = body?.avatar;
  const role: string | undefined = body?.role;

  if (nickname && nickname.length > 10) {
    return NextResponse.json(
      { error: "invalid_request", message: "닉네임은 10자 이하로 입력해주세요.", field: "nickname" },
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
      // 최초 온보딩에서만 role을 정한다 — 이미 있는 사용자의 role은 이 라우트로 못 바꾸게(§3.3 원칙과 일관)
      ...(role && user.isNew ? { role } : {}),
    },
    { onConflict: "id" }
  );

  if (error) {
    return NextResponse.json({ error: "server_error", message: "프로필 저장에 실패했어요." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

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
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();

  return { id: data.user.id, isNew: !profile };
}
