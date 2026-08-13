import { test } from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit, resetRateLimit } from "./rate-limit";

test("처음 10번 요청은 허용된다", () => {
  const key = "test-user-A";
  resetRateLimit(key);

  for (let i = 0; i < 10; i++) {
    const result = checkRateLimit(key);
    assert.equal(result.allowed, true, `${i + 1}번째 요청은 허용돼야 함`);
  }
});

test("11번째 요청은 차단된다", () => {
  const key = "test-user-B";
  resetRateLimit(key);

  for (let i = 0; i < 10; i++) checkRateLimit(key);
  const eleventh = checkRateLimit(key);

  assert.equal(eleventh.allowed, false, "11번째 요청은 차단돼야 함");
  assert.equal(eleventh.remaining, 0);
});

test("remaining 카운트가 요청마다 정확히 줄어든다", () => {
  const key = "test-user-C";
  resetRateLimit(key);

  const first = checkRateLimit(key);
  assert.equal(first.remaining, 9);

  const second = checkRateLimit(key);
  assert.equal(second.remaining, 8);
});

test("서로 다른 키(사용자)는 서로의 카운트에 영향을 주지 않는다", () => {
  const keyA = "test-user-D";
  const keyB = "test-user-E";
  resetRateLimit(keyA);
  resetRateLimit(keyB);

  for (let i = 0; i < 10; i++) checkRateLimit(keyA);
  const aBlocked = checkRateLimit(keyA);
  const bStillAllowed = checkRateLimit(keyB);

  assert.equal(aBlocked.allowed, false, "A는 한도를 다 써서 차단돼야 함");
  assert.equal(bStillAllowed.allowed, true, "B는 A와 무관하게 여전히 허용돼야 함");
});
