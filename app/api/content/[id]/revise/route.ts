import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase/auth-context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/api-error-handler";

/**
 * §6.3-a "개선판 만들기" — 게시된 콘텐츠를 복제해 다음 버전의 pending_review 행을 만든다.
 * 콘텐츠가 이미 검증된 v1 코드를 그대로 복제한 것이므로 draft 단계(자동 재검증)를 거치지
 * 않고 곧장 pending_review로 넣는다 — 기존 승인/반려 API를 그대로 재사용한다.
 */
export const POST = withErrorHandling(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await getAuthedUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const supabase = getSupabaseServerClient();

  const { data: source, error } = await supabase.from("content_modules").select("*").eq("id", id).maybeSingle();
  if (error) {
    return NextResponse.json({ error: "server_error", message: "조회에 실패했어요." }, { status: 500 });
  }
  if (!source) {
    return NextResponse.json({ error: "not_found", message: "콘텐츠를 찾을 수 없어요." }, { status: 404 });
  }
  if (source.status !== "published") {
    return NextResponse.json(
      { error: "invalid_state", message: "게시된 콘텐츠에서만 개선판을 만들 수 있어요." },
      { status: 409 }
    );
  }

  const { data: versions } = await supabase.from("content_modules").select("version").eq("slug", source.slug);
  const nextVersion = Math.max(...(versions ?? [{ version: source.version }]).map((v) => v.version)) + 1;
  const newId = `${source.slug}-v${nextVersion}`;

  const {
    id: _oldId,
    version: _oldVersion,
    status: _oldStatus,
    created_at,
    updated_at,
    reviewed_by,
    review_note,
    retry_count,
    last_error,
    last_verified_at,
    created_by,
    ...rest
  } = source;

  const { data: created, error: insertError } = await supabase
    .from("content_modules")
    .insert({
      ...rest,
      id: newId,
      slug: source.slug,
      version: nextVersion,
      status: "pending_review",
      created_by: user.id,
    })
    .select("id, version")
    .single();

  if (insertError || !created) {
    return NextResponse.json(
      { error: "server_error", message: "개선판 생성에 실패했어요: " + insertError?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, id: created.id, version: created.version });
});
