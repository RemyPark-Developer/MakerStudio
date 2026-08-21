import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAuthClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/api-error-handler";

/**
 * 액세스 토큰(보통 1시간 만료)이 만료됐을 때, 리프레시 토큰으로 새 토큰을 받는 라우트.
 * 2026-08-13 실사용자 테스트 중 발견 — 로그인 페이지가 refreshToken을 안 저장해서
 * 1시간 뒤 "로그인은 했는데 로그인 필요하다고 뜨는" 문제가 있었음.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  const refreshToken: string | undefined = body?.refreshToken;

  if (!refreshToken) {
    return NextResponse.json(
      { error: "invalid_request", message: "refreshToken이 필요해요." },
      { status: 400 }
    );
  }

  // ⚠️ service_role 싱글턴을 쓰면 안 됨 — refreshSession이 그 클라이언트의 세션
  // 상태를 영구히 바꿔버린다(createSupabaseAuthClient 주석 참고). 요청마다 새로 만든다.
  const supabase = createSupabaseAuthClient();
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

  if (error || !data.session) {
    return NextResponse.json(
      { error: "invalid_refresh_token", message: "다시 로그인해주세요." },
      { status: 401 }
    );
  }

  return NextResponse.json({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
  });
});
