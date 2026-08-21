import { getSupabaseServerClient } from "../supabase/server";
import { notifyGuardian } from "../notifications/notify";

export type ActivateSubscriptionInput = {
  guardianId: string;
  childId: string;
  planId: string;
  paymentId: string; // 포트원 결제 ID (pg_transaction_id로 저장)
  amount: number;
};

export type ActivateResult =
  | { ok: true; alreadyProcessed: boolean }
  | { ok: false; reason: string };

/**
 * checkout/verify(클라이언트 직후 호출)와 webhook/portone(비동기 최종 확인) 양쪽에서
 * 같은 결제가 중복 처리될 수 있다 — 멱등성을 보장해서 구독이 두 번 갱신되거나
 * payments 행이 중복 생성되지 않게 한다.
 */
export async function activateSubscription(input: ActivateSubscriptionInput): Promise<ActivateResult> {
  const supabase = getSupabaseServerClient();

  // 이미 이 paymentId로 처리된 적 있는지 먼저 확인 (멱등성 핵심).
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

  const { data: sub, error: subError } = await supabase
    .from("subscriptions")
    .upsert(
      {
        guardian_id: input.guardianId,
        child_id: input.childId,
        plan: input.planId,
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        canceled_at: null,
        // 재구독 = 해지 후 30일 데이터 보관 대상에서 제외(0036). purge-expired-data.ts는
        // data_retention_until이 지난 것만 대상으로 삼으므로, null로 되돌리면 자동으로
        // 대상에서 빠진다 — 별도 "복원" 로직 불필요.
        data_retention_until: null,
      },
      { onConflict: "guardian_id,child_id" }
    )
    .select("id")
    .single();

  if (subError || !sub) {
    return { ok: false, reason: `구독 저장 실패: ${subError?.message}` };
  }

  const { error: payError } = await supabase.from("payments").insert({
    subscription_id: sub.id,
    amount: input.amount,
    status: "success",
    pg_transaction_id: input.paymentId,
  });

  if (payError) {
    return { ok: false, reason: `결제 기록 저장 실패: ${payError.message}` };
  }

  const notifyResult = await notifyGuardian({
    guardianId: input.guardianId,
    type: "payment_success",
    message: `${input.planId === "premium" ? "Premium" : input.planId} 구독 결제(₩${input.amount.toLocaleString()})가 완료됐어요.`,
    actionUrl: "/mypage/billing",
  });
  if (!notifyResult.ok) {
    console.error("결제 성공 알림 실패:", notifyResult.reason);
  }

  return { ok: true, alreadyProcessed: false };
}
