import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser, requireGuardian, requireGuardianOrAdmin } from "@/lib/supabase/auth-context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/api-error-handler";
import { checkCanAddFamilyMember } from "@/lib/billing/familyMembership";
import { notifyGuardian } from "@/lib/notifications/notify";

/**
 * GET: 내 family_group 상태 + 현재 멤버 + (guardian_child_links 기준) 추가 가능한 자녀 목록.
 * POST: 자녀를 family_group에 추가. 반드시 guardian_child_links로 법적 관계를 먼저 확인한다
 * (checkCanAddFamilyMember, lib/billing/familyMembership.ts).
 */

const ADD_MEMBER_ERROR_MESSAGES: Record<string, string> = {
  not_legal_guardian: "이 아이의 법적 보호자로 등록되어 있지 않아요.",
  no_active_family_plan: "Family 요금제에 가입되어 있지 않아요.",
  already_member: "이미 가족 그룹에 속한 아이예요.",
  seat_limit_reached: "가족 그룹 정원(3명)이 다 찼어요.",
};

export const GET = withErrorHandling(async (req: NextRequest) => {
  const user = await getAuthedUser(req);
  if (!requireGuardianOrAdmin(user)) {
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
    // Family 가입 여부와 무관하게 guardian_child_links 전체 — mypage/billing의 VIP
    // 카드(자녀별 "VIP 시작하기" 버튼)가 재사용한다(2026-08-22, 0035). Family와 VIP는
    // 서로 배타적이지 않은 별개 요금제라 eligibleChildren(family 미가입 자녀)과는 다르다.
    linkedChildren: linked,
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
    return NextResponse.json(
      { error: check.reason, message: ADD_MEMBER_ERROR_MESSAGES[check.reason] },
      { status: check.status }
    );
  }

  // ⚠️ 사전 체크(checkCanAddFamilyMember)를 통과했어도 여기서 다시 막힐 수 있다 —
  // 동시에 들어온 다른 요청이 그 사이 정원을 채웠을 경우. add_family_member RPC가
  // family_groups row를 잠그고 최종 판단을 원자적으로 다시 하는 진짜 소스오브트루스다
  // (2026-08-20 좌석초과 동시성 방어 설계).
  const { data: rpcResult, error: rpcError } = (await supabase
    .rpc("add_family_member", { p_family_group_id: familyGroup!.id, p_child_id: childId })
    .single()) as { data: { ok: boolean; reason: string | null } | null; error: any };

  if (rpcError || !rpcResult) {
    return NextResponse.json({ error: "server_error", message: "추가에 실패했어요." }, { status: 500 });
  }

  if (!rpcResult.ok) {
    const reason = rpcResult.reason as string;
    return NextResponse.json(
      { error: reason, message: ADD_MEMBER_ERROR_MESSAGES[reason] ?? "추가에 실패했어요." },
      { status: 409 }
    );
  }

  const notifyResult = await notifyGuardian({
    guardianId: user.id,
    type: "family_member_added",
    message: "Family 그룹에 아이가 추가됐어요.",
    actionUrl: "/mypage/billing",
  });
  if (!notifyResult.ok) {
    console.error("Family 멤버 추가 알림 실패:", notifyResult.reason);
  }

  return NextResponse.json({ ok: true });
});
