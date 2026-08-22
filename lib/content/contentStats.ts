import { getSupabaseServerClient } from "@/lib/supabase/server";

export type ContentStats = { viewCount: number; avgRating: number | null; ratingCount: number };

/**
 * moduleId(=슬러그) 목록에 대한 조회수/평점 집계를 한 번에 가져온다.
 * supabase/migrations/0037_content_stats.sql의 뷰 2개(content_view_counts,
 * content_rating_summary)를 조회 — 개별 사용자 행이 아니라 집계 수치만 나오므로
 * 이 함수는 비로그인 요청(카탈로그 목록 등)에서도 안전하게 호출 가능하다.
 */
export async function getContentStats(moduleIds: string[]): Promise<Map<string, ContentStats>> {
  const stats = new Map<string, ContentStats>();
  for (const id of moduleIds) stats.set(id, { viewCount: 0, avgRating: null, ratingCount: 0 });
  if (moduleIds.length === 0) return stats;

  const supabase = getSupabaseServerClient();
  const [viewsRes, ratingsRes] = await Promise.all([
    supabase.from("content_view_counts").select("module_id, view_count").in("module_id", moduleIds),
    supabase.from("content_rating_summary").select("module_id, avg_rating, rating_count").in("module_id", moduleIds),
  ]);

  for (const row of viewsRes.data ?? []) {
    const s = stats.get(row.module_id as string);
    if (s) s.viewCount = row.view_count as number;
  }
  for (const row of ratingsRes.data ?? []) {
    const s = stats.get(row.module_id as string);
    if (s) {
      s.avgRating = row.avg_rating as number;
      s.ratingCount = row.rating_count as number;
    }
  }
  return stats;
}

/** content_recent_activity 뷰(최근 5분 근사치) — 관리자 콘텐츠 탭 전용. */
export async function getRecentActivityCounts(moduleIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const id of moduleIds) counts.set(id, 0);
  if (moduleIds.length === 0) return counts;

  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("content_recent_activity")
    .select("module_id, recent_active_count")
    .in("module_id", moduleIds);

  for (const row of data ?? []) counts.set(row.module_id as string, row.recent_active_count as number);
  return counts;
}
