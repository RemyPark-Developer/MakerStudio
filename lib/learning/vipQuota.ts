import type { SupabaseClient } from "@supabase/supabase-js";

/** VIP 제출 월간 한도(2026-08-22 결정) — ₩100,000/월 운영 비용 예측을 위해 도입. */
export const MONTHLY_VIP_SUBMISSION_LIMIT = 4;

/**
 * 이번 달 제출 횟수를 센다. 안전필터에 걸려 차단된 시도(flagged=true)는 Anthropic을
 * 호출하지 않았으니 카운트에서 제외한다(AI 튜터 quota와 동일 원칙,
 * lib/learning/tutorSafety.ts 설계 문서 참고).
 *
 * date_trunc가 아니라 서버(Node)에서 UTC 월 경계를 직접 계산한다 — admin_plan_churn
 * 뷰에서 로컬 타임존으로 "이번 달"을 잘못 계산했던 버그(2026-08-21)를 다시 겪지 않기 위함.
 */
export async function countVipSubmissionsThisMonth(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const { count, error } = await supabase
    .from("vip_mentor_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("flagged", false)
    .gte("created_at", monthStart);

  if (error) throw new Error(`VIP 제출 횟수 조회 실패: ${error.message}`);
  return count ?? 0;
}
