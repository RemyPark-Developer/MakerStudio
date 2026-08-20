/**
 * family_group_members에 아이를 추가해도 되는지 판단하는 핵심 규칙.
 * 외부 I/O(Supabase 조회)와 분리해서, 라이브 자격증명 없이도 이 판단 자체를 단위
 * 테스트할 수 있게 했다 (lib/identity/childSignup.ts와 같은 패턴).
 *
 * ⚠️ linkedChildIds는 반드시 guardian_child_links(법적 보호자-자녀 관계)에서 조회한
 * 값이어야 한다 — 이 검사가 CLAUDE.md 설계 원칙 3번("이미 법적 보호자로 등록된 아이만
 * 가족 그룹에 추가 가능")의 실제 구현이다.
 */

export type AddMemberCheckResult =
  | { ok: true }
  | { ok: false; status: 403; reason: "not_legal_guardian" }
  | { ok: false; status: 404; reason: "no_active_family_plan" }
  | { ok: false; status: 409; reason: "already_member" }
  | { ok: false; status: 409; reason: "seat_limit_reached" };

export function checkCanAddFamilyMember(input: {
  childId: string;
  linkedChildIds: string[]; // guardian_child_links에서 조회한 이 보호자의 법적 자녀 id 목록
  familyGroupStatus: "active" | "canceled" | null; // null = family_groups 행 자체가 없음
  currentMemberChildIds: string[];
  seatLimit: number;
}): AddMemberCheckResult {
  // 법적 관계 확인이 항상 첫 번째 — 다른 조건이 다 통과해도 이게 없으면 절대 추가 못 함.
  if (!input.linkedChildIds.includes(input.childId)) {
    return { ok: false, status: 403, reason: "not_legal_guardian" };
  }
  if (input.familyGroupStatus !== "active") {
    return { ok: false, status: 404, reason: "no_active_family_plan" };
  }
  if (input.currentMemberChildIds.includes(input.childId)) {
    return { ok: false, status: 409, reason: "already_member" };
  }
  if (input.currentMemberChildIds.length >= input.seatLimit) {
    return { ok: false, status: 409, reason: "seat_limit_reached" };
  }
  return { ok: true };
}
