import { NextRequest, NextResponse } from "next/server";
import { codeToHtml } from "shiki";
import { getExampleById } from "@/lib/content";
import { getPublishedModuleForUser } from "@/lib/content/publishedModules";
import { gateExample } from "@/lib/content/gate";
import { getContentStats } from "@/lib/content/contentStats";
import { getAuthedUser } from "@/lib/supabase/auth-context";
import { withErrorHandling } from "@/lib/api-error-handler";

// ⚠️ 이 라우트는 항상 동적이어야 한다 — force-static 등으로 절대 바꾸지 말 것 (Design.md §7.2)
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const user = await getAuthedUser(req).catch(() => null);

    // content/examples/*.json(파일)이 우선, 없으면 관리자가 승인한 DB 콘텐츠(content_modules)를
    // 찾는다 — DB 콘텐츠는 §6.3-a에 따라 요청 사용자의 학습 여부로 버전이 갈릴 수 있다.
    const example = getExampleById(id) ?? (await getPublishedModuleForUser(id, user?.id ?? null));
    if (!example) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const gated = await gateExample(example, user);

    // 통계는 Premium 게이팅과 무관 — 잠긴 콘텐츠가 아니라 항상 포함한다.
    const stats = (await getContentStats([example.id])).get(example.id)!;

    // 잠금 해제된 콘텐츠에 한해서만 서버에서 하이라이팅한다 — 잠긴 상태에선 code 필드 자체가 없음(§7.2).
    if (!gated.locked && gated.code) {
      const codeHtml = await codeToHtml(gated.code, { lang: "cpp", theme: "github-dark" });
      return NextResponse.json({ ...gated, codeHtml, ...stats });
    }

    return NextResponse.json({ ...gated, ...stats });
  }
);
