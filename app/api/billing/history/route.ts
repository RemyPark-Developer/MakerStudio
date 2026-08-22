import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser, requireGuardianOrAdmin } from "@/lib/supabase/auth-context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/api-error-handler";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const user = await getAuthedUser(req);
  if (!requireGuardianOrAdmin(user)) {
    return NextResponse.json({ error: "forbidden", message: "보호자만 이용할 수 있어요." }, { status: 403 });
  }

  const supabase = getSupabaseServerClient();
  // guardian_id로 자녀들의 구독 id, 그리고 (있다면) Family 그룹 id를 먼저 찾고,
  // 그 둘에 걸린 결제 내역을 함께 가져온다 (0015_family_payments.sql부터 payments가
  // family_group_id로도 결제를 기록함).
  const [{ data: subs }, { data: familyGroup }] = await Promise.all([
    supabase.from("subscriptions").select("id").eq("guardian_id", user.id),
    supabase.from("family_groups").select("id").eq("owner_id", user.id).maybeSingle(),
  ]);
  const subIds = (subs ?? []).map((s) => s.id);

  if (subIds.length === 0 && !familyGroup) {
    return NextResponse.json({ payments: [] });
  }

  let query = supabase
    .from("payments")
    .select("id, subscription_id, family_group_id, amount, status, paid_at")
    .order("paid_at", { ascending: false });

  if (subIds.length > 0 && familyGroup) {
    query = query.or(`subscription_id.in.(${subIds.join(",")}),family_group_id.eq.${familyGroup.id}`);
  } else if (subIds.length > 0) {
    query = query.in("subscription_id", subIds);
  } else {
    query = query.eq("family_group_id", familyGroup!.id);
  }

  const { data: payments, error } = await query;

  if (error) {
    return NextResponse.json({ error: "server_error", message: "결제 내역을 불러오지 못했어요." }, { status: 500 });
  }

  return NextResponse.json({ payments: payments ?? [] });
});
