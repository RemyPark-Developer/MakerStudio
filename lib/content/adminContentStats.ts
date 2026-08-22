import { getAllExamples } from "@/lib/content";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getContentStats, getRecentActivityCounts } from "@/lib/content/contentStats";

export type AdminContentStatsRow = {
  /** content_modules 기술적 PK, 정적 예제는 슬러그와 동일 */
  id: string;
  slug: string;
  label: string;
  /** 정적 예제(content/examples/*.json)는 status 개념이 없어 항상 'published' */
  status: string;
  version: number;
  viewCount: number;
  avgRating: number | null;
  ratingCount: number;
  recentActiveCount: number;
};

type ContentModuleRow = {
  id: string;
  slug: string;
  label_ko: string;
  status: string;
  version: number;
};

/**
 * 관리자 콘텐츠 탭 전용 — 정적 예제(항상 published) + content_modules **모든 status**를
 * 한 줄씩(행 하나 = 콘텐츠 한 버전) 나열하고, 조회수/평점/최근활동자는 슬러그 단위로 붙인다.
 * `lib/content/listExamples.ts`(공개 카탈로그, published 슬러그당 최신 버전만)와는 다른
 * 함수다 — 관리자는 draft/pending_review 상태와 과거 버전도 봐야 하므로 재사용하지 않았다.
 */
export async function getAdminContentStats(): Promise<AdminContentStatsRow[]> {
  const staticExamples = getAllExamples();

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("content_modules")
    .select("id, slug, label_ko, status, version")
    .order("slug", { ascending: true })
    .order("version", { ascending: false });

  if (error) {
    console.error("getAdminContentStats — content_modules 조회 실패:", error);
  }
  const moduleRows = (data ?? []) as ContentModuleRow[];

  const allSlugs = [
    ...new Set([...staticExamples.map((e) => e.id), ...moduleRows.map((r) => r.slug)]),
  ];
  const [stats, recentActivity] = await Promise.all([
    getContentStats(allSlugs),
    getRecentActivityCounts(allSlugs),
  ]);

  const staticRows: AdminContentStatsRow[] = staticExamples.map((e) => {
    const s = stats.get(e.id)!;
    return {
      id: e.id,
      slug: e.id,
      label: e.label,
      status: "published",
      version: 1,
      viewCount: s.viewCount,
      avgRating: s.avgRating,
      ratingCount: s.ratingCount,
      recentActiveCount: recentActivity.get(e.id) ?? 0,
    };
  });

  const moduleStatsRows: AdminContentStatsRow[] = moduleRows.map((r) => {
    const s = stats.get(r.slug)!;
    return {
      id: r.id,
      slug: r.slug,
      label: r.label_ko,
      status: r.status,
      version: r.version,
      viewCount: s.viewCount,
      avgRating: s.avgRating,
      ratingCount: s.ratingCount,
      recentActiveCount: recentActivity.get(r.slug) ?? 0,
    };
  });

  return [...staticRows, ...moduleStatsRows];
}
