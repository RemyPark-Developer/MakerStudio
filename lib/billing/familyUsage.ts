import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Family 요금제 "미사용 전액환불" 판단의 나머지 절반(기간 조건은
 * lib/billing/refund.ts의 isWithinFullRefundWindow) — guardian 본인과 family_group에
 * 속한 자녀 전원의 이용 내역을 합산해서 "이번 결제 주기에 아무도 안 썼는지" 확인한다.
 *
 * 콘텐츠 카탈로그가 두 종류(JSON examples / DB content_modules)라 진도·활동 테이블도
 * 두 벌이다 — 하나만 보면 자녀가 다른 쪽만 썼을 때 "미사용"으로 잘못 판단하므로
 * 5개 테이블을 전부 확인한다(2026-08-20 Family 환불 정책 확정 시 결정).
 *
 * DB 조회가 핵심이라 순수 함수가 아니다 — checkCanAddFamilyMember 같은 단위테스트 대신
 * 실제 Supabase로 시나리오 검증한다(이 세션 내내 써온 패턴).
 */
export async function checkFamilyGroupUsedInPeriod(
  supabase: SupabaseClient,
  input: { userIds: string[]; periodStart: Date; periodEnd: Date }
): Promise<boolean> {
  const { userIds, periodStart, periodEnd } = input;
  const start = periodStart.toISOString();
  const end = periodEnd.toISOString();

  const checks = [
    supabase.from("learning_progress").select("id").in("user_id", userIds).gte("updated_at", start).lte("updated_at", end).limit(1),
    supabase.from("quiz_attempts").select("id").in("user_id", userIds).gte("attempted_at", start).lte("attempted_at", end).limit(1),
    supabase.from("tutor_messages").select("id").in("user_id", userIds).gte("created_at", start).lte("created_at", end).limit(1),
    supabase.from("progress").select("id").in("user_id", userIds).gte("updated_at", start).lte("updated_at", end).limit(1),
    supabase.from("saved_codes").select("id").in("user_id", userIds).gte("saved_at", start).lte("saved_at", end).limit(1),
  ];

  const results = await Promise.all(checks);
  return results.some((r) => (r.data?.length ?? 0) > 0);
}
