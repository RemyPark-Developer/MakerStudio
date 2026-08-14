import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateProratedRefund } from "./refund";

test("프로토타입 데모에서 검증했던 정확한 사례: ₩9,900 × 29/31 = ₩9,261", () => {
  // 31일짜리 주기, 2일 사용(29일 남음)
  const periodStart = new Date("2026-08-01T00:00:00+09:00");
  const periodEnd = new Date("2026-09-01T00:00:00+09:00"); // 31일 뒤
  const now = new Date("2026-08-03T00:00:00+09:00"); // 2일 사용

  const result = calculateProratedRefund({
    monthlyAmount: 9900,
    periodStart,
    periodEnd,
    now,
  });

  assert.equal(result.totalDays, 31);
  assert.equal(result.usedDays, 2);
  assert.equal(result.remainingDays, 29);
  assert.equal(result.refundAmount, 9261); // 9900 * 29/31 = 9260.96... -> 반올림 9261
});

test("주기 시작 직후 해지하면 거의 전액 환불된다", () => {
  const periodStart = new Date("2026-08-01T00:00:00+09:00");
  const periodEnd = new Date("2026-09-01T00:00:00+09:00");
  const now = new Date("2026-08-01T00:00:00+09:00"); // 사용일 0

  const result = calculateProratedRefund({ monthlyAmount: 9900, periodStart, periodEnd, now });
  assert.equal(result.refundAmount, 9900);
});

test("주기 마지막 날 해지하면 환불액이 0에 가깝다", () => {
  const periodStart = new Date("2026-08-01T00:00:00+09:00");
  const periodEnd = new Date("2026-09-01T00:00:00+09:00");
  const now = new Date("2026-09-01T00:00:00+09:00"); // 전체 사용

  const result = calculateProratedRefund({ monthlyAmount: 9900, periodStart, periodEnd, now });
  assert.equal(result.refundAmount, 0);
});

test("now가 주기 시작 전이면 0일 사용으로 처리한다(비정상 입력 방어)", () => {
  const periodStart = new Date("2026-08-01T00:00:00+09:00");
  const periodEnd = new Date("2026-09-01T00:00:00+09:00");
  const now = new Date("2026-07-15T00:00:00+09:00"); // 주기 시작 전

  const result = calculateProratedRefund({ monthlyAmount: 9900, periodStart, periodEnd, now });
  assert.equal(result.usedDays, 0);
  assert.equal(result.refundAmount, 9900);
});

test("now가 주기 끝 이후면 전체 사용으로 처리한다(비정상 입력 방어)", () => {
  const periodStart = new Date("2026-08-01T00:00:00+09:00");
  const periodEnd = new Date("2026-09-01T00:00:00+09:00");
  const now = new Date("2026-10-01T00:00:00+09:00"); // 주기 끝 이후

  const result = calculateProratedRefund({ monthlyAmount: 9900, periodStart, periodEnd, now });
  assert.equal(result.refundAmount, 0);
});

test("periodEnd가 periodStart보다 이전이면 에러를 던진다", () => {
  const periodStart = new Date("2026-09-01T00:00:00+09:00");
  const periodEnd = new Date("2026-08-01T00:00:00+09:00");
  assert.throws(() =>
    calculateProratedRefund({ monthlyAmount: 9900, periodStart, periodEnd, now: periodStart })
  );
});

test("음수 금액은 에러를 던진다", () => {
  const periodStart = new Date("2026-08-01T00:00:00+09:00");
  const periodEnd = new Date("2026-09-01T00:00:00+09:00");
  assert.throws(() =>
    calculateProratedRefund({ monthlyAmount: -100, periodStart, periodEnd, now: periodStart })
  );
});
