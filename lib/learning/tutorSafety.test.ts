import { test } from "node:test";
import assert from "node:assert/strict";
import { checkInputSafety, redactPii } from "./tutorSafety";

test("정상적인 질문은 통과한다", () => {
  const result = checkInputSafety("아두이노 LED가 왜 안 켜지나요?");
  assert.equal(result.ok, true);
});

test("욕설이 있으면 막고 치환한다", () => {
  const result = checkInputSafety("이 코드 씨발 왜 안돼");
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.reason === "profanity");
  assert.ok(!result.ok && !result.redactedText.includes("씨발"));
});

test("띄어쓰기로 욕설을 회피해도 걸린다(공백 제거 후 매칭)", () => {
  const result = checkInputSafety("씨 발 진짜 모르겠어요");
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.reason === "profanity");
});

test("휴대폰번호가 있으면 pii로 막는다", () => {
  const result = checkInputSafety("제 번호는 010-1234-5678이에요, 연락 주세요");
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.reason === "pii");
  assert.ok(!result.ok && !result.redactedText.includes("1234"));
});

test("주민등록번호가 있으면 pii로 막는다", () => {
  const result = checkInputSafety("제 주민번호는 123456-1234567이에요");
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.reason === "pii");
});

test("욕설과 개인정보가 둘 다 있으면 욕설이 우선 감지된다", () => {
  const result = checkInputSafety("씨발 제 번호는 010-1234-5678");
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.reason === "profanity");
});

test("redactPii — 매칭 없으면 null", () => {
  assert.equal(redactPii("아두이노 핀 연결 질문이에요"), null);
});

test("redactPii — 매칭 있으면 치환된 문자열 반환(응답 후처리에서 재사용)", () => {
  const redacted = redactPii("연락처는 010-1234-5678 입니다");
  assert.ok(redacted !== null);
  assert.ok(!redacted!.includes("1234-5678"));
});
