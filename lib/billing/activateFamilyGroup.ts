import { getSupabaseServerClient } from "../supabase/server";
import { notifyGuardian } from "../notifications/notify";
import { selectMembersToRemove } from "./familySeatReconciliation";

export type ActivateFamilyGroupInput = {
  ownerId: string;
  paymentId: string; // 포트원 결제 ID (pg_transaction_id로 저장)
  amount: number;
};

export type ActivateFamilyGroupResult =
  | { ok: true; alreadyProcessed: boolean }
  | { ok: false; reason: string };

const SEAT_LIMIT = 3;

/**
 * checkout/verify와 webhook/portone 양쪽에서 호출된다 (activateSubscription과 동일한 이유).
 * family_groups.owner_id가 유니크라 upsert 자체로 멱등적이지만, payments insert는 그렇지
 * 않으므로 activateSubscription과 동일하게 pg_transaction_id로 먼저 중복 여부를 확인한다
 * (0015_family_payments.sql로 payments.family_group_id가 추가된 이후).
 */
export async function activateFamilyGroup(input: ActivateFamilyGroupInput): Promise<ActivateFamilyGroupResult> {
  const supabase = getSupabaseServerClient();

  const { data: existingPayment } = await supabase
    .from("payments")
    .select("id")
    .eq("pg_transaction_id", input.paymentId)
    .maybeSingle();

  if (existingPayment) {
    return { ok: true, alreadyProcessed: true };
  }

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const { data: group, error: groupError } = await supabase
    .from("family_groups")
    .upsert(
      {
        owner_id: input.ownerId,
        plan_tier: "family",
        seat_limit: SEAT_LIMIT,
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        canceled_at: null,
        updated_at: now.toISOString(),
      },
      { onConflict: "owner_id" }
    )
    .select("id")
    .single();

  if (groupError || !group) {
    return { ok: false, reason: `family_groups 저장 실패: ${groupError?.message}` };
  }

  // ⚠️ 재결제 때마다 seat_limit이 3으로 리셋되므로(위 upsert), 좌석 추가로 4명 이상이던
  // 상태라면 이 시점에 정리가 필요하다 — "좌석 추가는 그 결제 주기 동안만 유효"가 여기서
  // 실제로 성립한다(2026-08-20 좌석 추가/다운그레이드 설계).
  const { data: currentMembers } = await supabase
    .from("family_group_members")
    .select("child_id, added_at, profiles!family_group_members_child_id_fkey(nickname)")
    .eq("family_group_id", group.id);

  const membersToRemove = selectMembersToRemove(
    (currentMembers ?? []).map((m: any) => ({ childId: m.child_id, addedAt: m.added_at })),
    SEAT_LIMIT
  );

  if (membersToRemove.length > 0) {
    await supabase
      .from("family_group_members")
      .delete()
      .eq("family_group_id", group.id)
      .in("child_id", membersToRemove);

    const removedNicknames = (currentMembers ?? [])
      .filter((m: any) => membersToRemove.includes(m.child_id))
      .map((m: any) => (Array.isArray(m.profiles) ? m.profiles[0]?.nickname : m.profiles?.nickname) ?? "이름 없음");

    const reduceNotifyResult = await notifyGuardian({
      guardianId: input.ownerId,
      type: "family_seat_reduced",
      message: `Family 좌석이 ${SEAT_LIMIT}개로 정리되면서 ${removedNicknames.join(", ")} 계정이 Family 그룹에서 제거됐어요. 다시 추가하려면 좌석을 추가 구매해주세요.`,
      actionUrl: "/mypage/billing",
    });
    if (!reduceNotifyResult.ok) {
      console.error("좌석 축소 알림 실패:", reduceNotifyResult.reason);
    }
  }

  const { error: payError } = await supabase.from("payments").insert({
    family_group_id: group.id,
    amount: input.amount,
    status: "success",
    pg_transaction_id: input.paymentId,
  });

  if (payError) {
    return { ok: false, reason: `결제 기록 저장 실패: ${payError.message}` };
  }

  const notifyResult = await notifyGuardian({
    guardianId: input.ownerId,
    type: "payment_success",
    message: `Family 요금제 결제(₩${input.amount.toLocaleString()})가 완료됐어요.`,
    actionUrl: "/mypage/billing",
  });
  if (!notifyResult.ok) {
    console.error("Family 결제 성공 알림 실패:", notifyResult.reason);
  }

  return { ok: true, alreadyProcessed: false };
}
