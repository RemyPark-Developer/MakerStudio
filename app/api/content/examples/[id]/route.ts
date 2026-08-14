import { NextRequest, NextResponse } from "next/server";
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

  return NextResponse.json(gated);
}
