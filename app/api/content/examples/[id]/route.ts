import { NextRequest, NextResponse } from "next/server";
import { codeToHtml } from "shiki";
import { getExampleById } from "@/lib/content";
import { gateExample } from "@/lib/content/gate";
import { getAuthedUser } from "@/lib/supabase/auth-context";

// ⚠️ 이 라우트는 항상 동적이어야 한다 — force-static 등으로 절대 바꾸지 말 것 (Design.md §7.2)
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const example = getExampleById(id);
  if (!example) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const user = await getAuthedUser(req).catch(() => null);
  const gated = await gateExample(example, user);

  // 잠금 해제된 콘텐츠에 한해서만 서버에서 하이라이팅한다 — 잠긴 상태에선 code 필드 자체가 없음(§7.2).
  if (!gated.locked && gated.code) {
    const codeHtml = await codeToHtml(gated.code, { lang: "cpp", theme: "github-dark" });
    return NextResponse.json({ ...gated, codeHtml });
  }

  return NextResponse.json(gated);
}
