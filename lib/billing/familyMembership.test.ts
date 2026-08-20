import { test } from "node:test";
import assert from "node:assert/strict";
import { checkCanAddFamilyMember } from "./familyMembership";

const base = {
  childId: "child-1",
  linkedChildIds: ["child-1"],
  familyGroupStatus: "active" as const,
  currentMemberChildIds: [],
  seatLimit: 3,
};

test("법적 보호자-자녀 관계에 없는 아이는 아무리 자리가 남아도 추가할 수 없다", () => {
  const result = checkCanAddFamilyMember({ ...base, linkedChildIds: ["other-child"] });
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.reason === "not_legal_guardian");
  assert.ok(!result.ok && result.status === 403);
});

test("family_groups가 없으면(가입 안 함) 추가할 수 없다", () => {
  const result = checkCanAddFamilyMember({ ...base, familyGroupStatus: null });
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.reason === "no_active_family_plan");
});

test("family_groups가 해지 상태면 추가할 수 없다", () => {
  const result = checkCanAddFamilyMember({ ...base, familyGroupStatus: "canceled" });
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.reason === "no_active_family_plan");
});

test("이미 멤버인 아이를 다시 추가하려 하면 거부한다", () => {
  const result = checkCanAddFamilyMember({ ...base, currentMemberChildIds: ["child-1"] });
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.reason === "already_member");
});

test("정원(3명)이 다 찼으면 법적 관계가 있어도 추가할 수 없다", () => {
  const result = checkCanAddFamilyMember({
    ...base,
    currentMemberChildIds: ["a", "b", "c"],
  });
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.reason === "seat_limit_reached");
});

test("법적 관계 있고, family 활성 상태고, 자리가 남으면 허용한다", () => {
  const result = checkCanAddFamilyMember({
    ...base,
    currentMemberChildIds: ["a", "b"], // 2/3
  });
  assert.equal(result.ok, true);
});

test("법적 관계 확인이 항상 우선한다 — 정원이 남아도 관계 없으면 403", () => {
  const result = checkCanAddFamilyMember({
    ...base,
    linkedChildIds: [],
    currentMemberChildIds: [],
  });
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.status === 403);
});
