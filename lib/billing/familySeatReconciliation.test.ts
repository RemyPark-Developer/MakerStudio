import { test } from "node:test";
import assert from "node:assert/strict";
import { selectMembersToRemove } from "./familySeatReconciliation";

test("멤버 수가 새 정원 이하면 아무도 안 뺀다", () => {
  const members = [
    { childId: "a", addedAt: "2026-08-01T00:00:00Z" },
    { childId: "b", addedAt: "2026-08-02T00:00:00Z" },
  ];
  assert.deepEqual(selectMembersToRemove(members, 3), []);
});

test("정확히 정원과 같으면 아무도 안 뺀다", () => {
  const members = [
    { childId: "a", addedAt: "2026-08-01T00:00:00Z" },
    { childId: "b", addedAt: "2026-08-02T00:00:00Z" },
    { childId: "c", addedAt: "2026-08-03T00:00:00Z" },
  ];
  assert.deepEqual(selectMembersToRemove(members, 3), []);
});

test("정원을 넘으면 가장 최근에 추가된 아이부터 뺀다", () => {
  const members = [
    { childId: "oldest", addedAt: "2026-08-01T00:00:00Z" },
    { childId: "middle", addedAt: "2026-08-02T00:00:00Z" },
    { childId: "newer", addedAt: "2026-08-03T00:00:00Z" },
    { childId: "newest", addedAt: "2026-08-04T00:00:00Z" },
  ];
  const result = selectMembersToRemove(members, 3);
  assert.deepEqual(result, ["newest"]);
});

test("여러 명 초과하면 초과한 수만큼 최근순으로 뺀다", () => {
  const members = [
    { childId: "oldest", addedAt: "2026-08-01T00:00:00Z" },
    { childId: "b", addedAt: "2026-08-02T00:00:00Z" },
    { childId: "c", addedAt: "2026-08-03T00:00:00Z" },
    { childId: "d", addedAt: "2026-08-04T00:00:00Z" },
    { childId: "newest", addedAt: "2026-08-05T00:00:00Z" },
  ];
  const result = selectMembersToRemove(members, 3);
  assert.equal(result.length, 2);
  assert.ok(result.includes("newest"));
  assert.ok(result.includes("d"));
  assert.ok(!result.includes("oldest"));
});

test("멤버가 아예 없으면 빈 배열", () => {
  assert.deepEqual(selectMembersToRemove([], 3), []);
});
