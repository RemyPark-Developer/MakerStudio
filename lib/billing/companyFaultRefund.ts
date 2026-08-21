import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 회사 귀책(중복결제·시스템오류) 전액환불 판단 — payments.refund_reason(0031)이 채워진
 * 가장 최근 성공 결제 건을 찾는다. 있으면 refund/calculate가 기간·사용여부 계산을 건너뛰고
 * 이 결제의 실제 결제금액을 그대로 전액환불한다.
 *
 * subscription_id/family_group_id는 payments 테이블에서 서로 배타적(0015)이라, 호출하는
 * 쪽에서 둘 중 이미 알고 있는 하나만 넘긴다.
 *
 * DB 조회가 핵심이라 순수 함수가 아니다 — lib/billing/familyUsage.ts와 동일한 패턴.
 */
export async function findCompanyFaultPayment(
  supabase: SupabaseClient,
  input: { subscriptionId?: string; familyGroupId?: string }
): Promise<{ id: string; amount: number; refundReason: string } | null> {
  const { subscriptionId, familyGroupId } = input;

  let query = supabase
    .from("payments")
    .select("id, amount, refund_reason")
    .eq("status", "success")
    .not("refund_reason", "is", null)
    .order("paid_at", { ascending: false })
    .limit(1);

  query = subscriptionId
    ? query.eq("subscription_id", subscriptionId)
    : query.eq("family_group_id", familyGroupId);

  const { data } = await query.maybeSingle();
  if (!data) return null;

  return { id: data.id, amount: data.amount, refundReason: data.refund_reason as string };
}
