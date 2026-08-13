import { test } from "node:test";
import assert from "node:assert/strict";
import {
  startChildSignup,
  verifyChildSignup,
  _resetPendingForTest,
  _getPendingCodeForTest,
} from "./childSignup";

test("동의(agreeChildPrivacy=false)를 안 하면, 코드가 맞아도 무조건 거부한다", () => {
  _resetPendingForTest();
  const { verifyToken, smsCode } = startChildSignup("초록고래", "010-0000-0000");

  const result = verifyChildSignup({
    verifyToken,
    smsCode, // 코드는 정확히 맞음
    agreeChildPrivacy: false, // 그런데 동의를 안 함
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 403);
    assert.equal(result.reason, "consent_required");
  }
});

test("동의 필드가 아예 없어도(undefined) 거부한다 — 클라이언트 누락을 신뢰하지 않음", () => {
  _resetPendingForTest();
  const { verifyToken, smsCode } = startChildSignup("초록고래", "010-0000-0000");

  const result = verifyChildSignup({
    verifyToken,
    smsCode,
    agreeChildPrivacy: undefined as unknown as boolean,
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "consent_required");
});

test("동의는 했지만 SMS 코드가 틀리면 거부한다", () => {
  _resetPendingForTest();
  const { verifyToken } = startChildSignup("초록고래", "010-0000-0000");

  const result = verifyChildSignup({
    verifyToken,
    smsCode: "000000", // 틀린 코드
    agreeChildPrivacy: true,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 401);
    assert.equal(result.reason, "code_mismatch");
  }
});

test("존재하지 않는 verifyToken은 거부한다", () => {
  _resetPendingForTest();
  const result = verifyChildSignup({
    verifyToken: "no-such-token",
    smsCode: "123456",
    agreeChildPrivacy: true,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "invalid_or_expired_token");
});

test("동의 + 정확한 코드 → 성공하고, 코드는 1회용이라 재사용하면 실패한다", () => {
  _resetPendingForTest();
  const { verifyToken, smsCode } = startChildSignup("초록고래", "010-0000-0000");

  const first = verifyChildSignup({ verifyToken, smsCode, agreeChildPrivacy: true });
  assert.equal(first.ok, true);
  if (first.ok) {
    assert.equal(first.nickname, "초록고래");
    assert.equal(first.guardianPhone, "010-0000-0000");
  }

  // 같은 토큰으로 다시 시도 -> 이미 소비돼서 실패해야 함
  const second = verifyChildSignup({ verifyToken, smsCode, agreeChildPrivacy: true });
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.reason, "invalid_or_expired_token");
});

test("smsCode 응답에 실제 코드가 그대로 노출되지 않아야 한다는 걸 호출부가 지켜야 함 (여기선 값 존재만 확인)", () => {
  _resetPendingForTest();
  const { verifyToken, smsCode } = startChildSignup("빨강여우", "010-1111-2222");
  assert.equal(_getPendingCodeForTest(verifyToken), smsCode);
});
