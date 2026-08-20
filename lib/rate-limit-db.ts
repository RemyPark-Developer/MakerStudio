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

const REVIEW_CHAT_DAILY_LIMIT = 50;

export type ReviewChatRateLimitResult = { allowed: boolean; remaining: number };

/**
 * 관리자 콘텐츠 검수 AI 채팅(admin/content-review) 비용 방어용 일일 제한.
 * 관리자 전용 내부 도구라 동시성이 사실상 없어서, tutor_usage처럼 별도 테이블 +
 * 원자적 RPC를 새로 만들지 않고 기존 content_review_messages 로그를 세는 것으로 충분하다고 판단.
 * fail-closed: 카운트 조회 자체가 실패하면 막는다 (gate.ts, tutor rate-limit과 동일한 원칙).
 */
export async function checkReviewChatUsage(adminId: string): Promise<ReviewChatRateLimitResult> {
  const supabase = getSupabaseServerClient();
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from("content_review_messages")
    .select("id", { count: "exact", head: true })
    .eq("admin_id", adminId)
    .eq("role", "admin")
    .gte("created_at", startOfDay.toISOString());

  if (error) {
    console.error("review-chat rate-limit count error:", error);
    return { allowed: false, remaining: 0 };
  }

  const used = count ?? 0;
  return { allowed: used < REVIEW_CHAT_DAILY_LIMIT, remaining: Math.max(0, REVIEW_CHAT_DAILY_LIMIT - used) };
}
