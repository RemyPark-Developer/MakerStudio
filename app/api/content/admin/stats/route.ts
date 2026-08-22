import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase/auth-context";
import { getAdminContentStats } from "@/lib/content/adminContentStats";
import { withErrorHandling } from "@/lib/api-error-handler";

/** 관리자 대시보드 콘텐츠 탭 — app/admin/dashboard의 콘텐츠 탭이 호출. */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const user = await getAuthedUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rows = await getAdminContentStats();
  return NextResponse.json({ rows });
});
