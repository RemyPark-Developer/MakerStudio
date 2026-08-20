import { getSupabaseServerClient } from "../supabase/server";
import { notifyGuardian } from "../notifications/notify";

export type ActivateFamilySeatAddonInput = {
  guardianId: string;
  paymentId: string; // 포트원 결제 ID (pg_transaction_id로 저장)
  amount: number;
  seats?: number; // 이번 결제로 늘리는 좌석 수 — 지금은 결제 1건 = 1좌석만 지원
};

export type ActivateFamilySeatAddonResult =
  | { ok: true; alreadyProcessed: boolean }
  | { ok: false; reason: string };

const MAX_SEAT_LIMIT = 6;

/**
 * checkout/verify와 webhook/portone 양쪽에서 호출된다 (activateSubscription/
 * activateFamilyGroup과 동일한 이유) — pg_transaction_id로 멱등성 확인.
 *
 * ⚠️ current_period_start/end는 절대 안 건드린다 — 이 결제는 요금제 재결제가 아니라
 * "이번 결제 주기 동안만 유효한 좌석 추가"다. 다음 Family 재결제 때
 * activateFamilyGroup()이 seat_limit을 3으로 다시 upsert하면서 자동으로 리셋된다.
 */
export async function activateFamilySeatAddon(
  input: ActivateFamilySeatAddonInput
): Promise<ActivateFamilySeatAddonResult> {
  const supabase = getSupabaseServerClient();
  const seatsToAdd = input.seats ?? 1;

  const { data: existingPayment } = await supabase
    .from("payments")
    .select("id")
    .eq("pg_transaction_id", input.paymentId)
    .maybeSingle();

  if (existingPayment) {
    return { ok: true, alreadyProcessed: true };
  }

  const { data: group, error: groupError } = await supabase
    .from("family_groups")
    .select("id, seat_limit, status")
    .eq("owner_id", input.guardianId)
    .eq("status", "active")
    .maybeSingle();

  if (groupError || !group) {
    return { ok: false, reason: "활성 Family 요금제가 없어요." };
  }

  const newSeatLimit = Math.min(group.seat_limit + seatsToAdd, MAX_SEAT_LIMIT);
  if (newSeatLimit === group.seat_limit) {
    return { ok: false, reason: `좌석은 최대 ${MAX_SEAT_LIMIT}개까지만 늘릴 수 있어요.` };
  }

  const { error: updateError } = await supabase
    .from("family_groups")
    .update({ seat_limit: newSeatLimit, updated_at: new Date().toISOString() })
    .eq("id", group.id);

  if (updateError) {
    return { ok: false, reason: `좌석 추가 실패: ${updateError.message}` };
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
    guardianId: input.guardianId,
    type: "family_seat_added",
    message: `Family 좌석이 ${newSeatLimit}개로 늘었어요(₩${input.amount.toLocaleString()}). 이번 결제 주기 동안만 유효해요.`,
    actionUrl: "/mypage/billing",
  });
  if (!notifyResult.ok) {
    console.error("좌석 추가 알림 실패:", notifyResult.reason);
  }

  return { ok: true, alreadyProcessed: false };
}
