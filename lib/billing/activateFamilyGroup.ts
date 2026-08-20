import { getSupabaseServerClient } from "../supabase/server";

export type ActivateFamilyGroupInput = {
  ownerId: string;
  paymentId: string; // 로그용 — payments 테이블은 이번 범위에서 안 쓰지만 진단을 위해 남겨둠
  amount: number;
};

export type ActivateFamilyGroupResult = { ok: true } | { ok: false; reason: string };

const SEAT_LIMIT = 3;

/**
 * checkout/verify와 webhook/portone 양쪽에서 호출된다 (activateSubscription과 동일한 이유).
 * family_groups.owner_id가 유니크라 upsert 자체로 멱등성이 보장된다 — 같은 결제가 두 번
 * 들어와도 같은 period_end로 덮어쓸 뿐 중복 row가 생기지 않는다.
 *
 * ⚠️ payments/subscriptions 테이블은 건드리지 않는다 (2026-08-20 결정) — 그래서 family
 * 결제는 아직 /mypage/billing 결제내역·환불 계산에 나타나지 않는다. 다음 단계 작업.
 */
export async function activateFamilyGroup(input: ActivateFamilyGroupInput): Promise<ActivateFamilyGroupResult> {
  const supabase = getSupabaseServerClient();

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const { error } = await supabase.from("family_groups").upsert(
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
  );

  if (error) {
    return { ok: false, reason: `family_groups 저장 실패: ${error.message}` };
  }

  return { ok: true };
}
