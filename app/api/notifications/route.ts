import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase/auth-context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/api-error-handler";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const user = await getAuthedUser(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  const { data: notifications, error } = await supabase
    .from("notifications")
    .select("id, type, message, action_url, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "server_error", message: "알림을 불러오지 못했어요." }, { status: 500 });
  }

  return NextResponse.json({ notifications: notifications ?? [] });
});
