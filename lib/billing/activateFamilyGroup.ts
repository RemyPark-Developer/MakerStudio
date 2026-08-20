import { getSupabaseServerClient } from "../supabase/server";
import { notifyGuardian } from "../notifications/notify";

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
