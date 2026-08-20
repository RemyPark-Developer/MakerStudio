import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser, requireGuardian } from "@/lib/supabase/auth-context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/api-error-handler";

/**
 * family_group 멤버십만 제거한다 — guardian_child_links(법적 보호자-자녀 관계)는 그대로 둔다.
 */
export const DELETE = withErrorHandling(
  async (req: NextRequest, { params }: { params: Promise<{ childId: string }> }) => {
    const user = await getAuthedUser(req);
    if (!requireGuardian(user)) {
      return NextResponse.json({ error: "forbidden", message: "보호자만 이용할 수 있어요." }, { status: 403 });
    }

    const { childId } = await params;
    const supabase = getSupabaseServerClient();

    const { data: familyGroup } = await supabase
      .from("family_groups")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!familyGroup) {
      return NextResponse.json({ error: "not_found", message: "Family 요금제에 가입되어 있지 않아요." }, { status: 404 });
    }

    const { error } = await supabase
      .from("family_group_members")
      .delete()
      .eq("family_group_id", familyGroup.id)
      .eq("child_id", childId);

    if (error) {
      return NextResponse.json({ error: "server_error", message: "제거에 실패했어요." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }
);
