import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateRetentionUntil, RETENTION_DAYS } from "./dataRetention";

test("결제주기 종료일로부터 정확히 30일 뒤를 반환한다", () => {
  const periodEnd = new Date("2026-08-01T00:00:00+09:00");
  const result = calculateRetentionUntil(periodEnd);

  const expected = new Date("2026-08-31T00:00:00+09:00");
  assert.equal(result.getTime(), expected.getTime());
});

test("RETENTION_DAYS 상수가 30이다", () => {
  assert.equal(RETENTION_DAYS, 30);
});

test("월 경계를 정확히 넘어간다(8월 말 → 9월)", () => {
  const periodEnd = new Date("2026-08-15T00:00:00+09:00");
  const result = calculateRetentionUntil(periodEnd);

  assert.equal(result.getMonth(), 8); // 0-indexed: 8 = 9월
  assert.equal(result.getDate(), 14);
});

test("연도 경계를 정확히 넘어간다(12월 → 1월)", () => {
  const periodEnd = new Date("2026-12-15T00:00:00+09:00");
  const result = calculateRetentionUntil(periodEnd);

  assert.equal(result.getFullYear(), 2027);
  assert.equal(result.getMonth(), 0); // 1월
  assert.equal(result.getDate(), 14);
});

test("입력 Date 객체를 변형하지 않는다(순수 함수)", () => {
  const periodEnd = new Date("2026-08-01T00:00:00+09:00");
  const originalTime = periodEnd.getTime();
  calculateRetentionUntil(periodEnd);

  assert.equal(periodEnd.getTime(), originalTime);
});
