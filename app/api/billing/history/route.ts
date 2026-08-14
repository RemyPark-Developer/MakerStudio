import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser, requireGuardian } from "@/lib/supabase/auth-context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/api-error-handler";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const user = await getAuthedUser(req);
  if (!requireGuardian(user)) {
    return NextResponse.json({ error: "forbidden", message: "보호자만 이용할 수 있어요." }, { status: 403 });
  }

  const supabase = getSupabaseServerClient();
  // guardian_id로 자녀들의 구독 id를 먼저 찾고, 그 구독들의 결제 내역을 가져온다.
  const { data: subs } = await supabase.from("subscriptions").select("id").eq("guardian_id", user.id);
  const subIds = (subs ?? []).map((s) => s.id);

  if (subIds.length === 0) {
    return NextResponse.json({ payments: [] });
  }

  const { data: payments, error } = await supabase
    .from("payments")
    .select("id, subscription_id, amount, status, paid_at")
    .in("subscription_id", subIds)
    .order("paid_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "server_error", message: "결제 내역을 불러오지 못했어요." }, { status: 500 });
  }

  return NextResponse.json({ payments: payments ?? [] });
});
