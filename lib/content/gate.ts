import { Example } from "../schema";
import { getSupabaseServerClient } from "../supabase/server";
import { AuthedUser } from "../supabase/auth-context";

/**
 * §7.2 핵심 구현: Premium 콘텐츠는 구독 여부를 서버가 확인한 뒤에만
 * code/explain 필드를 포함시킨다. 이 함수를 거치지 않고 Example을
 * 클라이언트에 그대로 내보내지 않는다 (SSG 금지 원칭의 실제 코드).
 */

export type GatedExample =
  | (Example & { locked: false })
  | (Omit<Example, "code" | "explain" | "quiz"> & { locked: true });

export async function gateExample(
  example: Example,
  user: AuthedUser | null
): Promise<GatedExample> {
  if (!example.isPremium) {
    return { ...example, locked: false };
  }

  const hasAccess = await hasPremiumAccess(user);
  if (hasAccess) {
    return { ...example, locked: false };
  }

  // 잠긴 경우: code/explain/quiz를 아예 응답 객체에서 제거.
  // quiz도 함께 빼는 이유: 정답(quiz.answer)이 노출되면 사실상 수업 핵심을 미리 알려주는 셈이라
  // code/explain과 같은 수준으로 취급한다 (2026-08-13, v1.3에서 발견해 v1.4에서 수정).
  const { code, explain, quiz, ...rest } = example;
  return { ...rest, locked: true };
}

/**
 * ⚠️ 실패 시 항상 false(=잠금)를 반환한다 — "확인 안 되면 열어준다"가 아니라
 * "확인 안 되면 잠근다"가 원칙. Supabase가 아직 연결 안 된 지금 상태에서도
 * 이 함수는 항상 false를 반환하므로 Premium 콘텐츠는 항상 잠긴 채로 안전하게 동작한다.
 */
async function hasPremiumAccess(user: AuthedUser | null): Promise<boolean> {
  if (!user) return false;

  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("subscriptions")
      .select("status, plan, current_period_end")
      .eq("child_id", user.id)
      .eq("plan", "premium")
      .eq("status", "active")
      .gte("current_period_end", new Date().toISOString())
      .maybeSingle();

    if (!error && data) return true;
  } catch {
    // Supabase 미연결 등 어떤 이유로든 확인이 안 되면 이 경로는 실패로 취급하고 아래로 진행.
  }

  // 개인 구독이 없으면, 이 아이가 속한 family_group의 owner가 Family 요금제를
  // 활성 상태로 유지 중인지 확인한다 (2026-08-20, family_groups §요금제 확장).
  return hasFamilyPlanAccess(user.id);
}

async function hasFamilyPlanAccess(childId: string): Promise<boolean> {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("family_group_members")
      .select("family_groups(status, current_period_end)")
      .eq("child_id", childId)
      .maybeSingle();

    if (error || !data) return false;

    const group = Array.isArray(data.family_groups) ? data.family_groups[0] : data.family_groups;
    if (!group) return false;

    return group.status === "active" && group.current_period_end >= new Date().toISOString();
  } catch {
    // ⚠️ 확인 안 되면 무조건 잠금 — hasPremiumAccess와 같은 원칙.
    return false;
  }
}
