import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser, requireGuardian } from "@/lib/supabase/auth-context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/api-error-handler";
import { checkCanAddFamilyMember } from "@/lib/billing/familyMembership";

/**
 * GET: 내 family_group 상태 + 현재 멤버 + (guardian_child_links 기준) 추가 가능한 자녀 목록.
 * POST: 자녀를 family_group에 추가. 반드시 guardian_child_links로 법적 관계를 먼저 확인한다
 * (checkCanAddFamilyMember, lib/billing/familyMembership.ts).
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const user = await getAuthedUser(req);
  if (!requireGuardian(user)) {
    return NextResponse.json({ error: "forbidden", message: "보호자만 이용할 수 있어요." }, { status: 403 });
  }

  const supabase = getSupabaseServerClient();

  const { data: familyGroup } = await supabase
    .from("family_groups")
    .select("id, status, seat_limit, current_period_end")
    .eq("owner_id", user.id)
    .maybeSingle();

  const { data: linkedChildren } = await supabase
    .from("guardian_child_links")
    .select("child_id, profiles!guardian_child_links_child_id_fkey(nickname)")
    .eq("guardian_id", user.id);

  const linked = (linkedChildren ?? []).map((row: any) => ({
    childId: row.child_id as string,
    nickname: (row.profiles?.nickname as string | undefined) ?? "이름 없음",
  }));

  let memberChildIds: string[] = [];
  if (familyGroup) {
    const { data: members } = await supabase
      .from("family_group_members")
      .select("child_id")
      .eq("family_group_id", familyGroup.id);
    memberChildIds = (members ?? []).map((m) => m.child_id as string);
  }

  return NextResponse.json({
    familyGroup: familyGroup
      ? {
          status: familyGroup.status,
          seatLimit: familyGroup.seat_limit,
          currentPeriodEnd: familyGroup.current_period_end,
        }
      : null,
    members: linked.filter((c) => memberChildIds.includes(c.childId)),
    eligibleChildren: linked.filter((c) => !memberChildIds.includes(c.childId)),
  });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await getAuthedUser(req);
  if (!requireGuardian(user)) {
    return NextResponse.json({ error: "forbidden", message: "보호자만 이용할 수 있어요." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const childId: string | undefined = body?.childId;
  if (!childId) {
    return NextResponse.json({ error: "invalid_request", message: "childId가 필요해요." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();

  const [{ data: familyGroup }, { data: links }] = await Promise.all([
    supabase.from("family_groups").select("id, status, seat_limit").eq("owner_id", user.id).maybeSingle(),
    supabase.from("guardian_child_links").select("child_id").eq("guardian_id", user.id),
  ]);

  const linkedChildIds = (links ?? []).map((l) => l.child_id as string);

  let currentMemberChildIds: string[] = [];
  if (familyGroup) {
    const { data: members } = await supabase
      .from("family_group_members")
      .select("child_id")
      .eq("family_group_id", familyGroup.id);
    currentMemberChildIds = (members ?? []).map((m) => m.child_id as string);
  }

  const check = checkCanAddFamilyMember({
    childId,
    linkedChildIds,
    familyGroupStatus: familyGroup ? (familyGroup.status as "active" | "canceled") : null,
    currentMemberChildIds,
    seatLimit: familyGroup?.seat_limit ?? 3,
  });

  if (!check.ok) {
    const messages: Record<string, string> = {
      not_legal_guardian: "이 아이의 법적 보호자로 등록되어 있지 않아요.",
      no_active_family_plan: "Family 요금제에 가입되어 있지 않아요.",
      already_member: "이미 가족 그룹에 속한 아이예요.",
      seat_limit_reached: "가족 그룹 정원(3명)이 다 찼어요.",
    };
    return NextResponse.json(
      { error: check.reason, message: messages[check.reason] },
      { status: check.status }
    );
  }

  const { error } = await supabase
    .from("family_group_members")
    .insert({ family_group_id: familyGroup!.id, child_id: childId });

  if (error) {
    return NextResponse.json({ error: "server_error", message: "추가에 실패했어요." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
});
