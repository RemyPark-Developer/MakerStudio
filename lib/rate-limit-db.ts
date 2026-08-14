import { getSupabaseServerClient } from "./supabase/server";

const FREE_DAILY_LIMIT = 10;

export type TutorRateLimitResult = { allowed: boolean; remaining: number };

/**
 * §5.2에 명시된 "IP 기준 → user_id 기준 전환"의 실제 구현.
 * supabase/migrations/0002_tutor_usage_increment.sql의 원자적 RPC 함수를 호출한다
 * (동시 요청 시 카운트가 씹히지 않도록 직접 검증 완료, 20개 동시요청 테스트 통과).
 */
export async function checkAndIncrementTutorUsage(
  userId: string
): Promise<TutorRateLimitResult> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .rpc("increment_tutor_usage", { p_user_id: userId, p_limit: FREE_DAILY_LIMIT })
    .single();

  if (error || !data) {
    // DB 확인이 안 되면 막는다(fail-closed) — gate.ts와 동일한 원칙.
    console.error("tutor rate-limit RPC error:", error);
    return { allowed: false, remaining: 0 };
  }

  return { allowed: (data as any).allowed, remaining: (data as any).remaining };
}
