import { NextRequest, NextResponse } from "next/server";
import { listAllExamples } from "@/lib/content/listExamples";
import { getContentStats } from "@/lib/content/contentStats";
import { withErrorHandling } from "@/lib/api-error-handler";

// 관리자 승인 즉시 목록에 반영되어야 하므로 절대 정적 생성하지 않는다 (Design.md §7.2와 같은 원칙).
export const dynamic = "force-dynamic";

/**
 * 콘텐츠 목록 (PUBLISHED만, 카탈로그 화면용). 인증 불필요.
 * API_Spec §4 `GET /api/content/examples` 구현.
 * ⚠️ code/explain/quiz는 절대 포함하지 않는다 — Premium 여부와 무관하게 목록에는
 * 필요 없고, 상세 조회(/api/content/examples/:id)에서만 게이팅을 거쳐 내려준다.
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const all = await listAllExamples();

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim().toLowerCase();
  const sort = searchParams.get("sort");

  let result = all;
  if (q) {
    result = result.filter(
      (e) => e.label.toLowerCase().includes(q) || e.intro.toLowerCase().includes(q)
    );
  }
  result =
    sort === "name"
      ? [...result].sort((a, b) => a.label.localeCompare(b.label))
      : [...result].sort((a, b) => a.difficulty - b.difficulty);

  const stats = await getContentStats(result.map((e) => e.id));

  const examples = result.map(({ id, icon, label, board, difficulty, estimatedMinutes, intro, isPremium }) => {
    const s = stats.get(id)!;
    return {
      id,
      icon,
      label,
      board,
      difficulty,
      estimatedMinutes,
      intro,
      isPremium,
      viewCount: s.viewCount,
      avgRating: s.avgRating,
      ratingCount: s.ratingCount,
    };
  });

  return NextResponse.json({ examples });
});
