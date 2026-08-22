import { NextRequest } from "next/server";
import { getSupabaseServerClient } from "./server";

export type AuthedUser = {
  id: string;
  email: string | null;
  role: "student_teen" | "student_child" | "guardian" | "admin";
  nickname: string | null;
};

/**
 * Authorization: Bearer {jwt} 헤더에서 사용자를 검증합니다.
 * 실패하면 null — 호출부가 401을 반환하도록.
 *
 * 이 함수 하나로 모든 인증 라우트가 검증하게 해서, 도메인마다 검증 로직이
 * 따로 노는 것을 방지합니다 (Auth_Flow.md §3의 "API 미들웨어" 계층).
 */
export async function getAuthedUser(req: NextRequest): Promise<AuthedUser | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    console.log("[getAuthedUser] Authorization 헤더 없음 또는 형식 이상 →", authHeader?.slice(0, 20));
    return null;
  }
  const token = authHeader.slice("Bearer ".length);
  console.log("[getAuthedUser] 토큰 앞부분:", token.slice(0, 20) + "...");

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    console.log("[getAuthedUser] auth.getUser 실패:", JSON.stringify(error));
    return null;
  }
  console.log("[getAuthedUser] auth.getUser 성공, user.id =", data.user.id);

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, nickname")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) {
    console.log("[getAuthedUser] profiles 조회 에러:", JSON.stringify(profileError));
    return null;
  }
  if (!profile) {
    console.log("[getAuthedUser] profiles 조회는 성공했지만 행이 없음 (id 불일치 의심), 찾던 id =", data.user.id);
    return null; // auth.users엔 있지만 profiles가 아직 없음 = 온보딩 미완료
  }

  console.log("[getAuthedUser] 최종 성공:", profile);
  return { id: data.user.id, email: data.user.email ?? null, role: profile.role, nickname: profile.nickname };
}

/** guardian 전용 라우트에서 쓰는 짧은 가드. Auth_Flow.md §3 매트릭스 참고. */
export function requireGuardian(user: AuthedUser | null): user is AuthedUser {
  return user !== null && user.role === "guardian";
}

/**
 * 결제 관련 "조회 전용" 라우트에서만 쓰는 가드 — guardian은 원래 자기 데이터를 보는 것,
 * admin은 지원/테스트 목적으로 읽기만 허용한다(2026-08-22, `/mypage/billing` 버그 수정 —
 * 프론트엔드는 admin을 이미 통과시키고 있었는데 서버가 guardian만 허용해서 403이 401로
 * 오인되어 "로그인이 필요해요" 화면이 잘못 뜨던 문제).
 *
 * ⚠️ 결제를 실제로 만들거나 바꾸는 엔드포인트(checkout/verify, subscription/cancel,
 * family/cancel, family/members POST/DELETE, refund/calculate 등)에는 절대 쓰지 말 것 —
 * 그런 라우트는 `guardian_id: user.id`/`owner_id: user.id`로 "내 것"을 만들거나 바꾸는데,
 * admin에게 허용하면 admin 명의로 의미 없는 구독/가족그룹이 생기거나 무의미한 취소/환불이
 * 일어난다. 반드시 `requireGuardian()`만 쓸 것.
 */
export function requireGuardianOrAdmin(user: AuthedUser | null): user is AuthedUser {
  return user !== null && (user.role === "guardian" || user.role === "admin");
}
